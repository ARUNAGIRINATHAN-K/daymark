import React, { useState } from 'react';
import { Folder as FolderIcon, MoveRight, X } from 'lucide-react';
import { useFolders } from '../../hooks/useData';
import { notesService } from '../../services/notes.service';
import type { Note, UUID } from '../../types';

interface MoveNoteDialogProps {
  note: Note | null;
  noteIds?: UUID[];
  isOpen: boolean;
  onClose: () => void;
  onMoved?: () => void;
}

export const MoveNoteDialog: React.FC<MoveNoteDialogProps> = ({
  note,
  noteIds,
  isOpen,
  onClose,
  onMoved,
}) => {
  const folders = useFolders();
  const [targetFolderId, setTargetFolderId] = useState<UUID | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const count = noteIds ? noteIds.length : note ? 1 : 0;
  const targetIds = noteIds || (note ? [note.id] : []);

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIds.length === 0) return;

    try {
      setIsSubmitting(true);
      const destination = targetFolderId === '' ? null : targetFolderId;
      await notesService.moveNotes(targetIds, destination);
      onMoved?.();
      onClose();
    } catch (err) {
      console.error('Failed to move notes:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoveRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Move {count === 1 ? 'Note' : `${count} Notes`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleMove} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Select Destination Folder
            </label>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs transition ${
                  targetFolderId === ''
                    ? 'border-indigo-500 bg-indigo-50/60 font-semibold text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  name="destinationFolder"
                  value=""
                  checked={targetFolderId === ''}
                  onChange={() => setTargetFolderId('')}
                  className="sr-only"
                />
                <FolderIcon className="h-4 w-4 text-slate-400" />
                <span>Uncategorized (No Folder)</span>
              </label>

              {folders.map((folder) => {
                const isSelected = targetFolderId === folder.id;
                return (
                  <label
                    key={folder.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 font-semibold text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destinationFolder"
                      value={folder.id}
                      checked={isSelected}
                      onChange={() => setTargetFolderId(folder.id)}
                      className="sr-only"
                    />
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: folder.color || '#6366f1' }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Moving...' : 'Move to Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
