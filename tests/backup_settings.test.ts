import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { resetDatabase } from '../src/db/seed';
import { backupService, BACKUP_FORMAT, BACKUP_VERSION, type DuplicateChoices } from '../src/services/backup.service';
import {
  DEFAULT_TASK_SORT_SETTING_KEY,
  DEFAULT_PRODUCTIVITY_CALENDAR_PREFERENCES,
  PRODUCTIVITY_CALENDAR_SETTING_KEY,
  settingsService,
  THEME_STORAGE_KEY,
} from '../src/services/settings.service';
import { notesService } from '../src/services/notes.service';
import { tasksService } from '../src/services/tasks.service';
import { foldersService } from '../src/services/folders.service';
import { tagsService } from '../src/services/tags.service';

describe('backup, restore, and preferences', () => {
  beforeEach(async () => {
    await resetDatabase(db);
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() { return values.size; },
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, String(value)); },
        removeItem: (key: string) => { values.delete(key); },
        clear: () => values.clear(),
        key: (index: number) => Array.from(values.keys())[index] ?? null,
      } satisfies Storage,
    });
    localStorage.clear();
  });

  it('exports all entity records and only allowlisted preferences and portable unsynced entity operations', async () => {
    const note = await notesService.createNote({ title: 'Kept note' });
    await notesService.updateNote(note.id, { isArchived: true });
    await notesService.softDeleteNote(note.id);
    const task = await tasksService.createTask({ title: 'Kept task' });
    await tasksService.softDeleteTask(task.id);
    await foldersService.createFolder({ name: 'Backup folder' });
    await tagsService.createTag({ name: 'backup-tag', color: '#fff' });
    const noteOperation = await db.outbox.where('entityId').equals(note.id).first();
    await db.outbox.update(noteOperation!.id, { payload: { title: 'Kept note', accessToken: 'do-not-export-this' }, error: 'private-error-token' });
    await db.settings.put({ key: 'private:api-token', value: 'do-not-export-this', updatedAt: Date.now() });
    await db.settings.put({ key: 'sync-pull:cursor', value: 'private-remote-cursor', updatedAt: Date.now() });
    await db.outbox.add({
      id: 'setting-operation', entityType: 'setting', entityId: 'private:api-token', action: 'update',
      payload: { token: 'do-not-export-this' }, timestamp: Date.now() + 1, synced: false, retryCount: 0,
    } as unknown as import('../src/types').SyncOperation);

    const backup = await backupService.createBackup();
    const json = JSON.stringify(backup);
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION });
    expect(backup.data.notes.map((item) => item.id)).toContain(note.id);
    expect(backup.data.tasks).toHaveLength(1);
    expect(backup.data.folders).toHaveLength(1);
    expect(backup.data.tags).toHaveLength(1);
    expect(backup.data.notes[0].isArchived).toBe(true);
    expect(backup.data.notes[0].deletedAt).not.toBeNull();
    expect(backup.data.tasks[0].deletedAt).not.toBeNull();
    expect(backup.data.outbox.every((item) => (item.entityType as string) !== 'setting')).toBe(true);
    expect(json).not.toContain('do-not-export-this');
    expect(json).not.toContain('private-error-token');
    expect(json).not.toContain('private-remote-cursor');
  });

  it('rejects malformed JSON, missing and unsupported versions, wrong format, and duplicate IDs', async () => {
    await expect(backupService.previewImport('{bad json')).rejects.toThrow(/valid JSON/);
    const valid = await backupService.createBackup();
    const missingVersion = { ...valid, version: undefined };
    await expect(backupService.previewImport(missingVersion)).rejects.toThrow(/supported Daymark backup/);
    await expect(backupService.previewImport({ ...valid, version: 99 })).rejects.toThrow(/Unsupported Daymark backup version/);
    await expect(backupService.previewImport({ ...valid, format: 'other' })).rejects.toThrow(/Unsupported backup format/);

    const note = await notesService.createNote({ title: 'Duplicate ID' });
    const withDuplicate = await backupService.createBackup();
    withDuplicate.data.notes.push(note);
    await expect(backupService.previewImport(withDuplicate)).rejects.toThrow(/duplicate note IDs/);

    const operation = (await db.outbox.where('entityId').equals(note.id).first())!;
    const withDuplicateOperation = await backupService.createBackup();
    const portable = {
      id: operation.id, entityType: 'note' as const, entityId: note.id, action: operation.action,
      payload: { id: note.id, title: note.title }, timestamp: operation.timestamp, synced: false as const,
    };
    withDuplicateOperation.data.outbox = [portable, { ...portable }];
    await expect(backupService.previewImport(withDuplicateOperation)).rejects.toThrow(/duplicate outbox operation IDs/);
  });

  it('previews without writes and requires explicit duplicate actions', async () => {
    const existing = await notesService.createNote({ title: 'Local record' });
    const backup = await backupService.createBackup();
    backup.data.notes = [{ ...existing, title: 'Backup version' }];
    const preview = await backupService.previewImport(backup);
    expect(preview.duplicates).toHaveLength(1);
    expect((await db.notes.get(existing.id))?.title).toBe('Local record');
    await expect(backupService.restoreBackup(preview, {})).rejects.toThrow(/Choose Keep Existing or Replace/);
    expect((await db.notes.get(existing.id))?.title).toBe('Local record');
  });

  it('keeps duplicates or replaces only when explicitly chosen, importing matching pending work', async () => {
    const existing = await notesService.createNote({ title: 'Current' });
    const originalOperation = await db.outbox.where('entityId').equals(existing.id).first();
    const backup = await backupService.createBackup();
    backup.data.notes = [{ ...existing, title: 'From backup', syncStatus: 'pending' }];
    backup.data.outbox = [{
      id: 'backup-note-update', entityType: 'note', entityId: existing.id, action: 'update',
      payload: { id: existing.id, title: 'From backup' }, timestamp: Date.now() + 100,
      synced: false,
    }];
    const preview = await backupService.previewImport(backup);
    const result = await backupService.restoreBackup(preview, { [`note:${existing.id}`]: 'replace' });

    expect(result).toMatchObject({ replaced: 1, importedOperations: 1 });
    expect((await db.notes.get(existing.id))?.title).toBe('From backup');
    expect((await db.outbox.get(originalOperation!.id))?.synced).toBe(false);
    expect((await db.settings.get(`sync-operation-superseded:${originalOperation!.id}`))?.value).toMatchObject({ superseded: true });
    expect(await db.outbox.get('backup-note-update')).toMatchObject({ synced: false, retryCount: 0, error: null });
    expect((await db.settings.get('sync-operation-state:backup-note-update'))?.value).toMatchObject({ status: 'pending', attemptCount: 0 });
    expect(await settingsService.getDefaultTaskSort()).toBe('createdAt');

    const keepPreview = await backupService.previewImport(backup);
    const keep = await backupService.restoreBackup(keepPreview, { [`note:${existing.id}`]: 'keep-existing' });
    expect(keep.kept).toBe(1);
    expect((await db.notes.get(existing.id))?.title).toBe('From backup');
    expect(keep.importedOperations).toBe(0);
  });

  it('skips exact existing operation IDs but blocks an operation ID with different contents', async () => {
    const note = await notesService.createNote({ title: 'Operation owner' });
    const operation = await db.outbox.where('entityId').equals(note.id).first();
    const backup = await backupService.createBackup();
    backup.data.notes = [];
    backup.data.outbox = [{
      id: operation!.id, entityType: 'note', entityId: note.id, action: operation!.action,
      payload: operation!.payload, timestamp: operation!.timestamp, synced: false,
    }];

    const exactPreview = await backupService.previewImport(backup);
    expect(exactPreview.exactExistingOperationIds).toContain(operation!.id);
    const exactResult = await backupService.restoreBackup(exactPreview, {});
    expect(exactResult.skippedOperations).toBe(1);

    const conflictBackup = await backupService.createBackup();
    conflictBackup.data.notes = [];
    conflictBackup.data.outbox = [{
      id: operation!.id, entityType: 'note', entityId: note.id, action: operation!.action,
      payload: { title: 'Different content' }, timestamp: operation!.timestamp, synced: false,
    }];
    const conflictPreview = await backupService.previewImport(conflictBackup);
    expect(conflictPreview.operationConflicts).toContain(operation!.id);
    await expect(backupService.restoreBackup(conflictPreview, {})).rejects.toThrow(/operation IDs conflict/);
  });

  it('does not leave a replaced entity pending when its exact backup operation is already acknowledged locally', async () => {
    const note = await notesService.createNote({ title: 'Portable acknowledged note' });
    const backup = await backupService.createBackup();
    const operation = await db.outbox.where('entityId').equals(note.id).first();
    await db.outbox.update(operation!.id, { synced: true });
    await db.notes.update(note.id, { syncStatus: 'synced' });
    const preview = await backupService.previewImport(backup);

    await backupService.restoreBackup(preview, { [`note:${note.id}`]: 'replace' });
    expect((await db.notes.get(note.id))?.syncStatus).toBe('synced');
    expect((await db.outbox.get(operation!.id))?.synced).toBe(true);
  });

  it('rolls back earlier writes if a reviewed duplicate changed before restore starts', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const first = await notesService.createNote({ title: 'A new backup record' });
    const existing = await notesService.createNote({ title: 'Will change' });
    const backup = await backupService.createBackup();
    backup.data.notes = [
      { ...first, id: 'new-before-abort', title: 'Should roll back' },
      { ...existing, title: 'Stale backup value' },
    ];
    const preview = await backupService.previewImport(backup);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    await notesService.updateNote(existing.id, { title: 'Changed after preview' });

    await expect(backupService.restoreBackup(preview, { [`note:${existing.id}`]: 'replace' })).rejects.toThrow(/changed after preview/);
    expect(await db.notes.get('new-before-abort')).toBeUndefined();
    expect((await db.notes.get(existing.id))?.title).toBe('Changed after preview');
    expect(await db.settings.get(DEFAULT_TASK_SORT_SETTING_KEY)).toBeUndefined();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('persists validated task sort preference and theme while rejecting invalid values', async () => {
    await settingsService.setDefaultTaskSort('priority');
    settingsService.setThemePreference('light');
    expect(await settingsService.getDefaultTaskSort()).toBe('priority');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await expect(settingsService.setDefaultTaskSort('made-up' as never)).rejects.toThrow();
    expect(await settingsService.getDefaultTaskSort()).toBe('priority');
  });

  it('persists validated productivity calendar display settings without adding them to backups', async () => {
    expect(await settingsService.getProductivityCalendarPreferences()).toEqual(
      DEFAULT_PRODUCTIVITY_CALENDAR_PREFERENCES
    );

    await settingsService.setProductivityCalendarPreferences({ showDeadlines: false });
    expect(await settingsService.getProductivityCalendarPreferences()).toEqual({ showDeadlines: false });
    expect(await db.settings.get(PRODUCTIVITY_CALENDAR_SETTING_KEY)).toMatchObject({
      value: { showDeadlines: false },
    });

    await expect(
      settingsService.setProductivityCalendarPreferences({ showDeadlines: 'false' } as never)
    ).rejects.toThrow();

    const backupJson = JSON.stringify(await backupService.createBackup());
    expect(backupJson).not.toContain(PRODUCTIVITY_CALENDAR_SETTING_KEY);
  });

  it('restores the allowlisted theme and default task sorting preference', async () => {
    const backup = await backupService.createBackup();
    backup.data.notes = [];
    backup.data.preferences = { theme: 'light', defaultTaskSortBy: 'dueDate' };
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const preview = await backupService.previewImport(backup);

    const result = await backupService.restoreBackup(preview, {});
    expect(result.preferences).toEqual({ theme: 'light', defaultTaskSortBy: 'dueDate' });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(await settingsService.getDefaultTaskSort()).toBe('dueDate');
  });
});
