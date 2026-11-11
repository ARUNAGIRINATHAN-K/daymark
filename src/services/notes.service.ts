import { db } from '../db/database';
import { generateId } from '../lib/utils';
import { NoteSchema } from '../schemas/note.schema';
import type { CreateNoteInput, Note, UpdateNoteInput, UUID } from '../types';
import { outboxService } from './outboxService';

export interface NoteFilterOptions {
  folderId?: UUID | null;
  tagId?: UUID | null;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  searchQuery?: string;
}

export class NotesService {
  /**
   * Query notes with optional filtering
   */
  async getNotes(options: NoteFilterOptions = {}): Promise<Note[]> {
    let collection = db.notes.toCollection();

    // Soft deletion filter (default: active notes only)
    if (!options.includeDeleted) {
      collection = collection.filter((n) => n.deletedAt === null);
    }

    // Archive filter (default: active unarchived notes)
    if (!options.includeArchived) {
      collection = collection.filter((n) => !n.isArchived);
    }

    // Folder filter
    if (options.folderId !== undefined) {
      collection = collection.filter((n) => n.folderId === options.folderId);
    }

    // Tag filter
    if (options.tagId) {
      collection = collection.filter((n) => n.tagIds.includes(options.tagId!));
    }

    let results = await collection.toArray();

    // Search filter across title, content, and tag names
    if (options.searchQuery && options.searchQuery.trim()) {
      results = await this.filterBySearch(results, options.searchQuery.trim());
    }

    // Sort: pinned first, then by updatedAt descending
    return results.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return b.updatedAt - a.updatedAt;
    });
  }

  /**
   * Helper to filter notes by title, content, and resolved tag names
   */
  private async filterBySearch(notes: Note[], query: string): Promise<Note[]> {
    const q = query.toLowerCase();
    const tags = await db.tags.toArray();
    const tagMap = new Map(tags.map((t) => [t.id, t.name.toLowerCase()]));

    return notes.filter((note) => {
      if (note.title.toLowerCase().includes(q)) return true;
      if (note.content.toLowerCase().includes(q)) return true;

      // Check resolved tag names
      const matchTag = note.tagIds.some((tagId) => {
        const tagName = tagMap.get(tagId);
        return tagName && tagName.includes(q);
      });
      if (matchTag) return true;

      return false;
    });
  }

  /**
   * Query single active note by ID
   */
  async getNoteById(id: UUID): Promise<Note | undefined> {
    const note = await db.notes.get(id);
    if (!note || note.deletedAt !== null) return undefined;
    return note;
  }

  /**
   * Create a new note with atomic outbox logging
   */
  async createNote(input?: CreateNoteInput): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      id: generateId(),
      title: input?.title?.trim() || 'Untitled Note',
      content: input?.content ?? '',
      folderId: input?.folderId ?? null,
      tagIds: input?.tagIds ?? [],
      isPinned: input?.isPinned ?? false,
      isArchived: input?.isArchived ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
    };

    NoteSchema.parse(note);

    await db.transaction('rw', [db.notes, db.outbox], async () => {
      await db.notes.add(note);
      await db.outbox.add(
        await outboxService.createOperationRecord('note', note.id, 'create', note as unknown as Record<string, unknown>)
      );
    });

    return note;
  }

  /**
   * Update an existing note with version increment and atomic outbox logging
   */
  async updateNote(id: UUID, updates: UpdateNoteInput): Promise<Note> {
    const existing = await db.notes.get(id);
    if (!existing) {
      throw new Error(`Note with ID ${id} not found.`);
    }

    const now = Date.now();
    const updated: Note = {
      ...existing,
      ...updates,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    NoteSchema.parse(updated);

    await db.transaction('rw', [db.notes, db.outbox], async () => {
      await db.notes.put(updated);
      await db.outbox.add(
        await outboxService.createOperationRecord('note', id, 'update', updates as Record<string, unknown>)
      );
    });

    return updated;
  }

  /**
   * Soft-delete note: sets deletedAt timestamp and logs outbox operation
   */
  async softDeleteNote(id: UUID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    const now = Date.now();
    const updated: Note = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    await db.transaction('rw', [db.notes, db.outbox], async () => {
      await db.notes.put(updated);
      await db.outbox.add(
        await outboxService.createOperationRecord('note', id, 'delete', { id, deletedAt: now })
      );
    });
  }

  /**
   * Restore soft-deleted note: unsets deletedAt to null, increments version, and logs outbox update
   */
  async restoreNote(id: UUID): Promise<Note> {
    const existing = await db.notes.get(id);
    if (!existing) {
      throw new Error(`Note with ID ${id} not found.`);
    }

    const now = Date.now();
    const restored: Note = {
      ...existing,
      deletedAt: null,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    NoteSchema.parse(restored);

    await db.transaction('rw', [db.notes, db.outbox], async () => {
      await db.notes.put(restored);
      await db.outbox.add(
        await outboxService.createOperationRecord('note', id, 'update', { deletedAt: null, updatedAt: now })
      );
    });

    return restored;
  }

  /**
   * Permanently delete note from database
   */
  async permanentDeleteNote(id: UUID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.notes, db.outbox], async () => {
      await db.notes.delete(id);
      await db.outbox.add(
        await outboxService.createOperationRecord('note', id, 'delete', { id, permanent: true })
      );
    });
  }

  /**
   * Toggle pinned status
   */
  async togglePin(id: UUID): Promise<boolean> {
    const existing = await db.notes.get(id);
    if (!existing) return false;

    const nextPinned = !existing.isPinned;
    await this.updateNote(id, { isPinned: nextPinned });
    return nextPinned;
  }

  /**
   * Toggle archive status
   */
  async toggleArchive(id: UUID): Promise<boolean> {
    const existing = await db.notes.get(id);
    if (!existing) return false;

    const nextArchived = !existing.isArchived;
    await this.updateNote(id, { isArchived: nextArchived });
    return nextArchived;
  }

  /**
   * Move a single note to a target folder
   */
  async moveNote(id: UUID, folderId: UUID | null): Promise<Note> {
    return this.updateNote(id, { folderId });
  }

  /**
   * Batch move multiple notes to a target folder in a single atomic transaction
   */
  async moveNotes(ids: UUID[], folderId: UUID | null): Promise<number> {
    if (ids.length === 0) return 0;

    const now = Date.now();
    await db.transaction('rw', [db.notes, db.outbox], async () => {
      for (const id of ids) {
        const existing = await db.notes.get(id);
        if (existing) {
          const updated: Note = {
            ...existing,
            folderId,
            updatedAt: now,
            version: existing.version + 1,
            syncStatus: 'pending',
          };
          await db.notes.put(updated);
          await db.outbox.add(
            await outboxService.createOperationRecord('note', id, 'update', { folderId, updatedAt: now })
          );
        }
      }
    });

    return ids.length;
  }

  /**
   * Add a tag to a note
   */
  async addTag(noteId: UUID, tagId: UUID): Promise<Note> {
    const existing = await db.notes.get(noteId);
    if (!existing) throw new Error(`Note ${noteId} not found`);
    if (existing.tagIds.includes(tagId)) return existing;

    const nextTags = [...existing.tagIds, tagId];
    return this.updateNote(noteId, { tagIds: nextTags });
  }

  /**
   * Remove a tag from a note
   */
  async removeTag(noteId: UUID, tagId: UUID): Promise<Note> {
    const existing = await db.notes.get(noteId);
    if (!existing) throw new Error(`Note ${noteId} not found`);

    const nextTags = existing.tagIds.filter((t) => t !== tagId);
    return this.updateNote(noteId, { tagIds: nextTags });
  }
  /**
   * Compatibility aliases
   */
  async create(input?: CreateNoteInput): Promise<Note> {
    return this.createNote(input);
  }

  async update(id: UUID, updates: UpdateNoteInput): Promise<Note> {
    return this.updateNote(id, updates);
  }

  async delete(id: UUID): Promise<void> {
    return this.softDeleteNote(id);
  }

  async softDelete(id: UUID): Promise<void> {
    return this.softDeleteNote(id);
  }

  async restore(id: UUID): Promise<Note> {
    return this.restoreNote(id);
  }

  async getAll(options: NoteFilterOptions = {}): Promise<Note[]> {
    return this.getNotes(options);
  }

  async getById(id: UUID): Promise<Note | undefined> {
    return this.getNoteById(id);
  }
}

export const notesService = new NotesService();
