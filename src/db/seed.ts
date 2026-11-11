import type { DaymarkDatabase } from './database';
import { generateId } from '../lib/utils';
import type { Folder, Note, SyncOperation, Tag, Task } from '../types';

/**
 * Development-only seed utility populating Daymark with canonical models
 */
export async function seedDatabase(
  db: DaymarkDatabase,
  options: { force?: boolean } = {}
): Promise<{ notesCount: number; tasksCount: number; foldersCount: number; tagsCount: number }> {
  const existingNotesCount = await db.notes.count();
  if (existingNotesCount > 0 && !options.force) {
    return {
      notesCount: existingNotesCount,
      tasksCount: await db.tasks.count(),
      foldersCount: await db.folders.count(),
      tagsCount: await db.tags.count(),
    };
  }

  const now = Date.now();
  const oneDay = 86400000;

  // 1. Canonical Folders
  const folders: Folder[] = [
    {
      id: generateId(),
      name: 'General',
      color: '#6366f1',
      icon: 'folder',
      parentId: null,
      sortOrder: 1,
      createdAt: now - oneDay * 3,
      updatedAt: now - oneDay * 3,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: generateId(),
      name: 'Engineering',
      color: '#06b6d4',
      icon: 'code',
      parentId: null,
      sortOrder: 2,
      createdAt: now - oneDay * 2,
      updatedAt: now - oneDay * 2,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: generateId(),
      name: 'Productivity',
      color: '#10b981',
      icon: 'check-square',
      parentId: null,
      sortOrder: 3,
      createdAt: now - oneDay,
      updatedAt: now - oneDay,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
  ];

  // 2. Canonical Tags
  const tags: Tag[] = [
    { id: generateId(), name: 'offline-first', color: '#6366f1', createdAt: now - oneDay * 3 },
    { id: generateId(), name: 'architecture', color: '#8b5cf6', createdAt: now - oneDay * 2 },
    { id: generateId(), name: 'high-priority', color: '#f59e0b', createdAt: now - oneDay },
  ];

  // 3. Canonical Notes
  const notes: Note[] = [
    {
      id: generateId(),
      title: 'Welcome to Daymark IndexedDB',
      content: `# Canonical Local-First Architecture

Daymark stores all notes, tasks, folders, and sync logs directly in the browser's IndexedDB.

### Key Architectural Invariants
- **Zero Cloud Dependence**: Full read/write CRUD executes offline without network requirements.
- **Atomic Transactional Outbox**: Every local mutation updates the entity and writes an audit log in the exact same transaction.
- **Soft Deletion**: Records preserve \`deletedAt: null\` while active; soft-deletions set a millisecond timestamp to enable synchronization reconciliation.
- **Monotonic Versioning**: Records increment an integer \`version\` counter upon every write.`,
      folderId: folders[0].id,
      tagIds: [tags[0].id, tags[1].id],
      isPinned: true,
      isArchived: false,
      createdAt: now - oneDay * 2,
      updatedAt: now - oneDay,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: generateId(),
      title: 'Database Schema & Indexing Guide',
      content: `## Dexie.js Schema Version 1

- Primary keys: UUID v4 strings
- Secondary indexes: \`folderId\`, \`*tagIds\`, \`deletedAt\`, \`syncStatus\`, \`updatedAt\`
- Multi-entry indexes: Enabled on \`*tagIds\` for fast tag queries`,
      folderId: folders[1].id,
      tagIds: [tags[1].id],
      isPinned: false,
      isArchived: false,
      createdAt: now - oneDay,
      updatedAt: now - 3600000,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
  ];

  // 4. Canonical Tasks
  const tasks: Task[] = [
    {
      id: generateId(),
      title: 'Verify IndexedDB Schema Version 1',
      description: 'Run health check and inspect stores in DevTools Application tab.',
      isCompleted: false,
      completedAt: null,
      priority: 'high',
      dueDate: now + 3600000 * 4,
      folderId: folders[1].id,
      tagIds: [tags[2].id],
      noteId: notes[0].id,
      createdAt: now - oneDay,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: generateId(),
      title: 'Test soft-deletion filter queries',
      description: 'Ensure items with non-null deletedAt are filtered from default views.',
      isCompleted: false,
      completedAt: null,
      priority: 'medium',
      dueDate: now + oneDay,
      folderId: folders[2].id,
      tagIds: [tags[0].id],
      noteId: null,
      createdAt: now - oneDay,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: generateId(),
      title: 'Initial database bootstrap completed',
      description: 'Database initialized with canonical schemas and versioning.',
      isCompleted: true,
      completedAt: now - 3600000,
      priority: 'low',
      dueDate: null,
      folderId: folders[0].id,
      tagIds: [tags[0].id],
      noteId: null,
      createdAt: now - oneDay * 2,
      updatedAt: now - 3600000,
      deletedAt: null,
      version: 1,
      syncStatus: 'synced',
    },
  ];

  // Atomic database seed
  await db.transaction('rw', [db.folders, db.tags, db.notes, db.tasks], async () => {
    if (options.force) {
      await db.folders.clear();
      await db.tags.clear();
      await db.notes.clear();
      await db.tasks.clear();
    }
    await db.folders.bulkAdd(folders);
    await db.tags.bulkAdd(tags);
    await db.notes.bulkAdd(notes);
    await db.tasks.bulkAdd(tasks);
  });

  return {
    notesCount: notes.length,
    tasksCount: tasks.length,
    foldersCount: folders.length,
    tagsCount: tags.length,
  };
}

/**
 * Clear and reset database for development testing
 */
export async function resetDatabase(db: DaymarkDatabase): Promise<void> {
  await db.transaction(
    'rw',
    [db.notes, db.tasks, db.folders, db.tags, db.syncOperations, db.outbox, db.conflicts, db.settings],
    async () => {
      await db.notes.clear();
      await db.tasks.clear();
      await db.folders.clear();
      await db.tags.clear();
      await db.syncOperations.clear();
      await db.outbox.clear();
      await db.conflicts.clear();
      await db.settings.clear();
    }
  );
}
