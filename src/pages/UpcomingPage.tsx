import React, { useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskCompletionDialog } from '../components/tasks/TaskCompletionDialog';
import { TaskForm } from '../components/tasks/TaskForm';
import { useTasks } from '../hooks/useTasks';
import { useTaskCompletionConfirmation } from '../hooks/useTaskCompletionConfirmation';
import type { Task } from '../types';

export const UpcomingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const taskFilters = selectedDate
    ? { scheduledDate: startOfDay(selectedDate).getTime() }
    : { dateFilter: 'upcoming' as const };
  const { tasks: scheduledTasks, createTask, updateTask, softDeleteTask } = useTasks(taskFilters);
  const completion = useTaskCompletionConfirmation();

  const handleCreateTask = async (data: any) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask(data);
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

  const groupedTasks = new Map<number, Task[]>();
  if (!selectedDate) {
    for (const task of scheduledTasks) {
      if (task.dueDate == null) continue;
      const key = startOfDay(task.dueDate).getTime();
      const tasksForDate = groupedTasks.get(key) ?? [];
      tasksForDate.push(task);
      groupedTasks.set(key, tasksForDate);
    }
  }

  const moveSelectedDate = (days: number) => {
    setSelectedDate(addDays(startOfDay(selectedDate ?? new Date()), days));
  };

  const renderTaskCard = (task: Task) => (
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
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)]">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Upcoming</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Upcoming
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {selectedDate
              ? `${scheduledTasks.length} tasks scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`
              : `${scheduledTasks.length} tasks scheduled for future dates`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => moveSelectedDate(-1)}
              className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="date"
              aria-label="Select deadline date"
              value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setSelectedDate(null);
                  return;
                }
                const [year, month, day] = value.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, day));
              }}
              className="w-[138px] rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]"
            />
            <button
              type="button"
              aria-label="Next day"
              onClick={() => moveSelectedDate(1)}
              className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(startOfDay(new Date()))}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)]"
            >
              Today
            </button>
          </div>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-secondary)]"
            >
              All upcoming
            </button>
          )}
          <button
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Schedule Task
          </button>
        </div>
      </div>

      {selectedDate ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Tasks scheduled for {format(selectedDate, 'EEEE, MMMM d, yyyy')} ({scheduledTasks.length})
          </h2>
          {scheduledTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-12 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-[var(--color-text-muted)] opacity-60" />
              <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                No tasks scheduled for this date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduledTasks.map(renderTaskCard)}
            </div>
          )}
        </div>
      ) : scheduledTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-16 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-[var(--color-text-muted)] opacity-60" />
          <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
            No upcoming tasks scheduled.
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Tasks with future due dates will appear here organized by date.
          </p>
          <button
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Upcoming Task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedTasks.entries())
            .sort(([firstDate], [secondDate]) => firstDate - secondDate)
            .map(([date, tasksInGroup]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                {format(date, 'EEEE, MMMM d, yyyy')} ({tasksInGroup.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasksInGroup.map(renderTaskCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        task={editingTask}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateTask}
        defaultDueDate={Date.now() + 86400000}
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
