import React from 'react';
import { format } from 'date-fns';
import { Archive, Folder as FolderIcon, MoveRight, Pin, Trash2 } from 'lucide-react';
import { useFolders, useTags } from '../../hooks/useData';
import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onToggleArchive: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onSelectTag?: (e: React.MouseEvent, tagId: string) => void;
  selectedTagId?: string | null;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onClick,
  onTogglePin,
  onToggleArchive,
  onMove,
  onDelete,
  onSelectTag,
  selectedTagId,
}) => {
  const folders = useFolders();
  const tags = useTags();
  const folder = note.folderId ? folders.find((f) => f.id === note.folderId) : null;
  const noteTags = tags.filter((t) => note.tagIds.includes(t.id));

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-4 shadow-2xs transition hover:border-[var(--color-accent)] hover:shadow-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition">
          {note.title || 'Untitled Note'}
        </h3>
        <button
          onClick={onTogglePin}
          className={`rounded p-1 transition ${
            note.isPinned
              ? 'text-amber-500 fill-amber-500'
              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:text-slate-600'
          }`}
          title={note.isPinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {note.content.replace(/[#*`_>-]/g, '').trim() || 'No preview text'}
      </p>

      {noteTags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {noteTags.map((tag) => {
            const isSelected = selectedTagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag?.(e, tag.id);
                }}
                aria-pressed={isSelected}
                title={`Filter notes by #${tag.name}`}
                className={`rounded-md px-2 py-0.5 text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--color-accent)] text-white shadow-2xs'
                    : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-accent)]'
                }`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-3 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums">{format(note.updatedAt, 'MMM d')}</span>
          {folder && (
            <span className="flex items-center gap-1 font-medium text-[var(--color-text-secondary)]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: folder.color }}
              />
              <span className="truncate max-w-[80px]">{folder.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMove}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-accent)]"
            title="Move note to folder"
          >
            <MoveRight className="h-3 w-3" />
          </button>
          <button
            onClick={onToggleArchive}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-accent)]"
            title={note.isArchived ? 'Unarchive' : 'Archive'}
          >
            <Archive className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            title="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
