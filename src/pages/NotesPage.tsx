import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MoveNoteDialog } from '../components/notes/MoveNoteDialog';
import { NoteFilterBar } from '../components/notes/NoteFilterBar';
import { NoteList } from '../components/notes/NoteList';
import { useFolders, useTags } from '../hooks/useData';
import { useNotes } from '../hooks/useNotes';
import type { Note } from '../types';

export const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const folders = useFolders();
  const tags = useTags();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Modal state for moving notes
  const [movingNote, setMovingNote] = useState<Note | null>(null);

  // Use reactive Dexie-backed hook with active filters
  const { notes, createNote, togglePin, toggleArchive, softDeleteNote } = useNotes({
    searchQuery: searchQuery.trim() || undefined,
    folderId: selectedFolderId || undefined,
    tagId: selectedTagId || undefined,
    includeArchived: false,
    includeDeleted: false,
  });

  const handleCreateNote = async () => {
    const newNote = await createNote({
      title: 'Untitled Note',
      content: '',
      folderId: selectedFolderId,
      tagIds: selectedTagId ? [selectedTagId] : [],
    });
    navigate(`/notes/${newNote.id}`);
  };

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    await togglePin(note.id);
  };

  const handleToggleArchive = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    await toggleArchive(note.id);
  };

  const handleMoveNote = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    setMovingNote(note);
  };

  const handleDeleteNote = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (window.confirm(`Move "${note.title || 'Untitled Note'}" to trash?`)) {
      await softDeleteNote(note.id);
    }
  };

  const handleSelectTag = (e: React.MouseEvent, _note: Note, tagId: string) => {
    e.stopPropagation();
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedFolderId(null);
    setSelectedTagId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            All Notes
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </p>
        </div>

        <button
          onClick={handleCreateNote}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      </div>

      {/* Filter and Search Bar */}
      <NoteFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        selectedTagId={selectedTagId}
        onSelectTag={setSelectedTagId}
        folders={folders}
        tags={tags}
        onReset={handleResetFilters}
      />

      {/* Note List */}
      <NoteList
        notes={notes}
        onSelectNote={(note) => navigate(`/notes/${note.id}`)}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onMoveNote={handleMoveNote}
        onDeleteNote={handleDeleteNote}
        onSelectTag={handleSelectTag}
        selectedTagId={selectedTagId}
        onCreateNote={handleCreateNote}
      />

      {/* Move Note Dialog */}
      <MoveNoteDialog
        note={movingNote}
        isOpen={Boolean(movingNote)}
        onClose={() => setMovingNote(null)}
      />
    </div>
  );
};
export default NotesPage;
