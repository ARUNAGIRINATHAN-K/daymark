import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskForm } from '../components/tasks/TaskForm';
import { db } from '../db/database';
import { dashboardService, type DashboardMetrics } from '../services/dashboard.service';
import { notesService } from '../services/notes.service';
import { tasksService } from '../services/tasks.service';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  // Live query trigger when IndexedDB tables change
  const liveNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const liveTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      const data = await dashboardService.getMetrics();
      setMetrics(data);
    }
    fetchMetrics();
  }, [liveNotes, liveTasks]);

  const handleCreateNote = async () => {
    const note = await notesService.createNote({
      title: 'Untitled Note',
      content: '',
    });
    navigate(`/notes/${note.id}`);
  };

  const handleCreateTask = async (data: any) => {
    await tasksService.createTask(data);
  };

  const todayDateStr = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back to Daymark
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {todayDateStr} · Your local offline-first workspace summary
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Plus className="h-4 w-4" />
            Quick Note
          </button>
          <button
            onClick={() => setIsTaskFormOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Quick Task
          </button>
        </div>
      </div>

      {/* Summary Multi-Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Task Completion
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
              {metrics?.completionRate ?? 0}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({metrics?.completedTasks ?? 0}/{metrics?.totalTasks ?? 0} done)
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${metrics?.completionRate ?? 0}%` }}
            />
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pending Workflows
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
              {metrics?.pendingTasks ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">active tasks</span>
          </div>
        </div>

        {/* Overdue Count */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Overdue Tasks
            </span>
            <div className="rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-bold ${
                (metrics?.overdueTasks ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {metrics?.overdueTasks ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">needs attention</span>
          </div>
        </div>

        {/* Active Notes */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Notes
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
              {metrics?.totalNotes ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">indexed documents</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Urgent Workflows & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent & High Priority Tasks */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Urgent & High Priority Tasks
            </h3>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View All Tasks
            </button>
          </div>

          {!metrics?.urgentPendingTasks || metrics.urgentPendingTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No urgent or high priority tasks pending.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.urgentPendingTasks.slice(0, 4).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onToggleCompletion={async (e) => {
                    e.stopPropagation();
                    await tasksService.toggleCompletion(task.id);
                  }}
                  onDelete={async (e) => {
                    e.stopPropagation();
                    await tasksService.softDeleteTask(task.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines (Next 7 Days) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" /> Upcoming Deadlines (Next 7 Days)
            </h3>
            <button
              onClick={() => navigate('/upcoming')}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Full Calendar
            </button>
          </div>

          {!metrics?.upcomingDeadlines || metrics.upcomingDeadlines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No upcoming task deadlines scheduled for the next 7 days.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.upcomingDeadlines.slice(0, 4).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onToggleCompletion={async (e) => {
                    e.stopPropagation();
                    await tasksService.toggleCompletion(task.id);
                  }}
                  onDelete={async (e) => {
                    e.stopPropagation();
                    await tasksService.softDeleteTask(task.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Notes Section */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" /> Recent Notes
          </h3>
          <button
            onClick={() => navigate('/notes')}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            All Notes
          </button>
        </div>

        {!metrics?.recentNotes || metrics.recentNotes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 italic">
            No notes created yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {metrics.recentNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className="cursor-pointer rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:border-indigo-400 transition dark:border-slate-800 dark:bg-slate-950/40"
              >
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {note.title || 'Untitled Note'}
                </h4>
                <p className="mt-1 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {note.content.replace(/[#*`_>-]/g, '').trim() || 'No preview content'}
                </p>
                <span className="mt-2 block text-[9px] font-mono text-slate-400">
                  {format(note.updatedAt, 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Task Modal */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
};
