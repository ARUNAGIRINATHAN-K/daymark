import { db } from '../db/database';
import type { AppSetting, SyncOperation } from '../types';
import type { PersistedSyncState, PushAcknowledgement, SyncOperationStatus, SyncQueueItem } from './types';

export const SYNC_STATE_KEY_PREFIX = 'sync-operation-state:';
export const SYNC_SUPERSEDED_KEY_PREFIX = 'sync-operation-superseded:';

function stateKey(operationId: string): string {
  return `${SYNC_STATE_KEY_PREFIX}${operationId}`;
}

function compareOperations(a: SyncOperation, b: SyncOperation): number {
  return a.timestamp - b.timestamp || a.id.localeCompare(b.id);
}

function fallbackStatus(operation: SyncOperation): SyncOperationStatus {
  if (operation.synced) return 'completed';
  if (operation.error || operation.retryCount > 0) return 'failed';
  return 'pending';
}

function isPersistedSyncState(value: unknown): value is PersistedSyncState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<PersistedSyncState>;
  return (
    typeof state.operationId === 'string' &&
    ['pending', 'processing', 'failed', 'completed'].includes(state.status ?? '') &&
    typeof state.attemptCount === 'number'
  );
}

export class SyncQueue {
  async getQueueItems(): Promise<SyncQueueItem[]> {
    const [operations, settings] = await Promise.all([
      db.outbox.toArray(),
      db.settings.toArray(),
    ]);
    const stateByKey = new Map(settings.map((setting) => [setting.key, setting.value] as const));

    return operations.sort(compareOperations).map((operation) => {
      const value = stateByKey.get(stateKey(operation.id));
      const state = isPersistedSyncState(value) ? value : undefined;
      const supersededValue = stateByKey.get(`${SYNC_SUPERSEDED_KEY_PREFIX}${operation.id}`);
      const superseded = Boolean(supersededValue && typeof supersededValue === 'object' &&
        (supersededValue as { superseded?: unknown }).superseded === true);
      return {
        operation,
        status: operation.synced ? 'completed' : state?.status ?? fallbackStatus(operation),
        attemptCount: state?.attemptCount ?? operation.retryCount,
        nextRetryAt: state?.nextRetryAt ?? null,
        lastError: state?.lastError ?? operation.error ?? null,
        superseded,
      };
    });
  }

  /**
   * Merge adjacent, never-attempted update patches for the same entity. The
   * first operation ID is retained as the stable idempotency key. Create and
   * delete actions, failed attempts, and processing operations are barriers.
   */
  async coalescePendingUpdates(): Promise<number> {
    return db.transaction('rw', [db.outbox, db.settings], async () => {
      const operations = (await db.outbox.toArray()).sort(compareOperations);
      const stateSettings = await db.settings.toArray();
      const stateByKey = new Map(stateSettings.map((setting) => [setting.key, setting.value] as const));
      const byEntity = new Map<string, SyncOperation[]>();
      for (const operation of operations) {
        const key = `${operation.entityType}:${operation.entityId}`;
        const group = byEntity.get(key) ?? [];
        group.push(operation);
        byEntity.set(key, group);
      }

      let removed = 0;
      for (const group of byEntity.values()) {
        let index = 0;
        while (index < group.length) {
          const first = group[index];
          if (!this.isSafePendingUpdate(first, stateByKey.get(stateKey(first.id)), stateByKey.get(`${SYNC_SUPERSEDED_KEY_PREFIX}${first.id}`))) {
            index += 1;
            continue;
          }

          const run: SyncOperation[] = [first];
          let next = index + 1;
          while (
            next < group.length &&
            this.isSafePendingUpdate(group[next], stateByKey.get(stateKey(group[next].id)), stateByKey.get(`${SYNC_SUPERSEDED_KEY_PREFIX}${group[next].id}`))
          ) {
            run.push(group[next]);
            next += 1;
          }

          if (run.length > 1) {
            const mergedPayload = Object.assign({}, ...run.map((operation) => operation.payload));
            await db.outbox.update(first.id, { payload: mergedPayload });
            const duplicateIds = run.slice(1).map((operation) => operation.id);
            await db.outbox.bulkDelete(duplicateIds);
            await db.settings.bulkDelete(duplicateIds.map(stateKey));
            removed += duplicateIds.length;
          }
          index = next;
        }
      }
      return removed;
    });
  }

  async recoverAbandonedProcessing(now = Date.now()): Promise<number> {
    return db.transaction('rw', [db.outbox, db.settings], async () => {
      const settings = await db.settings.toArray();
      let recovered = 0;
      for (const setting of settings) {
        if (!setting.key.startsWith(SYNC_STATE_KEY_PREFIX) || !isPersistedSyncState(setting.value)) continue;
        const state = setting.value;
        if (state.status !== 'processing') continue;

        const operation = await db.outbox.get(state.operationId);
        if (!operation || operation.synced) continue;
        await this.putState({
          ...state,
          status: 'pending',
          processingStartedAt: null,
          nextRetryAt: null,
          lastError: 'Recovered an interrupted sync attempt; safe to retry with the same idempotency key.',
          updatedAt: now,
        });
        recovered += 1;
      }
      return recovered;
    });
  }

  async getRunnableBatch(limit: number, now = Date.now()): Promise<SyncQueueItem[]> {
    const items = await this.getQueueItems();
    const batchLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 20;
    const seenEntities = new Set<string>();
    const batch: SyncQueueItem[] = [];

    for (const item of items) {
      const operation = item.operation;
      if (operation.synced || item.superseded) continue;
      const entityKey = `${operation.entityType}:${operation.entityId}`;
      if (seenEntities.has(entityKey)) continue;
      seenEntities.add(entityKey);

      if (item.status === 'pending' || (item.status === 'failed' && (item.nextRetryAt ?? 0) <= now)) {
        batch.push(item);
        if (batch.length >= batchLimit) break;
      }
    }
    return batch;
  }

