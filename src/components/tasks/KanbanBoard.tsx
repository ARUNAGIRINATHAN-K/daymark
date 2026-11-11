import React from 'react';
import { ArrowLeftRight, CheckCircle2, Circle, Clock, Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../../types';

export interface KanbanBoardProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onSelectTask?: (task: Task) => void;
  onToggleCompletion: (e: React.MouseEvent, task: Task) => void;
  onEditTask?: (e: React.MouseEvent, task: Task) => void;
  onDeleteTask: (e: React.MouseEvent, task: Task) => void;
  onCreateTaskInStatus?: (status: TaskStatus) => void;
}

const COLUMNS: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  {
    status: 'todo',
    label: 'To Do',
    icon: <Circle className="h-4 w-4 text-slate-400" />,
    color: 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: <Clock className="h-4 w-4 text-indigo-500" />,
    color: 'border-indigo-100 bg-indigo-50/20 dark:border-indigo-950/40 dark:bg-indigo-950/10',
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    color: 'border-emerald-100 bg-emerald-50/20 dark:border-emerald-950/40 dark:bg-emerald-950/10',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onUpdateStatus,
  onSelectTask,
  onToggleCompletion,
  onEditTask,
  onDeleteTask,
  onCreateTaskInStatus,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => {
          const currentStatus = t.status || (t.isCompleted ? 'completed' : 'todo');
          return currentStatus === col.status;
        });

        return (
          <div
            key={col.status}
            className={`flex flex-col rounded-2xl border p-4 shadow-2xs ${col.color}`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {col.icon}
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {col.label}
                </h3>
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-2xs dark:bg-slate-800 dark:text-slate-300">
                  {colTasks.length}
                </span>
              </div>

              {onCreateTaskInStatus && (
                <button
                  onClick={() => onCreateTaskInStatus(col.status)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-800"
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Task Cards Column */}
            <div className="mt-4 space-y-3 min-h-[250px]">
              {colTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/80 p-6 text-center text-xs text-slate-400 dark:border-slate-800">
                  No tasks in {col.label}
                </div>
              ) : (
                colTasks.map((task) => (
                  <div key={task.id} className="relative group/kanban">
                    <TaskCard
                      task={task}
                      onClick={() => onSelectTask?.(task)}
                      onToggleCompletion={(e) => onToggleCompletion(e, task)}
                      onEdit={onEditTask ? (e) => onEditTask(e, task) : undefined}
                      onDelete={(e) => onDeleteTask(e, task)}
                    />

                    {/* Quick Move Status Strip */}
                    <div className="mt-1 flex items-center justify-end gap-1 opacity-0 group-hover/kanban:opacity-100 transition-opacity">
                      <span className="text-[9px] font-medium text-slate-400 flex items-center gap-0.5 mr-1">
                        <ArrowLeftRight className="h-2.5 w-2.5" /> Move:
                      </span>
                      {COLUMNS.filter((c) => c.status !== col.status).map((targetCol) => (
                        <button
                          key={targetCol.status}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(task.id, targetCol.status);
                          }}
                          className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-400"
                        >
                          {targetCol.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
