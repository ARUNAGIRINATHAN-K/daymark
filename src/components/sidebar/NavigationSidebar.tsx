import React from 'react';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Folder as FolderIcon,
  Folders,
  Inbox,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  useFolders,
  useNotes,
  usePendingOutboxCount,
  useTasks,
} from '../../hooks/useData';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { noteService } from '../../services/noteService';
import { taskService } from '../../services/taskService';
import { useAppStore } from '../../store/useAppStore';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export const NavigationSidebar: React.FC = () => {
  const navigate = useNavigate();
  const {
    setOutboxModalOpen,
    isDarkMode,
    toggleDarkMode,
    setMobileDrawerOpen,
  } = useAppStore();

  const notes = useNotes();
  const tasks = useTasks();
  const folders = useFolders();
  const pendingOutboxCount = usePendingOutboxCount();
  const { isOnline } = useNetworkStatus();

  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const tasksToday = tasks.filter((t) => !t.isCompleted && t.dueDate && t.dueDate <= todayEnd);

  const handleCreateNote = async () => {
    const note = await noteService.create({
      title: 'Untitled Note',
      content: '',
    });
    setMobileDrawerOpen(false);
    navigate(`/notes/${note.id}`);
  };

  const handleCreateTask = async () => {
    const task = await taskService.create({
      title: 'New Task',
    });
    setMobileDrawerOpen(false);
    navigate(`/tasks/${task.id}`);
  };

  const closeMobile = () => setMobileDrawerOpen(false);

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-[var(--color-accent-subtle)] font-semibold text-[var(--color-accent)] dark:bg-[var(--color-accent-subtle)] dark:text-[var(--color-accent)]'
        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-bg-secondary)]'
    }`;

  return (
    <aside className="flex h-full w-full flex-col justify-between border-r border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-4 text-[var(--color-text-primary)] dark:border-[var(--color-border-primary)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]">
      <div className="flex flex-col space-y-6 overflow-y-auto">
        {/* Brand Zone */}
        <div className="flex items-center justify-between px-2 pt-1">
          <NavLink to="/" onClick={closeMobile} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white shadow-xs">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Daymark
            </span>
          </NavLink>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCreateNote}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Note
          </button>
          <button
            onClick={handleCreateTask}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-2xs transition hover:bg-[var(--color-border-secondary)] dark:border-[var(--color-border-primary)] dark:bg-[var(--color-bg-secondary)] dark:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-bg-card)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Task
          </button>
        </div>

        {/* Primary Navigation Routes */}
        <div className="space-y-1">
          <NavLink to="/" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="h-4 w-4 text-slate-500" />
              <span>Dashboard</span>
            </div>
          </NavLink>

          <NavLink to="/notes" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-slate-500" />
              <span>Notes</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
              {notes.filter((n) => !n.isArchived).length}
            </span>
          </NavLink>

          <NavLink to="/tasks" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-slate-500" />
              <span>Tasks</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
              {tasks.filter((t) => !t.isCompleted).length}
            </span>
          </NavLink>

          <NavLink to="/today" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>Today</span>
            </div>
            {tasksToday.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                {tasksToday.length}
              </span>
            )}
          </NavLink>

          <NavLink to="/upcoming" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span>Upcoming</span>
            </div>
          </NavLink>

          <NavLink to="/folders" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Folders className="h-4 w-4 text-slate-500" />
              <span>Folders</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
              {folders.length}
            </span>
          </NavLink>

          <NavLink to="/search" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Search className="h-4 w-4 text-slate-500" />
              <span>Search</span>
            </div>
          </NavLink>
        </div>

        {/* Secondary System Views */}
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800 space-y-1">
          <NavLink to="/archive" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-slate-500" />
              <span>Archive</span>
            </div>
          </NavLink>

          <NavLink to="/trash" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Trash2 className="h-4 w-4 text-slate-500" />
              <span>Trash</span>
            </div>
          </NavLink>

          <NavLink to="/settings" onClick={closeMobile} className={navLinkClasses}>
            <div className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Settings</span>
            </div>
          </NavLink>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {/* PWA In-App Install Button */}
        <PWAInstallButton />

        {/* Theme and Connection Status */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-xs">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
