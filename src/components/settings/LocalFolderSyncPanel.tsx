import React, { useRef, useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import {
  isLocalFolderSyncSupported,
  LOCAL_FOLDER_UNSUPPORTED_MESSAGE,
  LocalFolderSyncAdapter,
} from '../../sync/adapters/localFolderAdapter';
import { SyncManager } from '../../sync/syncManager';

export const LocalFolderSyncPanel: React.FC = () => {
  const supported = isLocalFolderSyncSupported();
  const adapterRef = useRef<LocalFolderSyncAdapter | null>(null);
  const [configured, setConfigured] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChooseFolder = async () => {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const adapter = adapterRef.current ?? new LocalFolderSyncAdapter();
      const status = await adapter.selectFolder(passphrase);
      adapterRef.current = adapter;
      setConfigured(status.configured);
      setFolderName(status.configured ? adapter.getStatus().message : null);
      setMessage(status.configured ? status.message : null);
      if (!status.configured) setError(status.message);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    const adapter = adapterRef.current;
    if (!adapter || !adapter.getStatus().configured) return;
    try {
      setBusy(true);
      setError(null);
      setMessage(null);
      const result = await new SyncManager(adapter).runSync();
      setMessage(result.message);
      if (result.status === 'partial' || result.status === 'unconfigured') {
        setError(result.pullError ?? result.message);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Local Folder Sync (Encrypted Backup)</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Pick a folder on this device with the browser&apos;s folder picker. Backups are written there as a single
        AES-256-GCM encrypted file (key derived from your passphrase via PBKDF2-SHA-256). The passphrase is kept in
        memory only and never stored or uploaded; without it the folder file cannot be read. Nothing is sent to any server.
      </p>

      {!supported && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {LOCAL_FOLDER_UNSUPPORTED_MESSAGE}
        </p>
      )}

      {supported && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label htmlFor="local-folder-passphrase" className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Backup passphrase
          </label>
          <input
            id="local-folder-passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Required to encrypt the folder backup"
            autoComplete="off"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            disabled={busy || !passphrase}
            onClick={() => void handleChooseFolder()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {configured ? 'Choose Different Folder' : 'Choose Folder…'}
          </button>
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void handleSyncNow()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {busy ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      )}

      {configured && folderName && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Connected: {folderName}</p>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p>
      )}
    </section>
  );
};
