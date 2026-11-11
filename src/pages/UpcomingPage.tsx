import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskForm } from '../components/tasks/TaskForm';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types';

export const UpcomingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { tasks: upcomingTasks, createTask, updateTask, toggleCompletion, softDeleteTask } =
    useTasks({ dateFilter: 'upcoming' });

  const handleCreateTask = async (data: any) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask(data);
    }
    setEditingTask(null);
  };

  const handleToggleCompletion = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    await toggleCompletion(task.id);
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (window.confirm(`Move task "${task.title}" to trash?`)) {
      await softDeleteTask(task.id);
    }
  };

  // Group upcoming tasks by formatted date
  const groupedTasks: Record<string, Task[]> = {};
  for (const task of upcomingTasks) {
    const key = task.dueDate ? format(task.dueDate, 'EEEE, MMMM d, yyyy') : 'Later';
    if (!groupedTasks[key]) groupedTasks[key] = [];
    groupedTasks[key].push(task);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Future Schedule</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Upcoming
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {upcomingTasks.length} tasks scheduled for future dates
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTask(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Schedule Task
        </button>
      </div>

      {upcomingTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            No upcoming tasks scheduled.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Tasks with future due dates will appear here organized by date.
          </p>
          <button
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Upcoming Task
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([dateGroup, tasksInGroup]) => (
            <div key={dateGroup} className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                {dateGroup} ({tasksInGroup.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasksInGroup.map((task) => (
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
    </div>
  );
};
