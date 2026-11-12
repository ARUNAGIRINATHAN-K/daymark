import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { MarkdownEditor } from '../components/editor/MarkdownEditor';
import { useNotes } from '../hooks/useData';
import { noteService } from '../services/noteService';
import type { Note } from '../types';

export const NoteEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notes = useNotes();
  const [localNote, setLocalNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const foundInLive = notes.find((n) => n.id === id);
      if (foundInLive) {
        setLocalNote(foundInLive);
        setIsLoading(false);
        return;
      }

      // Fallback direct service query
      const dbNote = await noteService.getById(id);
      if (dbNote) {
        setLocalNote(dbNote);
      }
      setIsLoading(false);
    }
    load();
  }, [id, notes]);

  const handleCreateNew = async () => {
    const newNote = await noteService.create({
      title: 'Untitled Note',
      content: '',
    });
    navigate(`/notes/${newNote.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Loading note...
      </div>
    );
  }

  if (!localNote) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[var(--color-bg-primary)]">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Note Not Found</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          This note may have been deleted or does not exist.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => navigate('/notes')}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Notes
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Note
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-2 text-xs text-[var(--color-text-muted)]">
        <button
          onClick={() => navigate('/notes')}
          className="flex items-center gap-1 hover:text-[var(--color-accent)] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Notes</span>
        </button>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[var(--color-text-primary)] truncate max-w-xs">
          {localNote.title || 'Untitled Note'}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <MarkdownEditor note={localNote} />
      </div>
    </div>
  );
};
