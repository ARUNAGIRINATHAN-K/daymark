import { db } from '../db/database';
import { generateId } from '../lib/utils';
import type { CreateFolderInput, Folder, UpdateFolderInput, UUID } from '../types';
import { outboxService } from './outboxService';

export class FoldersService {
  /**
   * Get all active folders sorted by sortOrder and name
   */
  async getFolders(): Promise<Folder[]> {
    const folders = await db.folders
      .filter((f) => f.deletedAt === null)
      .toArray();

    return folders.sort((a, b) => {
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return a.name.localeCompare(b.name);
    });
  }

  async getFolderById(id: UUID): Promise<Folder | undefined> {
    const folder = await db.folders.get(id);
    if (!folder || folder.deletedAt !== null) return undefined;
    return folder;
  }

  async createFolder(data: CreateFolderInput): Promise<Folder> {
    const now = Date.now();
    const folder: Folder = {
      id: data.id || generateId(),
      name: data.name.trim(),
      color: data.color || '#6366f1',
      icon: data.icon || 'folder',
      parentId: data.parentId || null,
      sortOrder: data.sortOrder || 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
    };

    await db.transaction('rw', [db.folders, db.outbox], async () => {
      await db.folders.add(folder);
      await db.outbox.add(
        await outboxService.createOperationRecord(
          'folder',
          folder.id,
          'create',
          folder as unknown as Record<string, unknown>
        )
      );
    });

    return folder;
  }

  async updateFolder(id: UUID, updates: UpdateFolderInput): Promise<Folder> {
    const existing = await db.folders.get(id);
    if (!existing) {
      throw new Error(`Folder with ID ${id} not found.`);
    }

    const now = Date.now();
    const updated: Folder = {
      ...existing,
      ...updates,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    await db.transaction('rw', [db.folders, db.outbox], async () => {
      await db.folders.put(updated);
      await db.outbox.add(
        await outboxService.createOperationRecord('folder', id, 'update', updates as Record<string, unknown>)
      );
    });

    return updated;
  }

  /**
   * Delete folder safely: reassigns contained notes and tasks to null in the same atomic transaction
   */
  async deleteFolder(id: UUID): Promise<void> {
    const existing = await db.folders.get(id);
    if (!existing) return;

    const now = Date.now();
    await db.transaction('rw', [db.folders, db.notes, db.tasks, db.outbox], async () => {
      // 1. Reassign notes that belonged to this folder to null
      const notesInFolder = await db.notes.where('folderId').equals(id).toArray();
      for (const note of notesInFolder) {
        await db.notes.update(note.id, {
          folderId: null,
          updatedAt: now,
          version: note.version + 1,
          syncStatus: 'pending',
        });
        await db.outbox.add(
          await outboxService.createOperationRecord('note', note.id, 'update', { folderId: null, updatedAt: now })
        );
      }

      // 2. Reassign tasks that belonged to this folder to null
      const tasksInFolder = await db.tasks.where('folderId').equals(id).toArray();
      for (const task of tasksInFolder) {
        await db.tasks.update(task.id, {
          folderId: null,
          updatedAt: now,
          version: task.version + 1,
          syncStatus: 'pending',
        });
        await db.outbox.add(
          await outboxService.createOperationRecord('task', task.id, 'update', { folderId: null, updatedAt: now })
        );
      }

      // 3. Delete the folder itself
      await db.folders.delete(id);

      // 4. Log outbox delete operation
      await db.outbox.add(
        await outboxService.createOperationRecord('folder', id, 'delete', { id, name: existing.name })
      );
    });
  }

  /**
   * Compatibility aliases
   */
  async create(data: CreateFolderInput): Promise<Folder> {
    return this.createFolder(data);
  }

  async update(id: UUID, updates: UpdateFolderInput): Promise<Folder> {
    return this.updateFolder(id, updates);
  }

  async delete(id: UUID): Promise<void> {
    return this.deleteFolder(id);
  }

  async getAll(): Promise<Folder[]> {
    return this.getFolders();
  }

  async getById(id: UUID): Promise<Folder | undefined> {
    return this.getFolderById(id);
  }
}

export const foldersService = new FoldersService();
