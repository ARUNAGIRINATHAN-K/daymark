import { useCallback, useRef, useState } from 'react';
import { IncompleteSubtasksError, tasksService } from '../services/tasks.service';
import type { Task } from '../types';

export type TaskConfirmationAction = 'complete' | 'reopen';
type ConfirmationCallback = () => Promise<unknown>;

interface CompletionRequest {
  task: Task;
  action: TaskConfirmationAction;
  callback?: ConfirmationCallback;
}

export function useTaskCompletionConfirmation() {
  const [request, setRequest] = useState<CompletionRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incompleteSubtaskCount, setIncompleteSubtaskCount] = useState<number | null>(null);
  const requestRef = useRef<CompletionRequest | null>(null);
  const isProcessingRef = useRef(false);

  const requestConfirmation = useCallback(
    (task: Task, action: TaskConfirmationAction, callback?: ConfirmationCallback) => {
      const targetIsCompleted = action === 'complete';
      if (
        task.isCompleted === targetIsCompleted ||
        requestRef.current ||
        isProcessingRef.current
      ) {
        return;
      }

      const nextRequest = { task, action, callback };
      requestRef.current = nextRequest;
      setError(null);
      setIncompleteSubtaskCount(null);
      setRequest(nextRequest);
    },
    []
  );

  const requestCompletion = useCallback(
    (task: Task, callback?: ConfirmationCallback) => {
      requestConfirmation(task, 'complete', callback);
    },
    [requestConfirmation]
  );

  const requestReopen = useCallback(
    (task: Task, callback?: ConfirmationCallback) => {
      requestConfirmation(task, 'reopen', callback);
    },
    [requestConfirmation]
  );

  const cancel = useCallback(() => {
    if (isProcessingRef.current) return;

    requestRef.current = null;
    setRequest(null);
    setError(null);
    setIncompleteSubtaskCount(null);
  }, []);

  const dismissIncompleteSubtaskWarning = useCallback(() => {
    setIncompleteSubtaskCount(null);
  }, []);

  const confirm = useCallback(async () => {
    const currentRequest = requestRef.current;
    if (!currentRequest || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      if (currentRequest.callback) {
        await currentRequest.callback();
      } else {
        const latestTask = await tasksService.getTaskById(currentRequest.task.id);
        if (!latestTask) throw new Error('This task is no longer available.');
        const shouldBeCompleted = currentRequest.action === 'complete';
        if (latestTask.isCompleted !== shouldBeCompleted) {
          await tasksService.updateTask(latestTask.id, { isCompleted: shouldBeCompleted });
        }
      }

      requestRef.current = null;
      setRequest(null);
    } catch (reason: unknown) {
      if (reason instanceof IncompleteSubtasksError) {
        requestRef.current = null;
        setRequest(null);
        setIncompleteSubtaskCount(reason.incompleteCount);
      } else {
        const verb = currentRequest.action === 'complete' ? 'complete' : 'reopen';
        setError(
          reason instanceof Error ? reason.message : `Unable to ${verb} this task. Please try again.`
        );
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  return {
    task: request?.task ?? null,
    action: request?.action ?? 'complete',
    isProcessing,
    error,
    incompleteSubtaskCount,
    requestCompletion,
    requestReopen,
    confirm,
    cancel,
    dismissIncompleteSubtaskWarning,
  };
}
