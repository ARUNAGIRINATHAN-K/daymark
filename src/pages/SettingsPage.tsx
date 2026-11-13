import React, { useEffect, useState } from 'react';
import {
  Download,
  HardDrive,
  Keyboard,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { BackupRestorePanel } from '../components/settings/BackupRestorePanel';
import { LocalFolderSyncPanel } from '../components/settings/LocalFolderSyncPanel';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import {
  useFolders,
  useNotes,
  usePendingOutboxCount,
  useTags,
  useTasks,
} from '../hooks/useData';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { notesService } from '../services/notes.service';
import { outboxService } from '../services/outboxService';
import { tasksService } from '../services/tasks.service';
import { settingsService } from '../services/settings.service';
import { TaskSortBySchema, type TaskSortBy } from '../schemas/settings.schema';
import { useAppStore } from '../store/useAppStore';
import { getStorageEstimate, type StorageEstimateResult } from '../utils/network.utils';

export const SettingsPage: React.FC = () => {
  const { isDarkMode, setTheme, setOutboxModalOpen, setShortcutsModalOpen } = useAppStore();
  const { isInstalled } = usePWAInstall();

  const notes = useNotes();
  const tasks = useTasks();
  const folders = useFolders();
  const tags = useTags();
  const pendingOutboxCount = usePendingOutboxCount();

  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult | null>(null);
  const [defaultTaskSort, setDefaultTaskSort] = useState<TaskSortBy>('createdAt');
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const refreshStorage = async () => {
    const est = await getStorageEstimate();
    setStorageEstimate(est);
  };

  useEffect(() => {
    refreshStorage();
  }, [notes.length, tasks.length, pendingOutboxCount]);

  useEffect(() => {
    let active = true;
    void settingsService.getDefaultTaskSort().then((sortBy) => {
      if (active) setDefaultTaskSort(sortBy);
    }).catch((error: unknown) => {
      if (active) setPreferenceError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, []);

  const handleThemeChange = (theme: 'dark' | 'light') => {
    try {
      settingsService.setThemePreference(theme);
      setTheme(theme);
      setPreferenceError(null);
    } catch (error: unknown) {
      setPreferenceError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDefaultTaskSortChange = async (value: string) => {
    const parsed = TaskSortBySchema.safeParse(value);
    if (!parsed.success) return;
    try {
      await settingsService.setDefaultTaskSort(parsed.data);
      setDefaultTaskSort(parsed.data);
      setPreferenceError(null);
    } catch (error: unknown) {
      setPreferenceError(error instanceof Error ? error.message : String(error));
    }
  };

  const handlePurgeTrash = async () => {
    if (window.confirm('Permanently purge soft-deleted items from trash to free up space?')) {
      const deletedNotes = await notesService.getNotes({ includeDeleted: true });
      const deletedTasks = await tasksService.getTasks({ includeDeleted: true });

      for (const n of deletedNotes) {
        if (n.deletedAt !== null) await notesService.permanentDeleteNote(n.id);
      }
      for (const t of deletedTasks) {
        if (t.deletedAt !== null) await tasksService.permanentDeleteTask(t.id);
      }

      await refreshStorage();
    }
  };

  const handleClearSyncedOutbox = async () => {
    const cleared = await outboxService.clearSyncedOperations();
    await refreshStorage();
    alert(`Cleared ${cleared} synced outbox operations.`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="border-b border-[var(--color-border-primary)] pb-5">
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Application Settings
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Preferences, storage, and app configuration
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Appearance Section */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Appearance & Theme
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Customize theme interface for Daymark
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-4">
            <div>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                Interface Mode
              </span>
              <p className="text-xs text-[var(--color-text-muted)]">
                Currently running in {isDarkMode ? 'Dark' : 'Light'} theme
              </p>
            </div>
            <button
              onClick={() => handleThemeChange(isDarkMode ? 'light' : 'dark')}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-2xs transition hover:bg-[var(--color-bg-secondary)] cursor-pointer"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{isDarkMode ? 'Switch to Light' : 'Switch to Dark'}</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Task Preferences</h3>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-secondary)] pt-4">
            <div>
              <label htmlFor="default-task-sort" className="text-xs font-medium text-[var(--color-text-primary)]">Default task sorting</label>
              <p className="text-xs text-[var(--color-text-muted)]">Used when opening the Tasks page.</p>
            </div>
            <select id="default-task-sort" value={defaultTaskSort} onChange={(event) => void handleDefaultTaskSortChange(event.target.value)} className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3 py-2 text-xs text-[var(--color-text-primary)] outline-none cursor-pointer">
              <option value="createdAt">Created date</option>
              <option value="dueDate">Due date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
          </div>
          {preferenceError && <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">{preferenceError}</p>}
        </div>

        <BackupRestorePanel onRestoredPreferences={setDefaultTaskSort} />

        <LocalFolderSyncPanel />

        {/* Offline Storage & Sync Section */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Storage & Sync Queue
              </h3>
            </div>
            <button
              onClick={refreshStorage}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title="Refresh storage statistics"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            Primary database: <code className="font-mono text-[var(--color-accent)]">DaymarkDB</code>.
            {storageEstimate && (
              <span className="ml-1">
                Storage: <strong>{storageEstimate.usageFormatted}</strong> used of {storageEstimate.quotaFormatted}.
              </span>
            )}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--color-border-secondary)] pt-4">
            <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
              <span className="text-xs text-[var(--color-text-muted)]">Stored Notes</span>
              <div className="font-mono text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                {notes.length}
              </div>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
              <span className="text-xs text-[var(--color-text-muted)]">Stored Tasks</span>
              <div className="font-mono text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                {tasks.length}
              </div>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
              <span className="text-xs text-[var(--color-text-muted)]">Folders</span>
              <div className="font-mono text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                {folders.length}
              </div>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
              <span className="text-xs text-[var(--color-text-muted)]">Tags</span>
              <div className="font-mono text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                {tags.length}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--color-border-secondary)] pt-4">
            <div>
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Outbox Queue: {pendingOutboxCount} operation{pendingOutboxCount === 1 ? '' : 's'} awaiting remote acknowledgement
              </span>
              <p className="text-xs text-[var(--color-text-muted)]">
                V1 has no configured remote endpoint. Changes stay on this device until an adapter is configured.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearSyncedOutbox}
                className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer"
              >
                Clear Synced
              </button>
              <button
                onClick={() => setOutboxModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--color-accent-hover)] cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                Inspect Outbox
              </button>
            </div>
          </div>

          <div className="border-t border-[var(--color-border-secondary)] pt-3 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">
              Free up storage space by purging items from trash
            </span>
            <button
              onClick={handlePurgeTrash}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-950/60 dark:bg-red-950/40 dark:text-red-300 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Purge Trash
            </button>
          </div>
        </div>

        {/* PWA & Installation Status */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              PWA & Offline Cache
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Daymark precaches scripts, fonts, and stylesheets via Service Worker for offline launch
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-4">
            <div>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                App Installation Status
              </span>
              <p className="text-xs text-[var(--color-text-muted)]">
                {isInstalled ? 'Running in standalone window mode' : 'Running in browser window'}
              </p>
            </div>
            <div className="w-48">
              <PWAInstallButton />
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Keyboard Navigation
            </h3>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] p-2.5">
              <span className="text-[var(--color-text-secondary)]">Toggle Markdown Mode</span>
              <kbd className="rounded bg-[var(--color-bg-card)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-primary)] shadow-2xs border border-[var(--color-border-primary)]">
                Write / Split / Preview
              </kbd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] p-2.5">
              <span className="text-[var(--color-text-secondary)]">Auto-save Notes & Tasks</span>
              <kbd className="rounded bg-[var(--color-bg-card)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-primary)] shadow-2xs border border-[var(--color-border-primary)]">
                Debounced (400ms)
              </kbd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] p-2.5">
              <span className="text-[var(--color-text-secondary)]">Shortcuts help dialog</span>
              <button
                onClick={() => setShortcutsModalOpen(true)}
                className="rounded bg-[var(--color-bg-card)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-primary)] shadow-2xs border border-[var(--color-border-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer"
              >
                ? / Ctrl+/
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
