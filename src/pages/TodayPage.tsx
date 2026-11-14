import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckCircle2, Clock, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskCompletionDialog } from '../components/tasks/TaskCompletionDialog';
import { TaskForm } from '../components/tasks/TaskForm';
import { useTasks } from '../hooks/useTasks';
import { useTaskCompletionConfirmation } from '../hooks/useTaskCompletionConfirmation';
import type { Task } from '../types';

export const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { tasks: todayTasks, createTask, updateTask, softDeleteTask } =
    useTasks({ dateFilter: 'today' });

  const { tasks: overdueTasks } = useTasks({ dateFilter: 'overdue' });
  const completion = useTaskCompletionConfirmation();

  const todayStr = format(new Date(), 'EEEE, MMMM d, yyyy');

  const handleCreateTask = async (data: any) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask({ ...data, dueDate: data.dueDate || Date.now() });
    }
    setEditingTask(null);
  };

  const handleToggleCompletion = async (e: React.ChangeEvent<HTMLInputElement>, task: Task) => {
    e.stopPropagation();
    if (task.isCompleted) {
      completion.requestReopen(task);
    } else {
      completion.requestCompletion(task);
    }
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (window.confirm(`Move task "${task.title}" to trash?`)) {
      await softDeleteTask(task.id);
    }
  };

  const pendingToday = todayTasks.filter((t) => !t.isCompleted);
  const completedToday = todayTasks.filter((t) => t.isCompleted);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            <span>Today</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Today
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{todayStr}</p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Today's Task
        </button>
      </div>

      {/* Overdue Alert Banner */}
      {overdueTasks.length > 0 && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-950/60 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
            <Clock className="h-4 w-4" />
            <span>Overdue Tasks ({overdueTasks.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/tasks/${task.id}`)}
                onToggleCompletion={(e) => handleToggleCompletion(e, task)}
                onEdit={(e) => {
                  e.stopPropagation();
                  setEditingTask(task);
                  setIsFormOpen(true);
                }}
                onDelete={(e) => handleDeleteTask(e, task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's Tasks Content */}
      <div className="space-y-6">
        {pendingToday.length === 0 && overdueTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 opacity-80" />
            <h3 className="mt-3 text-sm font-bold text-[var(--color-text-primary)]">
              All caught up for Today!
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {completedToday.length > 0
                ? `You have completed ${completedToday.length} tasks scheduled for today.`
                : 'No pending deadlines for today.'}
            </p>
            <button
              onClick={() => {
                setEditingTask(null);
                setIsFormOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule Task for Today
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)]">
              Due Today ({pendingToday.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingToday.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onToggleCompletion={(e) => handleToggleCompletion(e, task)}
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                    setIsFormOpen(true);
                  }}
                  onDelete={(e) => handleDeleteTask(e, task)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Today section */}
        {completedToday.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-[var(--color-border-secondary)]">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)]">
              Completed Today ({completedToday.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedToday.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onToggleCompletion={(e) => handleToggleCompletion(e, task)}
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                    setIsFormOpen(true);
                  }}
                  onDelete={(e) => handleDeleteTask(e, task)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateTask}
        defaultDueDate={Date.now()}
      />
      <TaskCompletionDialog
        task={completion.task}
        action={completion.action}
        isProcessing={completion.isProcessing}
        error={completion.error}
        incompleteSubtaskCount={completion.incompleteSubtaskCount}
        onConfirm={() => void completion.confirm()}
        onCancel={completion.cancel}
        onDismissWarning={completion.dismissIncompleteSubtaskWarning}
      />
    </div>
  );
};
