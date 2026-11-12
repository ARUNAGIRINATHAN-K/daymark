import React, { useMemo, useRef, useState } from 'react';
import { backupService, type DuplicateChoice, type DuplicateChoices, type ImportPreview } from '../../services/backup.service';
import { createJsonDownloadFilename, downloadJsonFile } from '../../utils/export.utils';
import { useAppStore } from '../../store/useAppStore';
import type { TaskSortBy } from '../../schemas/settings.schema';

export const BackupRestorePanel: React.FC<{ onRestoredPreferences?: (sortBy: TaskSortBy) => void }> = ({ onRestoredPreferences }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const setTheme = useAppStore((state) => state.setTheme);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<DuplicateChoices>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unresolvedChoices = useMemo(() => preview?.duplicates.filter((item) =>
    choices[`${item.entityType}:${item.id}`] !== 'keep-existing' &&
    choices[`${item.entityType}:${item.id}`] !== 'replace'
  ).length ?? 0, [preview, choices]);

  const handleDownload = async () => {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const json = await backupService.createBackupJson();
      downloadJsonFile(createJsonDownloadFilename('daymark-backup'), json);
      setMessage('Backup exported. Keep the downloaded JSON file somewhere safe.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const nextPreview = await backupService.previewImport(await file.text());
      setPreview(nextPreview);
      setChoices({});
    } catch (reason: unknown) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!preview) return;
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const result = await backupService.restoreBackup(preview, choices);
      setTheme(result.preferences.theme);
      onRestoredPreferences?.(result.preferences.defaultTaskSortBy);
      setPreview(null);
      setChoices({});
      setMessage(
        `Restore complete: ${result.added} added, ${result.replaced} replaced, ${result.kept} kept, ` +
        `${result.importedOperations} outbox operation(s) imported, ${result.skippedOperations} skipped.`
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const choose = (key: string, value: string) => {
    if (value !== 'keep-existing' && value !== 'replace') return;
    setChoices((current) => ({ ...current, [key]: value as DuplicateChoice }));
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <DatabaseIcon />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Backup & Restore</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Export a versioned JSON backup or preview a restore before writing anything to this device.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" disabled={busy} onClick={() => void handleDownload()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
          Download Backup
        </button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
          Choose Backup File
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={(event) => void handleFile(event)} className="hidden" aria-label="Choose a Daymark backup JSON file" />
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Version 1 includes all notes, tasks, folders, tags, theme/task-sort preferences, and unsynced outbox operations. It excludes secrets, resolved or unresolved conflicts, remote revision baselines, cursors, and retry history. Only version 1 Daymark backups are supported.
      </p>

      {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p>}

      {preview && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-semibold">Import preview</h4>
            <p className="mt-1 text-xs text-slate-500">No records have been changed. Existing rows are preserved unless you explicitly choose Replace.</p>
            <p className="mt-2 text-xs">
              New records: {preview.newCounts.note} notes, {preview.newCounts.task} tasks, {preview.newCounts.folder} folders, {preview.newCounts.tag} tags. {preview.duplicates.length} existing-ID duplicate(s). {preview.outboxCount} unsynced outbox operation(s).
            </p>
          </div>

          {preview.duplicates.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-semibold">Choose an action for every duplicate</p>
              {preview.duplicates.map((duplicate) => {
                const key = `${duplicate.entityType}:${duplicate.id}`;
                return (
                  <label key={key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">{duplicate.entityType}: {duplicate.label} <span className="text-slate-400">({duplicate.id})</span></span>
                    <select aria-label={`Restore choice for ${duplicate.entityType} ${duplicate.label}`} value={choices[key] ?? ''} onChange={(event) => choose(key, event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                      <option value="" disabled>Choose…</option>
                      <option value="keep-existing">Keep Existing</option>
                      <option value="replace">Replace</option>
                    </select>
                  </label>
                );
              })}
            </div>
          )}

          {preview.operationConflicts.length > 0 && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
              Restore is blocked: {preview.operationConflicts.length} outbox operation ID(s) match different local operations.
            </p>
          )}
          {preview.skippedOrphanOperationIds.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {preview.skippedOrphanOperationIds.length} operation(s) for deleted backup records will be skipped because the target device currently has that entity.
            </p>
          )}
          {preview.exactExistingOperationIds.length > 0 && (
            <p className="text-xs text-slate-500">{preview.exactExistingOperationIds.length} identical operation(s) already exist and will not be duplicated.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || unresolvedChoices > 0 || preview.operationConflicts.length > 0} onClick={() => void handleRestore()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              {busy ? 'Restoring…' : 'Restore Selected Data'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setPreview(null); setChoices({}); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
};

const DatabaseIcon: React.FC = () => <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded border border-indigo-400 text-[10px] font-bold text-indigo-500">DB</span>;
