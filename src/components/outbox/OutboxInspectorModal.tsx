import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, Trash2, X, Zap } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { outboxService } from '../../services/outboxService';
import { syncManager } from '../../sync/syncManager';
import { syncQueue } from '../../sync/syncQueue';
import { useAppStore } from '../../store/useAppStore';

export const OutboxInspectorModal: React.FC = () => {
  const { isOutboxModalOpen, setOutboxModalOpen } = useAppStore();
  const queueItems = useLiveQuery(() => syncQueue.getQueueItems(), []) ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  if (!isOutboxModalOpen) return null;

  const activeQueueItems = queueItems.filter((item) => !item.superseded);
  const pendingCount = activeQueueItems.filter((item) => item.status === 'pending').length;
  const processingCount = activeQueueItems.filter((item) => item.status === 'processing').length;
  const failedCount = activeQueueItems.filter((item) => item.status === 'failed').length;
  const completedCount = activeQueueItems.filter((item) => item.status === 'completed').length;
  const unconfiguredMessage = syncManager.getAdapterStatus().message;

  const handleRunSync = async () => {
    try {
      setIsProcessing(true);
      const result = await syncManager.runSync();
      setRunMessage(result.message);
    } catch (error: unknown) {
      setRunMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearSynced = async () => {
    try {
      setIsProcessing(true);
      await outboxService.clearSyncedOperations();
      setRunMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Transactional Outbox Inspector
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Only operations in this queue are candidates for remote sync; other records remain local to this device.
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{unconfiguredMessage}</p>
          </div>
          <button
            onClick={() => setOutboxModalOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar & Telemetry stats */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <strong className="font-mono tabular-nums">{pendingCount}</strong> Pending
            </span>
            <span className="text-blue-600 dark:text-blue-400"><strong className="font-mono tabular-nums">{processingCount}</strong> Processing</span>
            <span className="text-red-600 dark:text-red-400"><strong className="font-mono tabular-nums">{failedCount}</strong> Failed</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <strong className="font-mono tabular-nums">{completedCount}</strong> Server Acknowledged
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSync}
              disabled={isProcessing || (pendingCount === 0 && failedCount === 0)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              Run Sync
            </button>
            <button
              onClick={handleClearSynced}
              disabled={isProcessing || completedCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              Clear Synced
            </button>
          </div>
        </div>

        {/* Operations List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {runMessage && (
            <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{runMessage}</span>
            </div>
          )}

          {queueItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RefreshCw className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                Outbox queue is empty.
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Create or edit a note or task to see transactional operations recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {queueItems.map(({ operation: op, status, nextRetryAt, lastError, attemptCount }) => {
                const isExpanded = expandedId === op.id;
                const actionColor =
                  op.action === 'create'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
                    : op.action === 'update'
                    ? 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800/60 dark:text-indigo-300'
                    : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300';

                return (
                  <div
                    key={op.id}
                    className="rounded-xl border border-slate-200 bg-white transition dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : op.id)}
                      className="flex w-full items-center justify-between p-3 text-left text-xs transition hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${actionColor}`}
                        >
                          {op.action}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {op.entityType}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {op.entityId.substring(0, 16)}...
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {format(op.timestamp, 'HH:mm:ss')}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                          status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' :
                          status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                        {queueItems.find((item) => item.operation.id === op.id)?.superseded ? 'Superseded (retained)' : status === 'completed' ? 'Server Acknowledged' : status}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/80 p-3 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                        <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Operation ID: {op.id}</span>
                          <span>Timestamp: {new Date(op.timestamp).toISOString()}</span>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                          <span>Idempotency key: {op.id}</span>
                          <span>Attempts: {attemptCount}</span>
                          {nextRetryAt !== null && <span>Next retry: {format(nextRetryAt, 'yyyy-MM-dd HH:mm:ss')}</span>}
                        </div>
                        {lastError && <p className="mb-2 whitespace-pre-wrap text-red-600 dark:text-red-300">{lastError}</p>}
                        <pre className="max-h-48 overflow-x-auto rounded-lg bg-white p-2.5 dark:bg-slate-950">
                          {JSON.stringify(op.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 dark:border-slate-800">
          <button
            onClick={() => setOutboxModalOpen(false)}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
