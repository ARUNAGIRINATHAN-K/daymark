import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Sparkles,
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
  const [quickCaptureText, setQuickCaptureText] = useState('');

  // Live query trigger when IndexedDB tables change
  const liveNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const liveTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      const data = await dashboardService.getMetrics();
      setMetrics(data);
    }
    void fetchMetrics();
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

  const handleQuickCaptureTask = async () => {
    const title = quickCaptureText.trim();
    if (!title) return;
    await tasksService.createTask({ title, priority: 'medium' });
    setQuickCaptureText('');
  };

  const handleQuickCaptureNote = async () => {
    const title = quickCaptureText.trim() || 'Untitled Note';
    const note = await notesService.createNote({
      title,
      content: '',
    });
    setQuickCaptureText('');
    navigate(`/notes/${note.id}`);
  };

  const handleQuickCaptureKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleQuickCaptureTask();
    }
  };

  const todayDateStr = format(new Date(), 'EEEE, MMMM d, yyyy');

  // Derive time-of-day greeting
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 18
      ? 'Good afternoon'
      : 'Good evening';

  // Combined today + urgent action items
  const actionTasks = [
    ...(metrics?.urgentPendingTasks ?? []),
    ...(metrics?.todayTasks.filter((t) => !t.isCompleted && t.priority !== 'urgent' && t.priority !== 'high') ?? []),
  ];
  // Deduplicate by ID
  const uniqueActionTasks = Array.from(new Map(actionTasks.map((t) => [t.id, t])).values());

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {greeting}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {todayDateStr}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] shadow-2xs transition hover:bg-[var(--color-bg-secondary)]"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
          <button
            onClick={() => setIsTaskFormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Quick Capture Bar */}
      <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="pl-3 text-[var(--color-text-muted)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={quickCaptureText}
            onChange={(e) => setQuickCaptureText(e.target.value)}
            onKeyDown={handleQuickCaptureKeyDown}
            placeholder="Quick capture: type a thought or task and press Enter..."
            className="flex-1 bg-transparent px-2 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
          />
          <div className="flex items-center gap-1 pr-1">
            <button
              onClick={handleQuickCaptureTask}
              disabled={!quickCaptureText.trim()}
              className="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-border-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Add as Task"
            >
              + Task
            </button>
            <button
              onClick={handleQuickCaptureNote}
              disabled={!quickCaptureText.trim()}
              className="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-border-primary)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Add as Note"
            >
              + Note
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Today's Action Items */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Today's Focus
              </h2>
              {uniqueActionTasks.length > 0 && (
                <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-accent)]">
                  {uniqueActionTasks.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              All Tasks
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Overdue alert strip if present */}
          {(metrics?.overdueTasks ?? 0) > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>
                  <strong>{metrics?.overdueTasks}</strong> overdue task{(metrics?.overdueTasks ?? 0) === 1 ? '' : 's'} need attention.
                </span>
              </div>
              <button
                onClick={() => navigate('/today')}
                className="font-medium underline hover:text-red-950 dark:hover:text-red-100"
              >
                Review
              </button>
            </div>
          )}

          {uniqueActionTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 opacity-80" />
              <p className="font-medium text-[var(--color-text-primary)]">All clear for today</p>
              <p>No urgent deadlines pending. Capture a new task above or relax.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uniqueActionTasks.slice(0, 5).map((task) => (
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

        {/* Right Column: Recent Thinking / Notes */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border-secondary)] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Recent Notes
              </h2>
            </div>
            <button
              onClick={() => navigate('/notes')}
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              All Notes
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {!metrics?.recentNotes || metrics.recentNotes.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)] space-y-2">
              <FileText className="mx-auto h-8 w-8 text-[var(--color-text-muted)] opacity-60" />
              <p className="font-medium text-[var(--color-text-primary)]">No notes yet</p>
              <p>Capture your first note using the quick capture bar above.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.recentNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="group cursor-pointer rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] p-3.5 transition hover:border-[var(--color-accent)] hover:shadow-2xs"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] line-clamp-1 transition">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <span className="font-mono text-xs text-[var(--color-text-muted)] shrink-0">
                      {format(note.updatedAt, 'MMM d')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                    {note.content.replace(/[#*`_>-]/g, '').trim() || 'No preview text'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
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

export default DashboardPage;
