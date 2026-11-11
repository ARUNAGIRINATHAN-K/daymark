import { db } from '../db/database';
import { generateId } from '../lib/utils';
import type { OutboxOperation } from '../types';

export class OutboxService {
  /**
   * Helper to create an outbox record within an active transaction or standalone
   */
  async createOperationRecord(
    entityType: OutboxOperation['entityType'],
    entityId: string,
    action: OutboxOperation['action'],
    payload: Record<string, unknown>
  ): Promise<OutboxOperation> {
    // Allocate a strictly increasing timestamp while the caller's transaction
    // holds the outbox store. This gives same-entity operations a durable order
    // without adding a field or index to the existing SyncOperation schema.
    const latest = await db.outbox.orderBy('timestamp').last();
    const timestamp = Math.max(Date.now(), (latest?.timestamp ?? 0) + 1);
    return {
      id: generateId(),
      entityType,
      entityId,
      action,
      payload,
      timestamp,
      synced: false,
      retryCount: 0,
      error: null,
    };
  }

  /**
   * Query all outbox operations sorted chronologically
   */
  async getAllOperations(): Promise<OutboxOperation[]> {
    return db.outbox.orderBy('timestamp').reverse().toArray();
  }

  /**
   * Query only pending unsynced operations
   */
  async getPendingOperations(): Promise<OutboxOperation[]> {
    return db.outbox.filter((op) => !op.synced).toArray();
  }

  /**
   * Query pending operations count
   */
  async getPendingCount(): Promise<number> {
    return db.outbox.filter((op) => !op.synced).count();
  }

  /**
   * Clear operations that have already been marked as synced
   */
  async clearSyncedOperations(): Promise<number> {
    return db.transaction('rw', [db.outbox, db.settings], async () => {
      const synced = await db.outbox.filter((op) => op.synced).toArray();
      const ids = synced.map((operation) => operation.id);
      await db.outbox.bulkDelete(ids);
      await db.settings.bulkDelete(ids.flatMap((id) => [
        `sync-operation-state:${id}`,
        `sync-operation-superseded:${id}`,
      ]));
      return ids.length;
    });
  }
}

export const outboxService = new OutboxService();
