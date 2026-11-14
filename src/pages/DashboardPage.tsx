import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, formatDistanceToNowStrict, startOfDay } from 'date-fns';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ListTodo,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskCompletionDialog } from '../components/tasks/TaskCompletionDialog';
import { TaskForm } from '../components/tasks/TaskForm';
import { useFolders, useRecentOutboxOperations, useTags, useTasks } from '../hooks/useData';
import { useTaskCompletionConfirmation } from '../hooks/useTaskCompletionConfirmation';
import { useNotes as useLiveNotes } from '../hooks/useNotes';
import { dashboardService, type DashboardActivity, type TaskPerformancePoint } from '../services/dashboard.service';
import { notesService } from '../services/notes.service';
import { tasksService } from '../services/tasks.service';
import type { CreateTaskInput, Tag, UpdateTaskInput } from '../types';

const cardClass =
  'rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] shadow-xs';

interface StatCardProps {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: 'purple' | 'green' | 'red' | 'blue';
  progress?: number;
}

const statToneClasses: Record<StatCardProps['tone'], string> = {
  purple: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
  green: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',
  red: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, detail, icon: Icon, tone, progress }) => (
  <section className={`${cardClass} min-w-0 p-4 sm:p-5`} aria-label={label}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-[var(--color-text-primary)]">
          {value}
        </p>
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statToneClasses[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
    {progress !== undefined && (
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]"
        role="progressbar"
        aria-label="Task completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    )}
    <p className="mt-2 text-xs text-[var(--color-text-muted)]">{detail}</p>
  </section>
);

interface TaskPerformanceChartProps {
  points: TaskPerformancePoint[];
  days: 7 | 30;
  onDaysChange: (days: 7 | 30) => void;
}

const TaskPerformanceChart: React.FC<TaskPerformanceChartProps> = ({ points, days, onDaysChange }) => {
  const width = 720;
  const height = 220;
  const left = 34;
  const right = 12;
  const top = 14;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(1, ...points.flatMap((point) => [point.created, point.completed]));
  const tickValues = Array.from(
    new Set([0, Math.floor(maximum / 3), Math.floor((maximum * 2) / 3), maximum])
  );
  const y = (value: number) => top + plotHeight - (value / maximum) * plotHeight;
  const x = (index: number) => left + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const createdLine = points.map((point, index) => `${x(index)},${y(point.created)}`).join(' ');
  const completedLine = points.map((point, index) => `${x(index)},${y(point.completed)}`).join(' ');
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));

  return (
    <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Task performance</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Created and completed each day</p>
        </div>
        <div className="flex rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-0.5">
          {([7, 30] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onDaysChange(range)}
              aria-pressed={days === range}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                days === range
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-48 w-full overflow-visible"
          role="img"
          aria-label={`Tasks created and completed over the last ${days} days`}
        >
          {tickValues.map((value) => {
            const lineY = y(value);
            return (
              <g key={value}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={lineY}
                  y2={lineY}
                  stroke="var(--color-border-secondary)"
                  strokeDasharray={value === 0 ? undefined : '3 5'}
                />
                <text
                  x={left - 8}
                  y={lineY + 3}
                  textAnchor="end"
                  className="fill-[var(--color-text-muted)]"
                  fontSize="9"
                >
                  {value}
                </text>
              </g>
            );
          })}
          <polyline
            points={createdLine}
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 4"
          />
          <polyline
            points={completedLine}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <g key={point.date.toISOString()}>
              <circle cx={x(index)} cy={y(point.created)} r="2.5" fill="var(--color-text-muted)">
                <title>{`${format(point.date, 'MMM d')}: ${point.created} created`}</title>
              </circle>
              <circle cx={x(index)} cy={y(point.completed)} r="2.8" fill="var(--color-accent)">
                <title>{`${format(point.date, 'MMM d')}: ${point.completed} completed`}</title>
              </circle>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-[var(--color-text-muted)]"
              fontSize="10"
            >
              {format(points[index].date, 'MMM d')}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          Completed
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)]" />
          Created
        </span>
        {points.every((point) => point.created === 0 && point.completed === 0) && (
          <span className="text-[var(--color-text-muted)]">Task activity will appear here as you work.</span>
        )}
      </div>
    </section>
  );
};

