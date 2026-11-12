import React from 'react';
import { isBefore, startOfDay } from 'date-fns';
import { Calendar, CheckSquare, Clock, Folder as FolderIcon, MoreVertical, Trash2 } from 'lucide-react';
import { useFolders } from '../../hooks/useData';
import type { Task, TaskPriority } from '../../types';
import { formatExactTimestamp, formatShortDate } from '../../utils/date.utils';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onToggleCompletion: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const PRIORITY_STYLES: Record<TaskPriority, { label: string; badge: string }> = {
  urgent: {
    label: 'Urgent',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900',
  },
  high: {
    label: 'High',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
  },
  low: {
    label: 'Low',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  onToggleCompletion,
  onEdit,
  onDelete,
}) => {
  const folders = useFolders();
  const folder = task.folderId ? folders.find((f) => f.id === task.folderId) : null;

  const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const isOverdue =
    !task.isCompleted &&
    task.dueDate !== null &&
    task.dueDate !== undefined &&
    isBefore(task.dueDate, startOfDay(new Date()));

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;
  const exactDueDate = formatExactTimestamp(task.dueDate);

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-xl border p-4 shadow-2xs transition hover:shadow-xs bg-[var(--color-bg-card)] ${
        task.isCompleted
          ? 'border-[var(--color-border-secondary)] opacity-70'
          : isOverdue
          ? 'border-red-300 dark:border-red-900/60 hover:border-red-400'
          : 'border-[var(--color-border-primary)] hover:border-[var(--color-accent)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={task.isCompleted}
            onChange={() => {}}
            onClick={onToggleCompletion}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="min-w-0 flex-1">
            <h4
              className={`text-xs font-semibold leading-snug line-clamp-2 ${
                task.isCompleted
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {task.title}
            </h4>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {task.description}
              </p>
            )}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${priorityStyle.badge}`}
        >
          {priorityStyle.label}
        </span>
      </div>

      {/* Card Footer Info */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800/60">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Due date */}
          {task.dueDate ? (
            <span
              className={`flex items-center gap-1 font-mono font-medium ${
                isOverdue
                  ? 'text-red-600 font-bold dark:text-red-400'
                  : task.isCompleted
                  ? 'text-slate-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
               {isOverdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
               <span
                 title={exactDueDate ?? undefined}
                 tabIndex={exactDueDate ? 0 : undefined}
                 aria-label={exactDueDate ? `Due ${exactDueDate}` : undefined}
               >
                 {formatShortDate(task.dueDate)}
               </span>
               {isOverdue && ' (Overdue)'}
             </span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">No due date</span>
          )}

          {/* Subtasks progress */}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1 font-mono text-slate-500 dark:text-slate-400">
              <CheckSquare className="h-3 w-3" />
              {completedSubtasks}/{subtasks.length}
            </span>
          )}

          {/* Folder badge */}
          {folder && (
            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: folder.color || '#6366f1' }}
              />
              <span className="truncate max-w-[80px]">{folder.name}</span>
            </span>
          )}
        </div>

        {/* Hover action menu */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
              title="Edit task"
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            title="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
