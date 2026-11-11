import React from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task } from '../../types';

export interface TaskListProps {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
  onToggleCompletion: (e: React.MouseEvent, task: Task) => void;
  onEditTask?: (e: React.MouseEvent, task: Task) => void;
  onDeleteTask: (e: React.MouseEvent, task: Task) => void;
  onCreateTask?: () => void;
  emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onSelectTask,
  onToggleCompletion,
  onEditTask,
  onDeleteTask,
  onCreateTask,
  emptyMessage = 'No tasks found matching your filters.',
}) => {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
        <CheckSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
        {onCreateTask && (
          <button
            onClick={onCreateTask}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Task
          </button>
        )}
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  return (
    <div className="space-y-6">
      {/* Pending tasks grid */}
      <div className="space-y-3">
        {completedTasks.length > 0 && (
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Pending Tasks ({pendingTasks.length})
          </h3>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onSelectTask?.(task)}
              onToggleCompletion={(e) => onToggleCompletion(e, task)}
              onEdit={onEditTask ? (e) => onEditTask(e, task) : undefined}
              onDelete={(e) => onDeleteTask(e, task)}
            />
          ))}
        </div>
      </div>

      {/* Completed tasks section */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200/60 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            Completed Tasks ({completedTasks.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onSelectTask?.(task)}
                onToggleCompletion={(e) => onToggleCompletion(e, task)}
                onEdit={onEditTask ? (e) => onEditTask(e, task) : undefined}
                onDelete={(e) => onDeleteTask(e, task)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
