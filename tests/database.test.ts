import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { folderService } from '../src/services/folderService';
import { noteService } from '../src/services/noteService';
import { tagService } from '../src/services/tagService';
import { taskService } from '../src/services/taskService';
import { syncManager } from '../src/sync/syncManager';

describe('Daymark Database & Transactional Outbox', () => {
  beforeEach(async () => {
    // Reset database state before each test
    await db.notes.clear();
    await db.tasks.clear();
    await db.folders.clear();
    await db.tags.clear();
    await db.outbox.clear();
  });

  it('creates a note and atomically logs a create operation in outbox', async () => {
    const note = await noteService.create({
      title: 'Meeting Notes',
      content: 'Discussing local-first architecture and Dexie storage.',
    });

    // 1. Verify note is persisted in IndexedDB
    const savedNote = await db.notes.get(note.id);
    expect(savedNote).toBeDefined();
    expect(savedNote?.title).toBe('Meeting Notes');

    // 2. Verify matching outbox record was written atomically
    const outboxOps = await db.outbox.where('entityId').equals(note.id).toArray();
    expect(outboxOps.length).toBe(1);
    expect(outboxOps[0].action).toBe('create');
    expect(outboxOps[0].entityType).toBe('note');
    expect(outboxOps[0].synced).toBe(false);
  });

  it('updates a note and atomically logs an update operation in outbox', async () => {
    const note = await noteService.create({
      title: 'Original Title',
      content: 'Original Content',
    });

    await noteService.update(note.id, {
      title: 'Revised Title',
    });

    const updated = await db.notes.get(note.id);
    expect(updated?.title).toBe('Revised Title');

    const outboxOps = await db.outbox.where('entityId').equals(note.id).sortBy('timestamp');
    expect(outboxOps.length).toBe(2); // 1 create + 1 update
    expect(outboxOps[0].action).toBe('create');
    expect(outboxOps[1].action).toBe('update');
  });

  it('creates and completes a task with proper timestamps and outbox tracking', async () => {
    const task = await taskService.create({
      title: 'Audit IndexedDB transactions',
      priority: 'high',
    });

    expect(task.isCompleted).toBe(false);
    expect(task.completedAt).toBeNull();

    // Toggle completion
    const isCompleted = await taskService.toggleCompletion(task.id);
    expect(isCompleted).toBe(true);

    const completedTask = await db.tasks.get(task.id);
    expect(completedTask?.isCompleted).toBe(true);
    expect(completedTask?.completedAt).toBeTypeOf('number');

    const outboxOps = await db.outbox.where('entityId').equals(task.id).sortBy('timestamp');
    expect(outboxOps.length).toBe(2);
    expect(outboxOps[0].action).toBe('create');
    expect(outboxOps[1].action).toBe('update');
  });

  it('deleting a folder safely reassigns contained notes to null and logs outbox events', async () => {
    const folder = await folderService.create({
      name: 'Work',
      color: '#6366f1',
    });

    const note = await noteService.create({
      title: 'Project Brief',
      folderId: folder.id,
    });

    expect(note.folderId).toBe(folder.id);

    // Delete folder
    await folderService.delete(folder.id);

    // Folder is gone
    const deletedFolder = await db.folders.get(folder.id);
    expect(deletedFolder).toBeUndefined();

    // Note preserved, folder reassigned to null (no data loss)
    const preservedNote = await db.notes.get(note.id);
    expect(preservedNote).toBeDefined();
    expect(preservedNote?.folderId).toBeNull();

    // Outbox should contain folder delete record
    const folderOutbox = await db.outbox
      .where('entityType')
      .equals('folder')
      .and((op) => op.action === 'delete')
      .toArray();
    expect(folderOutbox.length).toBe(1);
  });

  it('keeps local operations pending when no remote endpoint is configured', async () => {
    await noteService.create({ title: 'Task 1' });
    await taskService.create({ title: 'Task 2' });

    const result = await syncManager.runSync();
    const operations = await db.outbox.toArray();

    expect(result.status).toBe('unconfigured');
    expect(result.message).toContain('No remote sync endpoint');
    expect(operations).toHaveLength(2);
    expect(operations.every((operation) => !operation.synced)).toBe(true);
  });
});
