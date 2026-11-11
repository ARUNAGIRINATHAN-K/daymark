import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { notesService } from '../src/services/notes.service';
import { outboxService } from '../src/services/outboxService';
import { SyncManager } from '../src/sync/syncManager';
import { RetryManager } from '../src/sync/retryManager';
import { SyncQueue } from '../src/sync/syncQueue';
import { UnconfiguredSyncAdapter } from '../src/sync/syncAdapter';
import type { SyncOperation } from '../src/types';
import type { SyncAdapter } from '../src/sync/types';

const queue = new SyncQueue();

function operation(
  id: string,
  entityId: string,
  action: SyncOperation['action'],
  timestamp: number,
  payload: Record<string, unknown> = {}
): SyncOperation {
  return {
    id,
    entityType: 'note',
    entityId,
    action,
    payload,
    timestamp,
    synced: false,
    retryCount: 0,
    error: null,
  };
}

function configuredAdapter(
  pushOperations: SyncAdapter['pushOperations'],
  pullChanges: SyncAdapter['pullChanges'] = async () => ({ configured: true, changes: [], cursor: null })
): SyncAdapter {
  return {
    getStatus: () => ({ configured: true, message: 'Test adapter configured.' }),
    pushOperations,
    pullChanges,
  };
}

describe('Backend-independent sync infrastructure', () => {
  beforeEach(async () => {
    await db.outbox.clear();
    await db.settings.clear();
  });

  it('keeps outbox changes local and pending with the V1 unconfigured adapter', async () => {
    const note = await notesService.createNote({ title: 'Local only for now' });
    const result = await new SyncManager().runSync();
    const savedOperation = await db.outbox.where('entityId').equals(note.id).first();

    expect(new UnconfiguredSyncAdapter().getStatus()).toMatchObject({ configured: false });
    expect(result.status).toBe('unconfigured');
    expect(result.message).toContain('No remote sync endpoint');
    expect(savedOperation?.synced).toBe(false);
  });

  it('coalesces only safe adjacent pending update patches and retains the first idempotency key', async () => {
    await db.outbox.bulkAdd([
      operation('u1', 'note-1', 'update', 1, { title: 'First' }),
      operation('u2', 'note-1', 'update', 2, { content: 'Second' }),
      operation('d1', 'note-1', 'delete', 3),
    ]);

    const removed = await queue.coalescePendingUpdates();
    const remaining = await db.outbox.where('entityId').equals('note-1').sortBy('timestamp');

    expect(removed).toBe(1);
    expect(remaining.map((item) => item.id)).toEqual(['u1', 'd1']);
    expect(remaining[0].payload).toEqual({ title: 'First', content: 'Second' });
  });

  it('does not coalesce operations that were already processing', async () => {
    await db.outbox.bulkAdd([
      operation('u1', 'note-1', 'update', 1, { title: 'First' }),
      operation('u2', 'note-1', 'update', 2, { title: 'Second' }),
    ]);
    await queue.markProcessing(['u2'], 10);

    expect(await queue.coalescePendingUpdates()).toBe(0);
    expect(await db.outbox.where('entityId').equals('note-1').count()).toBe(2);
  });

  it('preserves per-entity order when an earlier operation is waiting for retry', async () => {
    await db.outbox.bulkAdd([
      operation('a1', 'entity-a', 'create', 1),
      operation('a2', 'entity-a', 'update', 2),
      operation('b1', 'entity-b', 'create', 3),
    ]);
    await queue.markFailed('a1', 'temporary', 1_000, 100);

    const beforeRetry = await queue.getRunnableBatch(10, 500);
    const afterRetry = await queue.getRunnableBatch(10, 1_000);

    expect(beforeRetry.map((item) => item.operation.id)).toEqual(['b1']);
    expect(afterRetry.map((item) => item.operation.id)).toEqual(['a1', 'b1']);
  });

  it('computes exponential retry delays with bounded jitter', () => {
    const retries = new RetryManager({ baseDelayMs: 1_000, maxDelayMs: 5_000, jitterRatio: 0.2, random: () => 1 });

    expect(retries.getDelay(1)).toBe(1_200);
    expect(retries.getDelay(2)).toBe(2_400);
    expect(retries.getDelay(3)).toBe(4_800);
    expect(retries.getDelay(4)).toBe(5_000);
    expect(retries.getNextRetryAt(1, 10)).toBe(1_210);
  });

  it('recovers persisted processing operations after a run is abandoned', async () => {
    await db.outbox.add(operation('stuck', 'entity-a', 'create', 1));
    await queue.markProcessing(['stuck'], 10);

    expect(await queue.recoverAbandonedProcessing(20)).toBe(1);
    expect((await queue.getQueueItems())[0]).toMatchObject({
      status: 'pending',
      lastError: expect.stringContaining('Recovered an interrupted'),
    });
  });

  it('recovers interrupted work on startup after the persisted run lease has expired', async () => {
    await db.outbox.add(operation('startup-stuck', 'entity-a', 'create', 1));
    await queue.markProcessing(['startup-stuck'], 10);
    await db.settings.put({
      key: 'sync-manager:run-lock',
      value: { ownerId: 'previous-page', expiresAt: Date.now() - 1 },
      updatedAt: Date.now(),
    });

    const recovered = await new SyncManager().recoverInterruptedProcessing();

    expect(recovered).toBe(1);
    expect((await queue.getQueueItems())[0].status).toBe('pending');
  });

  it('does not coalesce an update after recovery because it may have reached the server', async () => {
    await db.outbox.bulkAdd([
      operation('u1', 'note-1', 'update', 1, { title: 'First' }),
      operation('u2', 'note-1', 'update', 2, { title: 'Second' }),
    ]);
    await queue.markProcessing(['u1'], 10);
    await queue.recoverAbandonedProcessing(20);

    expect(await queue.coalescePendingUpdates()).toBe(0);
    expect(await db.outbox.where('entityId').equals('note-1').count()).toBe(2);
  });

  it('marks an operation complete only after an exact idempotency-key acknowledgement', async () => {
    await db.outbox.add(operation('ack-me', 'entity-a', 'create', 1));
    await queue.markProcessing(['ack-me']);
    expect(await queue.markAcknowledged('ack-me', { idempotencyKey: 'different-key', acknowledged: true, remoteRevision: 'server-r1' })).toBe(false);
    expect((await db.outbox.get('ack-me'))?.synced).toBe(false);

    expect(await queue.markAcknowledged('ack-me', { idempotencyKey: 'ack-me', acknowledged: true, remoteRevision: 'server-r1' })).toBe(true);
    expect((await db.outbox.get('ack-me'))?.synced).toBe(true);
    expect((await queue.getQueueItems())[0].status).toBe('completed');
  });

  it('updates entity sync status only after its final pending operation is acknowledged', async () => {
    const note = await notesService.createNote({ title: 'Awaiting acknowledgement' });
    const manager = new SyncManager(configuredAdapter(async (operations) => ({
      configured: true,
      acknowledgements: operations.map((item) => ({ idempotencyKey: item.id, acknowledged: true as const, remoteRevision: `server:${item.id}` })),
    })));

    expect((await db.notes.get(note.id))?.syncStatus).toBe('pending');
    const result = await manager.runSync();

    expect(result.acknowledged).toBe(1);
    expect((await db.notes.get(note.id))?.syncStatus).toBe('synced');
    const operation = await db.outbox.where('entityId').equals(note.id).first();
    expect((await db.settings.get(`sync-revision:note:${note.id}`))?.value).toMatchObject({
      remoteRevision: `server:${operation?.id}`,
      localVersion: note.version,
    });
  });

  it('records a retryable adapter failure and retains it in the queue', async () => {
    await db.outbox.add(operation('fail-me', 'entity-a', 'create', 1));
    const adapter = configuredAdapter(async () => ({
      configured: true,
      acknowledgements: [],
      failures: [{ idempotencyKey: 'fail-me', error: 'Temporary network failure', retryable: true }],
    }));
    const manager = new SyncManager(adapter, queue, new RetryManager({ random: () => 0 }));

    const result = await manager.runSync();
    const [item] = await queue.getQueueItems();

    expect(result.failed).toBe(1);
    expect(item).toMatchObject({ status: 'failed', nextRetryAt: expect.any(Number), lastError: 'Temporary network failure' });
    expect(item.operation.synced).toBe(false);
    manager.dispose();
  });

  it('clears acknowledged operations without discarding failed operations', async () => {
    await db.outbox.bulkAdd([
      operation('failed-row', 'entity-a', 'create', 1),
      { ...operation('completed-row', 'entity-b', 'create', 2), synced: true },
    ]);
    await queue.markFailed('failed-row', 'Keep this diagnostic', Date.now() + 10_000);

    expect(await outboxService.clearSyncedOperations()).toBe(1);
    expect(await db.outbox.get('completed-row')).toBeUndefined();
    expect((await db.outbox.get('failed-row'))?.error).toBe('Keep this diagnostic');
    expect((await queue.getQueueItems())[0].status).toBe('failed');
  });

  it('bounds batches and prevents another manager instance from running concurrently', async () => {
    await db.outbox.bulkAdd([
      operation('a1', 'entity-a', 'create', 1),
      operation('b1', 'entity-b', 'create', 2),
    ]);
    let releasePush: (() => void) | undefined;
    let pushStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { pushStarted = resolve; });
    const heldPush = new Promise<void>((resolve) => { releasePush = resolve; });
    const adapter = configuredAdapter(async (operations) => {
      pushStarted?.();
      await heldPush;
      return {
        configured: true,
        acknowledgements: operations.map((item) => ({ idempotencyKey: item.id, acknowledged: true as const, remoteRevision: `server:${item.id}` })),
      };
    });
    const firstManager = new SyncManager(adapter, queue);
    const secondManager = new SyncManager(adapter, queue);

    const firstRun = firstManager.runSync({ batchSize: 1 });
    await started;
    const secondRun = await secondManager.runSync();
    releasePush?.();
    const firstResult = await firstRun;

    expect(secondRun.status).toBe('already-running');
    expect(firstResult.attempted).toBe(1);
    expect(firstResult.deferred).toBe(1);
  });

  it('uses a unique, strictly ordered outbox timestamp for sequential entity changes', async () => {
    const note = await notesService.createNote({ title: 'Order check' });
    await notesService.updateNote(note.id, { title: 'Order check updated' });
    const operations = await db.outbox.where('entityId').equals(note.id).sortBy('timestamp');

    expect(operations).toHaveLength(2);
    expect(operations[1].timestamp).toBeGreaterThan(operations[0].timestamp);
    expect(operations[0].id).not.toBe(operations[1].id);
  });
});

