import { db } from '../db/database';
import { generateId } from '../lib/utils';
import { TagSchema } from '../schemas/tag.schema';
import type { CreateTagInput, Tag, UUID } from '../types';
import { outboxService } from './outboxService';

export class TagsService {
  async getTags(): Promise<Tag[]> {
    return db.tags.orderBy('name').toArray();
  }

  async getTagById(id: UUID): Promise<Tag | undefined> {
    return db.tags.get(id);
  }

  async createTag(data: CreateTagInput): Promise<Tag> {
    const tagName = data.name.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await db.tags.where('name').equals(tagName).first();
    if (existing) {
      return existing;
    }

    const tag: Tag = {
      id: data.id || generateId(),
      name: tagName,
      color: data.color || '#6366f1',
      createdAt: Date.now(),
    };

    TagSchema.parse(tag);

    await db.transaction('rw', [db.tags, db.outbox], async () => {
      await db.tags.add(tag);
      await db.outbox.add(
        await outboxService.createOperationRecord('tag', tag.id, 'create', tag as unknown as Record<string, unknown>)
      );
    });

    return tag;
  }

  async deleteTag(id: UUID): Promise<void> {
    const existing = await db.tags.get(id);
    if (!existing) return;

    const now = Date.now();
    await db.transaction('rw', [db.tags, db.notes, db.tasks, db.outbox], async () => {
      // Detach tag from all notes
      const notesWithTag = await db.notes.where('tagIds').equals(id).toArray();
      for (const note of notesWithTag) {
        const nextTagIds = note.tagIds.filter((t) => t !== id);
        await db.notes.update(note.id, {
          tagIds: nextTagIds,
          updatedAt: now,
          version: note.version + 1,
        });
        await db.outbox.add(
          await outboxService.createOperationRecord('note', note.id, 'update', { tagIds: nextTagIds, updatedAt: now })
        );
      }

      // Detach tag from all tasks
      const tasksWithTag = await db.tasks.where('tagIds').equals(id).toArray();
      for (const task of tasksWithTag) {
        const nextTagIds = task.tagIds.filter((t) => t !== id);
        await db.tasks.update(task.id, {
          tagIds: nextTagIds,
          updatedAt: now,
          version: task.version + 1,
        });
        await db.outbox.add(
          await outboxService.createOperationRecord('task', task.id, 'update', { tagIds: nextTagIds, updatedAt: now })
        );
      }

      // Delete tag record
      await db.tags.delete(id);
      await db.outbox.add(
        await outboxService.createOperationRecord('tag', id, 'delete', { id, name: existing.name })
      );
    });
  }

  /**
   * Compatibility aliases
   */
  async create(data: CreateTagInput): Promise<Tag> {
    return this.createTag(data);
  }

  async delete(id: UUID): Promise<void> {
    return this.deleteTag(id);
  }

  async getAll(): Promise<Tag[]> {
    return this.getTags();
  }

  async getById(id: UUID): Promise<Tag | undefined> {
    return this.getTagById(id);
  }
}

export const tagsService = new TagsService();
