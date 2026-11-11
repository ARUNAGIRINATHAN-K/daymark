import { describe, expect, it } from 'vitest';
import { NoteSchema } from '../src/schemas/note.schema';
import { AppSettingSchema } from '../src/schemas/settings.schema';
import { TaskSchema } from '../src/schemas/task.schema';

describe('Zod Canonical Schema Validation', () => {
  it('validates a valid Note payload', () => {
    const validNote = {
      id: 'uuid-note-1',
      title: 'Canonical Architecture',
      content: '# Heading\nMarkdown content',
      folderId: 'uuid-folder-1',
      tagIds: ['uuid-tag-1'],
      isPinned: true,
      isArchived: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
    };

    const parsed = NoteSchema.parse(validNote);
    expect(parsed.id).toBe('uuid-note-1');
    expect(parsed.version).toBe(1);
    expect(parsed.deletedAt).toBeNull();
  });

  it('rejects an invalid Note with non-integer timestamp', () => {
    const invalidNote = {
      id: 'uuid-note-1',
      title: 'Test',
      content: '',
      createdAt: 'invalid-date',
    };

    expect(() => NoteSchema.parse(invalidNote)).toThrow();
  });

  it('validates a valid Task payload', () => {
    const validTask = {
      id: 'uuid-task-1',
      title: 'Verify Zod schema',
      description: 'Run unit test suite',
      isCompleted: false,
      priority: 'high',
      dueDate: 1700005000000,
      folderId: null,
      tagIds: [],
      noteId: null,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    };

    const parsed = TaskSchema.parse(validTask);
    expect(parsed.title).toBe('Verify Zod schema');
    expect(parsed.priority).toBe('high');
  });

  it('rejects an empty Task title', () => {
    const emptyTask = {
      id: 'uuid-task-2',
      title: '',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };

    expect(() => TaskSchema.parse(emptyTask)).toThrow();
  });

  it('validates an AppSetting payload', () => {
    const validSetting = {
      key: 'theme_mode',
      value: { dark: true },
      updatedAt: 1700000000000,
    };

    const parsed = AppSettingSchema.parse(validSetting);
    expect(parsed.key).toBe('theme_mode');
  });
});