interface ProductivityMapProps {
  days: { date: Date; count: number }[];
  total: number;
  now: Date;
}

const ProductivityMap: React.FC<ProductivityMapProps> = ({ days, total, now }) => {
  const today = startOfDay(now);
  const weeks = Array.from({ length: 12 }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7));
  const monthLabels = weeks.flatMap((week, index) => {
    const month = week[0] ? format(week[0].date, 'MMM') : '';
    const previousMonth = index > 0 && weeks[index - 1][0] ? format(weeks[index - 1][0].date, 'MMM') : '';
    return month && month !== previousMonth ? [{ index, month }] : [];
  });
  const maxCount = Math.max(0, ...days.map((day) => day.count));
  const level = (count: number) => {
    if (count === 0) return 0;
    return Math.min(4, Math.ceil((count / maxCount) * 4));
  };
  const levelClasses = [
    'bg-[var(--color-bg-secondary)]',
    'bg-[#e6e9ff] dark:bg-[#252c50]',
    'bg-[#bfc7ff] dark:bg-[#333f85]',
    'bg-[#8491ff] dark:bg-[#5565d6]',
    'bg-[var(--color-accent)]',
  ];

  return (
    <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Productivity map</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Completed tasks · last 12 weeks</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums text-[var(--color-text-primary)]">{total}</span>
          <span className="text-xs text-[var(--color-text-muted)]">in this period</span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-[26px_minmax(0,1fr)] gap-x-2">
        <div aria-hidden="true" className="grid grid-rows-7 gap-1 pt-5 text-[9px] text-[var(--color-text-muted)]">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((day, index) => (
            <span key={index} className="flex items-center">{day}</span>
          ))}
        </div>
        <div className="min-w-0">
          <div className="grid h-4 grid-cols-12 text-[9px] text-[var(--color-text-muted)]">
            {monthLabels.map(({ index, month }) => (
              <span key={`${index}-${month}`} style={{ gridColumnStart: index + 1 }}>
                {month}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-cols-12 grid-rows-7 gap-1">
            {weeks.flatMap((week, weekIndex) =>
              Array.from({ length: 7 }, (_, dayIndex) => {
                const day = week[dayIndex];
                if (!day || (today && day.date > today)) {
                  return <span key={`${weekIndex}-${dayIndex}`} aria-hidden="true" />;
                }
                const intensity = level(day.count);
                return (
                  <span
                    key={day.date.toISOString()}
                    role="img"
                    title={`${format(day.date, 'EEEE, MMMM d')}: ${day.count} completed task${day.count === 1 ? '' : 's'}`}
                    aria-label={`${format(day.date, 'MMMM d, yyyy')}: ${day.count} completed task${day.count === 1 ? '' : 's'}`}
                    className={`aspect-square min-w-0 rounded-[3px] ${levelClasses[intensity]}`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-[var(--color-text-muted)]">
        <span>Each square is a day. Hover for details.</span>
        <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
          <span>Less</span>
          {levelClasses.map((className, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-[2px] ${className}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
};

interface ActivityTimelineProps {
  items: DashboardActivity[];
  onOpen: (item: DashboardActivity) => void;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ items, onOpen }) => (
  <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent activity</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Changes still available on this device</p>
      </div>
    </div>
    {items.length === 0 ? (
      <div className="py-8 text-center">
        <Clock3 className="mx-auto h-7 w-7 text-[var(--color-text-muted)]" aria-hidden="true" />
        <p className="mt-2 text-xs font-medium text-[var(--color-text-primary)]">Nothing to show yet</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Create or update a note or task to get started.</p>
      </div>
    ) : (
      <ol className="mt-4 space-y-0.5">
        {items.map((item) => {
          const Icon = item.title.includes('archived')
            ? Archive
            : item.title.includes('completed')
              ? CheckCircle2
              : item.itemType === 'note'
                ? FileText
                : ListTodo;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                disabled={!item.entityAvailable}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-[var(--color-text-primary)]">{item.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">{item.itemTitle}</span>
                </span>
                <time
                  className="shrink-0 pt-0.5 text-[10px] text-[var(--color-text-muted)]"
                  dateTime={new Date(item.timestamp).toISOString()}
                  title={format(new Date(item.timestamp), 'PPpp')}
                >
                  {formatDistanceToNowStrict(item.timestamp, { addSuffix: true })}
                </time>
              </button>
            </li>
          );
        })}
      </ol>
    )}
  </section>
);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const completion = useTaskCompletionConfirmation();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const [chartDays, setChartDays] = useState<7 | 30>(30);
  const [now, setNow] = useState(() => new Date());
  const allNotes = useLiveNotes({ includeArchived: true }).notes;
  const tasks = useTasks();
  const folders = useFolders();
  const tags = useTags();
  const recentOperations = useRecentOutboxOperations();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(
    () => dashboardService.calculateMetrics(allNotes, tasks, now),
    [allNotes, tasks, now]
  );
  const performance = useMemo(
    () => dashboardService.getTaskPerformance(tasks, chartDays, now),
    [tasks, chartDays, now]
  );
  const completionActivity = useMemo(
    () => dashboardService.getCompletionActivity(tasks, now),
    [tasks, now]
  );
  const recentActivity = useMemo(
    () => dashboardService.getRecentActivity(recentOperations, allNotes, tasks),
    [recentOperations, allNotes, tasks]
  );

  const handleCreateNote = async () => {
    const note = await notesService.createNote({ title: 'Untitled Note', content: '' });
    navigate(`/notes/${note.id}`);
  };

  const handleCreateTask = async (data: CreateTaskInput | UpdateTaskInput) => {
    if (typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error('A task title is required.');
    }
    await tasksService.createTask({ ...data, title: data.title });
  };

  const handleQuickCaptureTask = async () => {
    const title = quickCaptureText.trim();
    if (!title) return;
    await tasksService.createTask({ title, priority: 'medium' });
    setQuickCaptureText('');
  };

  const handleQuickCaptureNote = async () => {
    const title = quickCaptureText.trim() || 'Untitled Note';
    const note = await notesService.createNote({ title, content: '' });
    setQuickCaptureText('');
    navigate(`/notes/${note.id}`);
  };

  const handleQuickCaptureKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleQuickCaptureTask();
    }
  };

  const actionTasks = [
    ...metrics.urgentPendingTasks,
    ...metrics.todayTasks.filter(
      (task) => !task.isCompleted && task.priority !== 'urgent' && task.priority !== 'high'
    ),
  ];
  const uniqueActionTasks = Array.from(new Map(actionTasks.map((task) => [task.id, task])).values());
  const currentHour = now.getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const activeNoteIds = new Set(allNotes.map((note) => note.id));
  const activeTaskIds = new Set(tasks.map((task) => task.id));

  const openActivityItem = (item: DashboardActivity) => {
    const isAvailable =
      item.itemType === 'note' ? activeNoteIds.has(item.entityId) : activeTaskIds.has(item.entityId);
    if (isAvailable) navigate(`/${item.itemType}s/${item.entityId}`);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:space-y-6 sm:p-6 xl:p-8">
        <header className="flex flex-col justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              {format(now, 'EEEE, MMMM d, yyyy')}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-[28px]">
              {greeting}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Here’s your day at a glance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNote}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Note
            </button>
            <button
              type="button"
              onClick={() => setIsTaskFormOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Task
            </button>
          </div>
        </header>

        <section className={`${cardClass} p-2`} aria-label="Quick capture">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Sparkles className="ml-2 h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
              <input
                type="text"
                value={quickCaptureText}
                onChange={(event) => setQuickCaptureText(event.target.value)}
                onKeyDown={handleQuickCaptureKeyDown}
                placeholder="Capture a thought or task…"
                aria-label="Quick capture"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
            </div>
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={handleQuickCaptureTask}
                disabled={!quickCaptureText.trim()}
                className="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-border-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Task
              </button>
              <button
                type="button"
                onClick={handleQuickCaptureNote}
                disabled={!quickCaptureText.trim()}
                className="rounded-lg bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-border-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Note
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Productivity statistics">
          <StatCard
            label="Total tasks"
            value={metrics.totalTasks}
            detail={`${metrics.pendingTasks} active · ${metrics.completedTasks} completed`}
            icon={ListTodo}
            tone="purple"
          />
          <StatCard
            label="Completed tasks"
            value={metrics.completedTasks}
            detail={`${metrics.completionRate}% of all tasks`}
            icon={CheckCircle2}
            tone="green"
            progress={metrics.completionRate}
          />
          <StatCard
            label="Overdue tasks"
            value={metrics.overdueTasks}
            detail={metrics.overdueTasks === 0 ? 'You’re all caught up' : 'Need your attention'}
            icon={AlertCircle}
            tone="red"
          />
          <StatCard
            label="Upcoming tasks"
            value={metrics.upcomingDeadlines.length}
            detail="Due in the next 7 days"
            icon={CalendarDays}
            tone="blue"
          />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
          <TaskPerformanceChart
            points={performance}
            days={chartDays}
            onDaysChange={setChartDays}
          />
          <ProductivityMap
            days={completionActivity}
            total={completionActivity.reduce((sum, day) => sum + day.count, 0)}
            now={now}
          />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-secondary)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent notes</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/notes')}
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                All notes <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            {metrics.recentNotes.length === 0 ? (
              <div className="py-9 text-center">
                <FileText className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-[var(--color-text-primary)]">No notes yet</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Capture a note to see it here.</p>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metrics.recentNotes.map((note) => {
                  const folder = note.folderId ? folderById.get(note.folderId) : undefined;
                  const noteTags = note.tagIds
                    .map((id) => tagById.get(id))
                    .filter((tag): tag is Tag => tag !== undefined);
                  return (
                    <button
                      type="button"
                      key={note.id}
                      onClick={() => navigate(`/notes/${note.id}`)}
                      className="group min-w-0 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] p-3.5 text-left transition hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)]">
                          {note.title || 'Untitled Note'}
                        </h3>
                        <time
                          className="shrink-0 text-[10px] text-[var(--color-text-muted)]"
                          dateTime={new Date(note.updatedAt).toISOString()}
                          title={format(new Date(note.updatedAt), 'PPpp')}
                        >
                          {format(note.updatedAt, 'MMM d')}
                        </time>
                      </div>
                      <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {note.content.replace(/[#*`_>-]/g, '').trim() || 'No preview text'}
                      </p>
                      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
                        {folder && (
                          <span className="inline-flex max-w-full items-center gap-1 rounded bg-[var(--color-bg-card)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: folder.color }} />
                            <span className="truncate">{folder.name}</span>
                          </span>
                        )}
                        {noteTags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="max-w-24 truncate rounded bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]"
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <ActivityTimeline items={recentActivity} onOpen={openActivityItem} />

            <section className={`${cardClass} min-w-0 p-4 sm:p-5`}>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-secondary)] pb-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Today’s focus</h2>
                  {uniqueActionTasks.length > 0 && (
                    <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-accent)]">
                      {uniqueActionTasks.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  All tasks <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
              {metrics.overdueTasks > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 p-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>{metrics.overdueTasks}</strong> overdue task{metrics.overdueTasks === 1 ? '' : 's'} need attention.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/today')}
                    className="ml-auto shrink-0 font-medium underline"
                  >
                    Review
                  </button>
                </div>
              )}
              {uniqueActionTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-[var(--color-success)]" aria-hidden="true" />
                  <p className="mt-2 text-xs font-medium text-[var(--color-text-primary)]">All clear for today</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">No urgent tasks need your attention.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {uniqueActionTasks.slice(0, 3).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      onToggleCompletion={async (event) => {
                        event.stopPropagation();
                        if (task.isCompleted) {
                          completion.requestReopen(task);
                        } else {
                          completion.requestCompletion(task);
                        }
                      }}
                      onDelete={async (event) => {
                        event.stopPropagation();
                        await tasksService.softDeleteTask(task.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={() => setIsTaskFormOpen(false)}
          onSubmit={handleCreateTask}
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
    </div>
  );
};

export default DashboardPage;
