import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { CURRENT_DATABASE_VERSION, DATABASE_NAME } from '../src/db/schema';
import { resetDatabase, seedDatabase } from '../src/db/seed';
import { noteService } from '../src/services/noteService';
import { taskService } from '../src/services/taskService';

describe('Daymark Database Initialization & Diagnostics', () => {
  beforeEach(async () => {
    await resetDatabase(db);
  });

  it('initializes the database with canonical name and version', async () => {
    expect(db.name).toBe(DATABASE_NAME);
    expect(db.verno).toBe(CURRENT_DATABASE_VERSION);
  });

  it('passes the database health check diagnostic', async () => {
    const health = await db.checkDatabaseHealth();
    expect(health.status).toBe('healthy');
    expect(health.isOpen).toBe(true);
    expect(health.databaseName).toBe(DATABASE_NAME);
    expect(health.version).toBe(CURRENT_DATABASE_VERSION);
    expect(health.tables).toBeDefined();
    expect(typeof health.tables.notes).toBe('number');
    expect(typeof health.tables.tasks).toBe('number');
  });

  it('runs development seed utility and populates canonical records', async () => {
    const seedResult = await seedDatabase(db, { force: true });
    expect(seedResult.notesCount).toBeGreaterThan(0);
    expect(seedResult.tasksCount).toBeGreaterThan(0);
    expect(seedResult.foldersCount).toBeGreaterThan(0);
    expect(seedResult.tagsCount).toBeGreaterThan(0);

    const notes = await db.notes.toArray();
    expect(notes.length).toBe(seedResult.notesCount);
    expect(notes[0].version).toBe(1);
    expect(notes[0].deletedAt).toBeNull();
  });

  it('supports soft-deletion and filters soft-deleted items from active queries', async () => {
    const note = await noteService.create({
      title: 'Soft Delete Test Note',
      content: 'This note will be soft deleted.',
    });

    expect(note.deletedAt).toBeNull();
    const activeBefore = await db.getActiveNotes();
    expect(activeBefore.some((n) => n.id === note.id)).toBe(true);

    // Perform soft deletion
    await noteService.softDelete(note.id);

    // Raw database record still exists (data integrity preserved for sync)
    const rawRecord = await db.notes.get(note.id);
    expect(rawRecord).toBeDefined();
    expect(rawRecord?.deletedAt).toBeTypeOf('number');

    // Filtered active query excludes soft-deleted note
    const activeAfter = await db.getActiveNotes();
    expect(activeAfter.some((n) => n.id === note.id)).toBe(false);

    // NoteService.getAll() excludes soft-deleted note
    const activeServiceNotes = await noteService.getAll();
    expect(activeServiceNotes.some((n) => n.id === note.id)).toBe(false);
  });

  it('increments entity version on update', async () => {
    const task = await taskService.create({
      title: 'Version increment test',
    });

    expect(task.version).toBe(1);

    const updatedTask = await taskService.update(task.id, {
      title: 'Version increment test - updated',
    });

    expect(updatedTask.version).toBe(2);

    const secondUpdate = await taskService.update(task.id, {
      priority: 'high',
    });

    expect(secondUpdate.version).toBe(3);
  });
});