  async markProcessing(operationIds: string[], now = Date.now()): Promise<void> {
    await db.transaction('rw', [db.outbox, db.settings], async () => {
      for (const operationId of operationIds) {
        const operation = await db.outbox.get(operationId);
        if (!operation || operation.synced) continue;
        const current = await this.getState(operationId);
        await this.putState({
          operationId,
          status: 'processing',
          attemptCount: current?.attemptCount ?? operation.retryCount,
          nextRetryAt: null,
          processingStartedAt: now,
          lastError: current?.lastError ?? operation.error ?? null,
          updatedAt: now,
        });
      }
    });
  }

  async markPending(operationId: string, message?: string, now = Date.now()): Promise<void> {
    await db.transaction('rw', [db.outbox, db.settings], async () => {
      const operation = await db.outbox.get(operationId);
      if (!operation || operation.synced) return;
      const current = await this.getState(operationId);
      await this.putState({
        operationId,
        status: 'pending',
        attemptCount: current?.attemptCount ?? operation.retryCount,
        nextRetryAt: null,
        processingStartedAt: null,
        lastError: message ?? current?.lastError ?? null,
        updatedAt: now,
      });
    });
  }

  async markFailed(operationId: string, error: string, nextRetryAt: number, now = Date.now()): Promise<void> {
    await db.transaction('rw', [db.outbox, db.settings], async () => {
      const operation = await db.outbox.get(operationId);
      if (!operation || operation.synced) return;
      const attemptCount = operation.retryCount + 1;
      await db.outbox.update(operationId, { retryCount: attemptCount, error });
      await this.putState({
        operationId,
        status: 'failed',
        attemptCount,
        nextRetryAt,
        processingStartedAt: null,
        lastError: error,
        updatedAt: now,
      });
    });
  }

  /** Called by SyncManager only after it receives an adapter acknowledgement. */
  async markAcknowledged(
    operationId: string,
    acknowledgement: PushAcknowledgement,
    now = Date.now(),
    accepted?: { remoteRevision: string; localVersion: number | null; snapshot: Record<string, unknown> }
  ): Promise<boolean> {
    if (acknowledgement.acknowledged !== true || acknowledgement.idempotencyKey !== operationId ||
        typeof acknowledgement.remoteRevision !== 'string' || acknowledgement.remoteRevision.length === 0) return false;

    return db.transaction(
      'rw',
      [db.notes, db.tasks, db.folders, db.outbox, db.settings],
      async () => {
        const operation = await db.outbox.get(operationId);
        if (!operation || operation.synced) return false;
        const supersededSetting = await db.settings.get(`${SYNC_SUPERSEDED_KEY_PREFIX}${operationId}`);
        const isSuperseded = Boolean(supersededSetting && typeof supersededSetting.value === 'object' &&
          (supersededSetting.value as { superseded?: unknown }).superseded === true);
        const current = await this.getState(operationId);
        await db.outbox.update(operationId, { synced: true, error: null });
        const laterOperations = await db.outbox
          .filter((candidate) =>
            candidate.entityType === operation.entityType &&
            candidate.entityId === operation.entityId &&
            !candidate.synced
          )
          .count();
        if (laterOperations === 0 && !isSuperseded) await this.markEntitySynced(operation);
        if (accepted && !isSuperseded) {
          await db.settings.put({
            key: `sync-revision:${operation.entityType}:${operation.entityId}`,
            value: { remoteRevision: acknowledgement.remoteRevision, localVersion: accepted.localVersion, snapshot: accepted.snapshot },
            updatedAt: now,
          });
        }
        await this.putState({
          operationId,
          status: 'completed',
          attemptCount: current?.attemptCount ?? operation.retryCount,
          nextRetryAt: null,
          processingStartedAt: null,
          lastError: null,
          updatedAt: now,
        });
        return true;
      }
    );
  }

  private isSafePendingUpdate(operation: SyncOperation, persistedState: unknown, supersededState: unknown): boolean {
    if (operation.synced || operation.action !== 'update' || operation.retryCount > 0 || operation.error) return false;
    if (supersededState && typeof supersededState === 'object' &&
        (supersededState as { superseded?: unknown }).superseded === true) return false;
    // Only updates that have never entered a sync attempt may be coalesced.
    if (!isPersistedSyncState(persistedState)) return true;
    return persistedState.status === 'pending' && persistedState.attemptCount === 0 && persistedState.lastError === null;
  }

  private async getState(operationId: string): Promise<PersistedSyncState | undefined> {
    const setting = await db.settings.get(stateKey(operationId));
    return setting && isPersistedSyncState(setting.value) ? setting.value : undefined;
  }

  private async putState(state: PersistedSyncState): Promise<void> {
    const setting: AppSetting = {
      key: stateKey(state.operationId),
      value: state,
      updatedAt: state.updatedAt,
    };
    await db.settings.put(setting);
  }

  private async markEntitySynced(operation: SyncOperation): Promise<void> {
    switch (operation.entityType) {
      case 'note':
        await db.notes.update(operation.entityId, { syncStatus: 'synced' });
        break;
      case 'task':
        await db.tasks.update(operation.entityId, { syncStatus: 'synced' });
        break;
      case 'folder':
        await db.folders.update(operation.entityId, { syncStatus: 'synced' });
        break;
      // Tag has no syncStatus field; settings are operation metadata, not entities.
      case 'tag':
      case 'setting':
        break;
    }
  }
}

export const syncQueue = new SyncQueue();

