import React from 'react';
import { FileText, Pin, Plus } from 'lucide-react';
import { NoteCard } from './NoteCard';
import type { Note } from '../../types';

export interface NoteListProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onTogglePin: (e: React.MouseEvent, note: Note) => void;
  onToggleArchive: (e: React.MouseEvent, note: Note) => void;
  onMoveNote: (e: React.MouseEvent, note: Note) => void;
  onDeleteNote: (e: React.MouseEvent, note: Note) => void;
  onSelectTag?: (e: React.MouseEvent, note: Note, tagId: string) => void;
  selectedTagId?: string | null;
  onCreateNote?: () => void;
  emptyMessage?: string;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  onSelectNote,
  onTogglePin,
  onToggleArchive,
  onMoveNote,
  onDeleteNote,
  onSelectTag,
  selectedTagId,
  onCreateNote,
  emptyMessage = 'No notes found matching your filters.',
}) => {
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const regularNotes = notes.filter((n) => !n.isPinned);

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
        <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
        {onCreateNote && (
          <button
            onClick={onCreateNote}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Note
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pinned Section */}
      {pinnedNotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span>Pinned Notes ({pinnedNotes.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => onSelectNote(note)}
                onTogglePin={(e) => onTogglePin(e, note)}
                onToggleArchive={(e) => onToggleArchive(e, note)}
                onMove={(e) => onMoveNote(e, note)}
                onDelete={(e) => onDeleteNote(e, note)}
                onSelectTag={onSelectTag ? (e, tagId) => onSelectTag(e, note, tagId) : undefined}
                selectedTagId={selectedTagId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Notes Section */}
      <div className="space-y-3">
        {pinnedNotes.length > 0 && (
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            All Notes ({regularNotes.length})
          </h3>
        )}

        {regularNotes.length === 0 && pinnedNotes.length > 0 ? (
          <p className="text-xs italic text-slate-400">All visible notes are pinned above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => onSelectNote(note)}
                onTogglePin={(e) => onTogglePin(e, note)}
                onToggleArchive={(e) => onToggleArchive(e, note)}
                onMove={(e) => onMoveNote(e, note)}
                onDelete={(e) => onDeleteNote(e, note)}
                onSelectTag={onSelectTag ? (e, tagId) => onSelectTag(e, note, tagId) : undefined}
                selectedTagId={selectedTagId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
