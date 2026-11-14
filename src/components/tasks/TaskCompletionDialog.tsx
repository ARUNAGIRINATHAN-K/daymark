import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LoaderCircle } from 'lucide-react';
import type { TaskConfirmationAction } from '../../hooks/useTaskCompletionConfirmation';
import type { Task } from '../../types';

interface TaskCompletionDialogProps {
  task: Task | null;
  action: TaskConfirmationAction;
  isProcessing: boolean;
  error: string | null;
  incompleteSubtaskCount: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  onDismissWarning: () => void;
}

export const TaskCompletionDialog: React.FC<TaskCompletionDialogProps> = ({
  task,
  action,
  isProcessing,
  error,
  incompleteSubtaskCount,
  onConfirm,
  onCancel,
  onDismissWarning,
}) => {
  const isCompleting = action === 'complete';
  const isWarning = incompleteSubtaskCount !== null;

  return (
    <Dialog.Root
      open={task !== null || isWarning}
      onOpenChange={(open) => {
        if (!open && !isProcessing) {
          if (isWarning) onDismissWarning();
          else onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="task-completion-overlay fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content
          key={isWarning ? 'subtask-warning' : 'confirmation'}
          className="task-completion-content fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-6 text-[var(--color-text-primary)] shadow-2xl"
          onEscapeKeyDown={(event) => {
            if (isProcessing) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {isWarning ? (
            <>
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                Subtasks still pending
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Complete all subtasks before marking this task as completed.
              </Dialog.Description>
              <p role="status" className="mt-3 text-sm font-medium">
                {incompleteSubtaskCount} incomplete{' '}
                {incompleteSubtaskCount === 1 ? 'subtask' : 'subtasks'} remaining.
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                This action will not complete subtasks automatically.
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onDismissWarning}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  OK
                </button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {isCompleting ? 'Complete this task?' : 'Reopen this task?'}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {isCompleting
                  ? 'Are you sure you want to mark this task as completed? It will be moved to All Tasks.'
                  : 'Are you sure you want to mark this task as incomplete? It will return to your active tasks.'}
              </Dialog.Description>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={onCancel}
                  className="rounded-lg border border-[var(--color-border-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  aria-busy={isProcessing}
                  onClick={onConfirm}
                  className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isProcessing && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isProcessing ? (isCompleting ? 'Completing…' : 'Reopening…') : 'Confirm'}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
