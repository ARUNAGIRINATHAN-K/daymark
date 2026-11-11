import React from 'react';
import { format } from 'date-fns';
import { Archive, Folder as FolderIcon, MoveRight, Pin, Trash2 } from 'lucide-react';
import { useFolders } from '../../hooks/useData';
import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onToggleArchive: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onClick,
  onTogglePin,
  onToggleArchive,
  onMove,
  onDelete,
}) => {
  const folders = useFolders();
  const folder = note.folderId ? folders.find((f) => f.id === note.folderId) : null;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-indigo-400 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
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

      <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {note.content.replace(/[#*`_>-]/g, '').trim() || 'No preview text'}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums">{format(note.updatedAt, 'MMM d')}</span>
          {folder && (
            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
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
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
            title="Move note to folder"
          >
            <MoveRight className="h-3 w-3" />
          </button>
          <button
            onClick={onToggleArchive}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
            title={note.isArchived ? 'Unarchive' : 'Archive'}
          >
            <Archive className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            title="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
