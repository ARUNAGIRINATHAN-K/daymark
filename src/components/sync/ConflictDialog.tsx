import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { Conflict } from '../../types';
import { conflictResolver } from '../../sync/conflictResolver';
import { ConflictComparison } from './ConflictComparison';

export const ConflictDialog: React.FC = () => {
  const conflicts = useLiveQuery(
    () => db.conflicts.filter((conflict) => !conflict.resolved).toArray(),
    [],
    [] as Conflict[]
  );
  const [visible, setVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merged, setMerged] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conflicts.length > 0) {
      setVisible(true);
      if (!selectedId || !conflicts.some((conflict) => conflict.id === selectedId)) setSelectedId(conflicts[0].id);
    } else {
      setVisible(false);
      setSelectedId(null);
    }
  }, [conflicts, selectedId]);

  const conflict = conflicts.find((item) => item.id === selectedId);
  if (!visible || !conflict) {
    if (conflicts.length === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[70] rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
        aria-label={`Review ${conflicts.length} unresolved sync conflicts`}
      >
        {conflicts.length} unresolved conflict{conflicts.length === 1 ? '' : 's'}
      </button>
    );
  }

  const resolve = async (strategy: 'local' | 'remote' | 'merged') => {
    try {
      setBusy(true);
      setError(null);
      await conflictResolver.resolve(conflict.id, strategy, strategy === 'merged' ? merged : undefined);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 id="conflict-dialog-title" className="text-lg font-semibold">Resolve sync conflict</h2>
            <p className="text-sm text-slate-500">{conflict.entityType} · {conflicts.length} unresolved</p>
          </div>
          <select
            aria-label="Select unresolved conflict"
            value={conflict.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="max-w-[55vw] rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {conflicts.map((item) => <option key={item.id} value={item.id}>{item.entityType}: {item.entityId}</option>)}
          </select>
        </header>
        <main className="overflow-y-auto p-4">
          <ConflictComparison conflict={conflict} onChange={setMerged} />
          {error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        </main>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button type="button" disabled={busy} onClick={() => setVisible(false)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Review later</button>
          <button type="button" disabled={busy} onClick={() => void resolve('local')} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 disabled:opacity-50 dark:text-indigo-300">Keep Local</button>
          <button type="button" disabled={busy} onClick={() => void resolve('remote')} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 disabled:opacity-50 dark:text-indigo-300">Keep Remote</button>
          <button type="button" disabled={busy} onClick={() => void resolve('merged')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Apply Manual Merge</button>
        </footer>
      </section>
    </div>
  );
};
