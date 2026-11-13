import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { foldersService } from '../src/services/folders.service';
import { notesService } from '../src/services/notes.service';
import { tagsService } from '../src/services/tags.service';

describe('Master Prompt 04: Notes, Folders & Tags Business Logic', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.folders.clear();
    await db.tags.clear();
    await db.outbox.clear();
  });

  describe('Notes Service CRUD & Lifecycle', () => {
    it('creates a note with valid schema defaults and atomic outbox logging', async () => {
      const note = await notesService.createNote({
        title: 'Deep Work Architecture',
        content: 'Design offline-first state synchronization.',
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe('Deep Work Architecture');
      expect(note.content).toBe('Design offline-first state synchronization.');
      expect(note.isPinned).toBe(false);
      expect(note.isArchived).toBe(false);
      expect(note.deletedAt).toBeNull();
      expect(note.version).toBe(1);
      expect(note.syncStatus).toBe('pending');

      const outbox = await db.outbox.where('entityId').equals(note.id).toArray();
      expect(outbox.length).toBe(1);
      expect(outbox[0].action).toBe('create');
      expect(outbox[0].entityType).toBe('note');
    });

    it('updates a note, increments version and logs outbox update', async () => {
      const note = await notesService.createNote({
        title: 'Draft',
        content: 'Initial thoughts',
      });

      const updated = await notesService.updateNote(note.id, {
        title: 'Final Draft',
        content: 'Refined thoughts',
      });

      expect(updated.title).toBe('Final Draft');
      expect(updated.version).toBe(2);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(note.updatedAt);

      const outbox = await db.outbox.where('entityId').equals(note.id).sortBy('timestamp');
      expect(outbox.length).toBe(2);
      expect(outbox[1].action).toBe('update');
    });

    it('soft deletes a note preserving the record and unsets it from active queries', async () => {
      const note = await notesService.createNote({
        title: 'To Be Soft Deleted',
        content: 'Preserve me in IndexedDB.',
      });

      await notesService.softDeleteNote(note.id);

      // Verify record is preserved in IndexedDB with deletedAt timestamp
      const storedNote = await db.notes.get(note.id);
      expect(storedNote).toBeDefined();
      expect(storedNote?.deletedAt).toBeTypeOf('number');

      // Verify active queries exclude the soft-deleted note
      const activeNotes = await notesService.getNotes();
      expect(activeNotes.some((n) => n.id === note.id)).toBe(false);

      // Verify includeDeleted query returns it
      const allNotes = await notesService.getNotes({ includeDeleted: true });
      expect(allNotes.some((n) => n.id === note.id)).toBe(true);

      const outbox = await db.outbox.where('entityId').equals(note.id).sortBy('timestamp');
      expect(outbox.length).toBe(2);
      expect(outbox[1].action).toBe('delete');
      expect((outbox[1].payload as any).deletedAt).toBeTypeOf('number');
    });

    it('restores a soft-deleted note, setting deletedAt back to null and incrementing version', async () => {
      const note = await notesService.createNote({
        title: 'Accidentally Deleted Note',
      });

      await notesService.softDeleteNote(note.id);
      expect((await db.notes.get(note.id))?.deletedAt).not.toBeNull();

      const restored = await notesService.restoreNote(note.id);
      expect(restored.deletedAt).toBeNull();
      expect(restored.version).toBe(3); // 1 (create) -> 2 (soft delete) -> 3 (restore)

      const activeNotes = await notesService.getNotes();
      expect(activeNotes.some((n) => n.id === note.id)).toBe(true);
    });

    it('permanently deletes a note and logs delete outbox event', async () => {
      const note = await notesService.createNote({
        title: 'Purge Me',
      });

      await notesService.permanentDeleteNote(note.id);

      const stored = await db.notes.get(note.id);
      expect(stored).toBeUndefined();

      const outbox = await db.outbox.where('entityId').equals(note.id).sortBy('timestamp');
      expect(outbox.length).toBe(2);
      expect(outbox[1].action).toBe('delete');
    });

    it('toggles pinned and archived states reactively', async () => {
      const note = await notesService.createNote({ title: 'Important' });

      const pinned = await notesService.togglePin(note.id);
      expect(pinned).toBe(true);
      expect((await db.notes.get(note.id))?.isPinned).toBe(true);

      const unpinned = await notesService.togglePin(note.id);
      expect(unpinned).toBe(false);
      expect((await db.notes.get(note.id))?.isPinned).toBe(false);

      const archived = await notesService.toggleArchive(note.id);
      expect(archived).toBe(true);
      expect((await db.notes.get(note.id))?.isArchived).toBe(true);

      // By default getNotes excludes archived
      const activeList = await notesService.getNotes();
      expect(activeList.some((n) => n.id === note.id)).toBe(false);

      // When includeArchived is requested, it is returned
      const withArchived = await notesService.getNotes({ includeArchived: true });
      expect(withArchived.some((n) => n.id === note.id)).toBe(true);
    });
  });

  describe('Single & Batch Note Folder Movement', () => {
    it('moves a single note to a target folder and removes folder when set to null', async () => {
      const folder = await foldersService.createFolder({ name: 'Work', color: '#6366f1' });
      const note = await notesService.createNote({ title: 'Task item' });

      expect(note.folderId).toBeNull();

      const moved = await notesService.moveNote(note.id, folder.id);
      expect(moved.folderId).toBe(folder.id);

      const unfiled = await notesService.moveNote(note.id, null);
      expect(unfiled.folderId).toBeNull();
    });

    it('performs atomic batch movement of multiple notes to a folder', async () => {
      const folder = await foldersService.createFolder({ name: 'Archive 2026', color: '#10b981' });
      const note1 = await notesService.createNote({ title: 'Report Q1' });
      const note2 = await notesService.createNote({ title: 'Report Q2' });
      const note3 = await notesService.createNote({ title: 'Report Q3' });

      const movedCount = await notesService.moveNotes([note1.id, note2.id, note3.id], folder.id);
      expect(movedCount).toBe(3);

      const updated1 = await db.notes.get(note1.id);
      const updated2 = await db.notes.get(note2.id);
      const updated3 = await db.notes.get(note3.id);

      expect(updated1?.folderId).toBe(folder.id);
      expect(updated2?.folderId).toBe(folder.id);
      expect(updated3?.folderId).toBe(folder.id);
      expect(updated1?.version).toBe(2);
      expect(updated2?.version).toBe(2);
      expect(updated3?.version).toBe(2);
    });
  });

  describe('Multi-field Search & Tag Filtering', () => {
    it('matches notes by substring search across title, content and tag names', async () => {
      const tag = await tagsService.createTag({ name: 'kubernetes' });

      const noteA = await notesService.createNote({
        title: 'Cluster Operations',
        content: 'Check worker node health.',
      });

      const noteB = await notesService.createNote({
        title: 'Database Replica',
        content: 'High-availability failover cluster.',
      });

      const noteC = await notesService.createNote({
        title: 'Microservices',
        content: 'Ingress routing definitions.',
        tagIds: [tag.id],
      });

      // Match by title
      const titleMatches = await notesService.getNotes({ searchQuery: 'Cluster' });
      expect(titleMatches.map((n) => n.id)).toContain(noteA.id);
      expect(titleMatches.map((n) => n.id)).toContain(noteB.id);

      // Match by content substring
      const contentMatches = await notesService.getNotes({ searchQuery: 'failover' });
      expect(contentMatches.length).toBe(1);
      expect(contentMatches[0].id).toBe(noteB.id);

      // Match by tag name substring
      const tagMatches = await notesService.getNotes({ searchQuery: 'kuber' });
      expect(tagMatches.length).toBe(1);
      expect(tagMatches[0].id).toBe(noteC.id);
    });

    it('filters notes by tagId when applied and returns the unfiltered list when cleared', async () => {
      const tag = await tagsService.createTag({ name: 'work' });
      const otherTag = await tagsService.createTag({ name: 'personal' });

      const tagged = await notesService.createNote({ title: 'Tagged', tagIds: [tag.id] });
      const otherTagged = await notesService.createNote({ title: 'Other Tagged', tagIds: [otherTag.id] });
      await notesService.createNote({ title: 'Untagged' });

      const filtered = await notesService.getNotes({ tagId: tag.id });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(tagged.id);
      expect(filtered.map((n) => n.id)).not.toContain(otherTagged.id);

      const cleared = await notesService.getNotes({ tagId: null });
      expect(cleared.length).toBe(3);
    });

    it('attaches and removes tags from notes and logs atomic outbox transactions', async () => {
      const tag1 = await tagsService.createTag({ name: 'urgent' });
      const tag2 = await tagsService.createTag({ name: 'review' });
      const note = await notesService.createNote({ title: 'Spec' });

      await notesService.addTag(note.id, tag1.id);
      let updated = (await db.notes.get(note.id))!;
      expect(updated.tagIds).toContain(tag1.id);

      await notesService.addTag(note.id, tag2.id);
      updated = (await db.notes.get(note.id))!;
      expect(updated.tagIds).toContain(tag2.id);
      expect(updated.tagIds.length).toBe(2);

      await notesService.removeTag(note.id, tag1.id);
      updated = (await db.notes.get(note.id))!;
      expect(updated.tagIds).not.toContain(tag1.id);
      expect(updated.tagIds).toContain(tag2.id);
    });
  });

  describe('Folders Service Cascading & Safety', () => {
    it('deleting a folder safely reassigns contained notes to null without deleting them', async () => {
      const folder = await foldersService.createFolder({ name: 'Projects', color: '#f59e0b' });
      const note1 = await notesService.createNote({ title: 'Project Alpha', folderId: folder.id });
      const note2 = await notesService.createNote({ title: 'Project Beta', folderId: folder.id });

      expect(note1.folderId).toBe(folder.id);
      expect(note2.folderId).toBe(folder.id);

      await foldersService.deleteFolder(folder.id);

      // Folder is deleted
      const checkFolder = await db.folders.get(folder.id);
      expect(checkFolder).toBeUndefined();

      // Notes are preserved with folderId: null
      const checkNote1 = await db.notes.get(note1.id);
      const checkNote2 = await db.notes.get(note2.id);
      expect(checkNote1).toBeDefined();
      expect(checkNote2).toBeDefined();
      expect(checkNote1?.folderId).toBeNull();
      expect(checkNote2?.folderId).toBeNull();
    });
  });

  describe('Tags Service Deduplication & Cascading', () => {
    it('deduplicates tags by name and trims whitespace', async () => {
      const tag1 = await tagsService.createTag({ name: '  design  ', color: '#ec4899' });
      const tag2 = await tagsService.createTag({ name: 'DESIGN' });

      expect(tag1.id).toBe(tag2.id);
      expect(tag1.name).toBe('design');

      const allTags = await tagsService.getTags();
      expect(allTags.length).toBe(1);
    });

    it('deleting a tag detaches it from all notes and tasks in atomic transaction', async () => {
      const tag = await tagsService.createTag({ name: 'deprecated' });
      const note = await notesService.createNote({ title: 'Old Note', tagIds: [tag.id] });

      expect((await db.notes.get(note.id))?.tagIds).toContain(tag.id);

      await tagsService.deleteTag(tag.id);

      expect(await db.tags.get(tag.id)).toBeUndefined();
      const updatedNote = await db.notes.get(note.id);
      expect(updatedNote?.tagIds).not.toContain(tag.id);
    });
  });
});
