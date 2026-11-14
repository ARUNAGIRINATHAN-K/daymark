import { useCallback, useRef, useState } from 'react';
import { tasksService } from '../services/tasks.service';
import type { Task } from '../types';

type CompletionAction = () => Promise<unknown>;

interface CompletionRequest {
  task: Task;
  action?: CompletionAction;
}

export function useTaskCompletionConfirmation() {
  const [request, setRequest] = useState<CompletionRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<CompletionRequest | null>(null);
  const isProcessingRef = useRef(false);

  const requestCompletion = useCallback((task: Task, action?: CompletionAction) => {
    if (task.isCompleted || requestRef.current || isProcessingRef.current) return;

    const nextRequest = { task, action };
    requestRef.current = nextRequest;
    setError(null);
    setRequest(nextRequest);
  }, []);

  const cancel = useCallback(() => {
    if (isProcessingRef.current) return;

    requestRef.current = null;
    setRequest(null);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    const currentRequest = requestRef.current;
    if (!currentRequest || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      if (currentRequest.action) {
        await currentRequest.action();
      } else {
        const latestTask = await tasksService.getTaskById(currentRequest.task.id);
        if (!latestTask) throw new Error('This task is no longer available.');
        if (!latestTask.isCompleted) {
          await tasksService.updateTask(latestTask.id, { isCompleted: true });
        }
      }

      requestRef.current = null;
      setRequest(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to complete this task. Please try again.');
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  return {
    task: request?.task ?? null,
    isProcessing,
    error,
    requestCompletion,
    confirm,
    cancel,
  };
}
