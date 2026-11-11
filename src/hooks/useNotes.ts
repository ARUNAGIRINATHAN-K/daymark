import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { notesService, type NoteFilterOptions } from '../services/notes.service';
import type { CreateNoteInput, Note, UpdateNoteInput, UUID } from '../types';

export function useNotes(options: NoteFilterOptions = {}) {
  const notes = useLiveQuery(
    () => notesService.getNotes(options),
    [
      options.folderId,
      options.tagId,
      options.includeArchived,
      options.includeDeleted,
      options.searchQuery,
    ]
  ) ?? [];

  const createNote = useCallback(async (input?: CreateNoteInput): Promise<Note> => {
    return notesService.createNote(input);
  }, []);

  const updateNote = useCallback(async (id: UUID, updates: UpdateNoteInput): Promise<Note> => {
    return notesService.updateNote(id, updates);
  }, []);

  const softDeleteNote = useCallback(async (id: UUID): Promise<void> => {
    return notesService.softDeleteNote(id);
  }, []);

  const restoreNote = useCallback(async (id: UUID): Promise<Note> => {
    return notesService.restoreNote(id);
  }, []);

  const permanentDeleteNote = useCallback(async (id: UUID): Promise<void> => {
    return notesService.permanentDeleteNote(id);
  }, []);

  const togglePin = useCallback(async (id: UUID): Promise<boolean> => {
    return notesService.togglePin(id);
  }, []);

  const toggleArchive = useCallback(async (id: UUID): Promise<boolean> => {
    return notesService.toggleArchive(id);
  }, []);

  const moveNote = useCallback(async (id: UUID, folderId: UUID | null): Promise<Note> => {
    return notesService.moveNote(id, folderId);
  }, []);

  const moveNotes = useCallback(async (ids: UUID[], folderId: UUID | null): Promise<number> => {
    return notesService.moveNotes(ids, folderId);
  }, []);

  return {
    notes,
    createNote,
    updateNote,
    softDeleteNote,
    restoreNote,
    permanentDeleteNote,
    togglePin,
    toggleArchive,
    moveNote,
    moveNotes,
  };
}

export function useNote(id: UUID | undefined): { note: Note | undefined; isLoading: boolean } {
  const note = useLiveQuery(() => (id ? notesService.getNoteById(id) : undefined), [id]);
  return {
    note,
    isLoading: note === undefined && Boolean(id),
  };
}
