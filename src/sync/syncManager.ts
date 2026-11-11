import { db } from '../db/database';
import { generateId } from '../lib/utils';
import type { SyncOperation } from '../types';
import { RetryManager, retryManager } from './retryManager';
import { SyncQueue, syncQueue } from './syncQueue';
import { UnconfiguredSyncAdapter } from './syncAdapter';
import { conflictDetector, getAcceptedRevision, PULL_CURSOR_KEY } from './conflictDetector';
import type { PushOperationsResult, PushOperation, RemoteChange, SyncAdapter, SyncRunResult } from './types';

const RUN_LOCK_KEY = 'sync-manager:run-lock';
const RUN_LOCK_TTL_MS = 30_000;
const RUN_LOCK_HEARTBEAT_MS = 8_000;
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

interface RunLock {
  ownerId: string;
  expiresAt: number;
}

export interface SyncRunOptions {
  batchSize?: number;
  cursor?: string | null;
}

function isRunLock(value: unknown): value is RunLock {
  if (!value || typeof value !== 'object') return false;
  const lock = value as Partial<RunLock>;
  return typeof lock.ownerId === 'string' && typeof lock.expiresAt === 'number';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueOperations(operations: SyncOperation[]): SyncOperation[] {
  const seen = new Set<string>();
  return operations.filter((operation) => {
    if (seen.has(operation.id)) return false;
    seen.add(operation.id);
    return true;
  });
}

export class SyncManager {
  private running = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private recoveryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly adapter: SyncAdapter = new UnconfiguredSyncAdapter(),
    private readonly queue: SyncQueue = syncQueue,
    private readonly retries: RetryManager = retryManager
  ) {}

  getAdapterStatus() {
    return this.adapter.getStatus();
  }

  /** Recover an interrupted run at app startup without making network calls. */
  async recoverInterruptedProcessing(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    const ownerId = generateId();
    let ownsLock = false;
    try {
      ownsLock = await this.acquireRunLock(ownerId);
      if (!ownsLock) {
        this.scheduleRecoveryRetry();
        return 0;
      }
      if (this.recoveryTimer !== undefined) clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
      const recovered = await this.queue.recoverAbandonedProcessing();
      await this.scheduleNextRetry();
      return recovered;
    } finally {
      try {
        if (ownsLock) await this.releaseRunLock(ownerId);
      } finally {
        this.running = false;
      }
    }
  }

  async runSync(options: SyncRunOptions = {}): Promise<SyncRunResult> {
    if (this.running) return this.alreadyRunningResult();
    this.running = true;

    const ownerId = generateId();
    let ownsLock = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    try {
      ownsLock = await this.acquireRunLock(ownerId);
      if (!ownsLock) return this.alreadyRunningResult();
      if (this.recoveryTimer !== undefined) clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;

      heartbeat = setInterval(() => {
        void this.renewRunLock(ownerId).catch((error: unknown) => {
          console.error('Failed to renew local sync run lease:', error);
        });
      }, RUN_LOCK_HEARTBEAT_MS);

      await this.queue.recoverAbandonedProcessing();
      await this.queue.coalescePendingUpdates();
      const adapterStatus = this.adapter.getStatus();
      if (!adapterStatus.configured) {
        const deferred = await this.countUncompletedOperations();
        return this.result('unconfigured', adapterStatus.message, { deferred });
      }

      const requestedBatchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
      const batchSize = Number.isFinite(requestedBatchSize)
        ? Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(requestedBatchSize)))
        : DEFAULT_BATCH_SIZE;
      const batch = await this.queue.getRunnableBatch(batchSize);
      const operations = uniqueOperations(batch.map((item) => item.operation));
      let acknowledged = 0;
      let failed = 0;
      const now = Date.now();

      if (operations.length > 0) {
        await this.queue.markProcessing(operations.map((operation) => operation.id));
        const beforePush = new Map<string, { version: number; snapshot: Record<string, unknown> }>();
        const pushItems: PushOperation[] = [];
        for (const operation of operations) {
          const table = operation.entityType === 'note' ? db.notes : operation.entityType === 'task' ? db.tasks :
            operation.entityType === 'folder' ? db.folders : null;
          const entity = table ? await table.get(operation.entityId) as { version: number } & Record<string, unknown> | undefined : undefined;
          if (entity) beforePush.set(operation.id, { version: entity.version, snapshot: structuredClone(entity) });
          const baseline = await getAcceptedRevision(operation.entityType, operation.entityId);
          pushItems.push({ ...operation, expectedRemoteRevision: baseline?.remoteRevision ?? null });
        }

        let pushResult: PushOperationsResult | undefined;
        try {
          pushResult = await this.adapter.pushOperations(pushItems);
        } catch (error: unknown) {
          const message = errorMessage(error);
          await this.failBatch(operations, message);
          failed = operations.length;
        }

        if (pushResult && !pushResult.configured) {
          await Promise.all(operations.map((operation) => this.queue.markPending(operation.id, pushResult.message)));
        } else if (pushResult?.configured) {
          const acknowledgements = new Map(pushResult.acknowledgements.map((ack) => [ack.idempotencyKey, ack] as const));
          const failures = new Map((pushResult.failures ?? []).map((failure) => [failure.idempotencyKey, failure] as const));
          for (const operation of operations) {
            const acknowledgement = acknowledgements.get(operation.id);
            const captured = beforePush.get(operation.id);
            if (acknowledgement) {
              const accepted = captured ? {
                localVersion: captured.version,
                snapshot: captured.snapshot,
                remoteRevision: acknowledgement.remoteRevision,
              } : ['note', 'task', 'folder'].includes(operation.entityType) ? {
                localVersion: null,
                snapshot: operation.payload,
                remoteRevision: acknowledgement.remoteRevision,
              } : undefined;
              if (await this.queue.markAcknowledged(operation.id, acknowledgement, now, accepted)) {
                acknowledged += 1;
              } else {
                await this.queue.markFailed(
                  operation.id,
                  'The adapter acknowledgement was invalid or did not include a server revision.',
                  this.retries.getNextRetryAt(operation.retryCount + 1, now),
                  now
                );
                failed += 1;
              }
              continue;
            }
            const failure = failures.get(operation.id);
            const message = failure?.error ?? 'The remote adapter did not acknowledge this operation or return its server revision.';
            await this.queue.markFailed(operation.id, message,
              failure?.retryable === false ? Number.MAX_SAFE_INTEGER : this.retries.getNextRetryAt(operation.retryCount + 1, now), now);
            failed += 1;
          }
        }
      }

      let changes: RemoteChange[] = [];
      let pullError: string | undefined;
      let conflictCount = 0;
      try {
        const savedCursor = await db.settings.get(PULL_CURSOR_KEY);
        const cursor = options.cursor ?? (typeof savedCursor?.value === 'string' ? savedCursor.value : null);
        const pullResult = await this.adapter.pullChanges(cursor);
        if (pullResult.configured) {
          changes = pullResult.changes;
          const processed = await conflictDetector.processChanges(changes, pullResult.cursor);
          conflictCount = processed.conflicts;
          if (processed.deferred > 0) pullError = `Deferred ${processed.deferred} remote change(s) until revision lineage or conflict resolution is available.`;
        } else {
          pullError = pullResult.message;
        }
      } catch (error: unknown) {
        pullError = errorMessage(error);
      }

      const deferred = await this.countUncompletedOperations();
      const status = failed > 0 || deferred > 0 || pullError || conflictCount > 0 ? 'partial' : 'completed';
      const message = pullError
        ? `Push completed with ${acknowledged} acknowledgement(s); pull needs attention: ${pullError}`
        : conflictCount > 0
          ? `Sync batch finished with ${conflictCount} conflict(s) requiring explicit resolution.`
          : `Sync batch finished: ${acknowledged} acknowledged, ${failed} failed.`;

      await this.scheduleNextRetry();

      return this.result(status, message, {
        attempted: operations.length,
        acknowledged,
        failed,
        deferred,
        changes,
        conflicts: conflictCount,
        ...(pullError ? { pullError } : {}),
      });
    } finally {
      if (heartbeat !== undefined) clearInterval(heartbeat);
      try {
        if (ownsLock) await this.releaseRunLock(ownerId);
      } finally {
        this.running = false;
      }
    }
  }

  private async failBatch(operations: SyncOperation[], message: string): Promise<void> {
    const now = Date.now();
    await Promise.all(operations.map((operation) =>
      this.queue.markFailed(
        operation.id,
        message,
        this.retries.getNextRetryAt(operation.retryCount + 1, now),
        now
      )
    ));
  }

  private async countUncompletedOperations(): Promise<number> {
    const items = await this.queue.getQueueItems();
    return items.filter((item) => !item.operation.synced && !item.superseded).length;
  }

  private async scheduleNextRetry(): Promise<void> {
    if (!this.adapter.getStatus().configured) return;
    const items = await this.queue.getQueueItems();
    const retryTimes = items
      .filter((item) => !item.superseded && item.status === 'failed' && item.nextRetryAt !== null && item.nextRetryAt < Number.MAX_SAFE_INTEGER)
      .map((item) => item.nextRetryAt as number);
    if (retryTimes.length === 0) {
      if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      return;
    }

    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    const delay = Math.max(0, Math.min(...retryTimes) - Date.now());
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.runSync().catch((error: unknown) => {
        console.error('Scheduled sync retry failed:', error);
      });
    }, delay);
  }

  /** Clear the in-memory timer, for controlled app teardown and tests. */
  dispose(): void {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    if (this.recoveryTimer !== undefined) clearTimeout(this.recoveryTimer);
    this.retryTimer = undefined;
    this.recoveryTimer = undefined;
  }

  private scheduleRecoveryRetry(): void {
    if (this.recoveryTimer !== undefined) return;
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = undefined;
      void this.recoverInterruptedProcessing().catch((error: unknown) => {
        console.error('Failed to recover interrupted sync operations:', error);
      });
    }, RUN_LOCK_TTL_MS + 100);
  }

  private async acquireRunLock(ownerId: string): Promise<boolean> {
    return db.transaction('rw', db.settings, async () => {
      const setting = await db.settings.get(RUN_LOCK_KEY);
      if (isRunLock(setting?.value) && setting.value.expiresAt > Date.now()) return false;
      const now = Date.now();
      await db.settings.put({
        key: RUN_LOCK_KEY,
        value: { ownerId, expiresAt: now + RUN_LOCK_TTL_MS } satisfies RunLock,
        updatedAt: now,
      });
      return true;
    });
  }

  private async renewRunLock(ownerId: string): Promise<void> {
    await db.transaction('rw', db.settings, async () => {
      const setting = await db.settings.get(RUN_LOCK_KEY);
      if (!isRunLock(setting?.value) || setting.value.ownerId !== ownerId) return;
      const now = Date.now();
      await db.settings.put({
        ...setting,
        value: { ownerId, expiresAt: now + RUN_LOCK_TTL_MS } satisfies RunLock,
        updatedAt: now,
      });
    });
  }

  private async releaseRunLock(ownerId: string): Promise<void> {
    await db.transaction('rw', db.settings, async () => {
      const setting = await db.settings.get(RUN_LOCK_KEY);
      if (isRunLock(setting?.value) && setting.value.ownerId === ownerId) {
        await db.settings.delete(RUN_LOCK_KEY);
      }
    });
  }

  private alreadyRunningResult(): SyncRunResult {
    return this.result('already-running', 'A sync run is already in progress in this browser context.');
  }

  private result(
    status: SyncRunResult['status'],
    message: string,
    values: Partial<Omit<SyncRunResult, 'status' | 'message'>> = {}
  ): SyncRunResult {
    return {
      status,
      message,
      attempted: values.attempted ?? 0,
      acknowledged: values.acknowledged ?? 0,
      failed: values.failed ?? 0,
      deferred: values.deferred ?? 0,
      changes: values.changes ?? [],
      ...(values.pullError ? { pullError: values.pullError } : {}),
      ...(values.conflicts !== undefined ? { conflicts: values.conflicts } : {}),
    };
  }
}

export const syncManager = new SyncManager();

