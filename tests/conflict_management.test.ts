import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { notesService } from '../src/services/notes.service';
import { SyncManager } from '../src/sync/syncManager';
import { SyncQueue } from '../src/sync/syncQueue';
import { ConflictDetector, conflictContextKey, revisionKey } from '../src/sync/conflictDetector';
import { ConflictResolver } from '../src/sync/conflictResolver';
import type { RemoteChange, SyncAdapter } from '../src/sync/types';

const detector = new ConflictDetector();
const resolver = new ConflictResolver();
const queue = new SyncQueue();

function change(entityId: string, remoteRevision: string, baseRemoteRevision: string | null, payload: Record<string, unknown>): RemoteChange {
  return { entityType: 'note', entityId, action: 'update', payload, remoteRevision, baseRemoteRevision, timestamp: 1 };
}

function adapter(pullChanges: SyncAdapter['pullChanges']): SyncAdapter {
  return {
    getStatus: () => ({ configured: true, message: 'Controlled test adapter.' }),
    pushOperations: async () => ({ configured: true, acknowledgements: [] }),
    pullChanges,
  };
}

describe('version based conflict management', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.notes, db.tasks, db.folders, db.conflicts, db.outbox, db.settings], async () => {
      await db.notes.clear();
      await db.tasks.clear();
      await db.folders.clear();
      await db.conflicts.clear();
      await db.outbox.clear();
      await db.settings.clear();
    });
  });

  it('applies a clean remote snapshot and persists opaque revision and pull cursor', async () => {
    const result = await detector.processChanges([
      change('remote-note', 'rev:opaque-2', null, {
        id: 'remote-note', title: 'From server', content: 'body', createdAt: 10, updatedAt: 20,
        deletedAt: null, version: 999, syncStatus: 'pending', tagIds: [], isPinned: false, isArchived: false,
      }),
    ], 'cursor:two');

    expect(result).toMatchObject({ applied: 1, conflicts: 0, deferred: 0, cursorAdvanced: true });
    expect(await db.notes.get('remote-note')).toMatchObject({ title: 'From server', version: 1, syncStatus: 'synced' });
    expect((await db.settings.get(revisionKey('note', 'remote-note')))?.value).toMatchObject({ remoteRevision: 'rev:opaque-2', localVersion: 1 });
    expect((await db.settings.get('sync-pull:cursor'))?.value).toBe('cursor:two');
  });

  it('captures local and remote snapshots when the local entity version diverged, regardless of timestamps', async () => {
    const note = await notesService.createNote({ title: 'Local before' });
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'rev:one', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    await notesService.updateNote(note.id, { title: 'Local edit' });
    const local = await db.notes.get(note.id);
    const remote = { ...note, title: 'Remote edit', updatedAt: 0 };

    const result = await detector.processChanges([change(note.id, 'rev:two', 'rev:one', remote)], 'cursor:three');
    await db.close();
    await db.open();
    const conflict = await db.conflicts.where('entityId').equals(note.id).first();

    expect(result.conflicts).toBe(1);
    expect(conflict).toMatchObject({ resolved: false, localState: { title: 'Local edit' }, remoteState: { title: 'Remote edit' } });
    expect((await db.notes.get(note.id))?.title).toBe(local?.title);
    expect((await db.settings.get(conflictContextKey(conflict!.id)))?.value).toMatchObject({ remoteRevision: 'rev:two', baseRemoteRevision: 'rev:one' });
  });

  it('defers mismatched or missing base revisions without advancing the cursor', async () => {
    const badBase = await detector.processChanges([change('x', 'opaque-new', 'opaque-unaccepted', {})], 'cursor-next');
    expect(badBase).toMatchObject({ deferred: 1, cursorAdvanced: false });
    expect(await db.settings.get('sync-pull:cursor')).toBeUndefined();

    const missingBase = { ...change('y', 'opaque-newer', null, {}), baseRemoteRevision: undefined } as unknown as RemoteChange;
    const missing = await detector.processChanges([missingBase], 'cursor-later');
    expect(missing).toMatchObject({ deferred: 2, cursorAdvanced: false });
  });

  it('persists unresolved conflict snapshots and resolves Keep Local while retaining superseded queue rows', async () => {
    const note = await notesService.createNote({ title: 'Local before' });
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'token-1', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    const oldOperation = await db.outbox.where('entityId').equals(note.id).first();
    await notesService.updateNote(note.id, { title: 'Local kept' });
    await detector.processChanges([change(note.id, 'token-2', 'token-1', { ...note, title: 'Remote value' })], 'cursor-2');
    const conflict = await db.conflicts.where('entityId').equals(note.id).first();
    expect(conflict).toBeDefined();
    const snapshot = structuredClone(conflict);

    await resolver.resolve(conflict!.id, 'local');
    expect(await db.conflicts.get(conflict!.id)).toMatchObject({ resolved: true, resolutionStrategy: 'local' });
    expect((await db.conflicts.get(conflict!.id))?.localState).toEqual(snapshot?.localState);
    expect(await db.outbox.get(oldOperation!.id)).toBeDefined();
    expect((await db.settings.get(`sync-operation-superseded:${oldOperation!.id}`))?.value).toMatchObject({ superseded: true });
    expect((await queue.getQueueItems()).filter((item) => item.operation.entityId === note.id && !item.operation.synced && !item.superseded)).toHaveLength(1);
    expect((await db.notes.get(note.id))?.title).toBe('Local kept');
  });

  it('supports Keep Remote without echoing the remote snapshot', async () => {
    const note = await notesService.createNote({ title: 'Local' });
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'remote-1', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    await notesService.updateNote(note.id, { title: 'Edited local' });
    await detector.processChanges([change(note.id, 'remote-2', 'remote-1', { ...note, title: 'Server value' })], 'cursor');
    const conflict = await db.conflicts.where('entityId').equals(note.id).first();

    await resolver.resolve(conflict!.id, 'remote');
    expect((await db.notes.get(note.id))?.title).toBe('Server value');
    expect((await queue.getQueueItems()).filter((item) => item.operation.entityId === note.id && !item.operation.synced && !item.superseded)).toHaveLength(0);
  });

  it('applies a valid manual merge and enqueues a new operation against the server revision', async () => {
    const note = await notesService.createNote({ title: 'Local title', content: 'Local body' });
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'merge-r1', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    await notesService.updateNote(note.id, { title: 'Chosen local title' });
    await detector.processChanges([change(note.id, 'merge-r2', 'merge-r1', { ...note, title: 'Remote title', content: 'Remote body' })], 'merge-cursor');
    const conflict = await db.conflicts.where('entityId').equals(note.id).first();

    await resolver.resolve(conflict!.id, 'merged', { ...conflict!.localState, title: 'Merged title', content: 'Merged body' });
    expect((await db.notes.get(note.id))?.title).toBe('Merged title');
    expect((await db.settings.get(revisionKey('note', note.id)))?.value).toMatchObject({ remoteRevision: 'merge-r2', localVersion: null });
    expect((await queue.getQueueItems()).filter((item) => item.operation.entityId === note.id && !item.operation.synced && !item.superseded)).toHaveLength(1);
  });

  it('validates manual merges and rejects stale local resolutions transactionally', async () => {
    const note = await notesService.createNote({ title: 'Valid local' });
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'r1', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    await notesService.updateNote(note.id, { title: 'Local edit' });
    await detector.processChanges([change(note.id, 'r2', 'r1', { ...note, title: 'Remote edit' })], 'c2');
    const conflict = await db.conflicts.where('entityId').equals(note.id).first();
    const operationsBefore = await db.outbox.count();
    await expect(resolver.resolve(conflict!.id, 'merged', { ...conflict!.localState, tagIds: 'invalid' as unknown as string[] })).rejects.toThrow();
    expect((await db.conflicts.get(conflict!.id))?.resolved).toBe(false);
    expect(await db.outbox.count()).toBe(operationsBefore);

    await notesService.updateNote(note.id, { title: 'Newer edit' });
    await expect(resolver.resolve(conflict!.id, 'local')).rejects.toThrow(/changed after this conflict/);
    expect((await db.conflicts.get(conflict!.id))?.resolved).toBe(false);
    expect((await db.notes.get(note.id))?.title).toBe('Newer edit');
  });

  it('processes pulled changes through a controlled adapter even when the outbox is empty', async () => {
    const manager = new SyncManager(adapter(async () => ({
      configured: true,
      changes: [change('adapter-note', 'server-fixture-2', null, {
        id: 'adapter-note', title: 'Pulled', content: '', createdAt: 3, updatedAt: 4, deletedAt: null,
        version: 1, syncStatus: 'synced', tagIds: [], isPinned: false, isArchived: false,
      })],
      cursor: 'adapter-cursor',
    })));
    const result = await manager.runSync();
    expect(result.changes).toHaveLength(1);
    expect((await db.notes.get('adapter-note'))?.title).toBe('Pulled');
    expect((await db.settings.get('sync-pull:cursor'))?.value).toBe('adapter-cursor');
    manager.dispose();
  });

  it('does not overwrite an edit made while a controlled pull response is in flight', async () => {
    const note = await notesService.createNote({ title: 'Before pull' });
    await db.outbox.clear();
    await db.settings.put({ key: revisionKey('note', note.id), value: { remoteRevision: 'stale-r1', localVersion: note.version, snapshot: note }, updatedAt: 1 });
    const manager = new SyncManager(adapter(async () => {
      await notesService.updateNote(note.id, { title: 'Edited during pull' });
      return { configured: true, changes: [change(note.id, 'stale-r2', 'stale-r1', { ...note, title: 'Old response' })], cursor: 'stale-cursor' };
    }));

    await manager.runSync();
    expect((await db.notes.get(note.id))?.title).toBe('Edited during pull');
    expect(await db.conflicts.where('entityId').equals(note.id).first()).toMatchObject({ resolved: false, remoteState: { title: 'Old response' } });
    manager.dispose();
  });
});
