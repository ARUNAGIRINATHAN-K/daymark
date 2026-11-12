import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { db } from '../db/database';
import { notesService } from '../services/notes.service';
import { taskService } from '../services/taskService';
import type { Note, Task } from '../types';

export const TrashPage: React.FC = () => {
  const deletedNotes = useLiveQuery(
    () => db.notes.filter((n) => n.deletedAt !== null).toArray(),
    []
  ) ?? [];

  const deletedTasks = useLiveQuery(
    () => db.tasks.filter((t) => t.deletedAt !== null).toArray(),
    []
  ) ?? [];

  const totalCount = deletedNotes.length + deletedTasks.length;

  const handleRestoreNote = async (note: Note) => {
    await notesService.restoreNote(note.id);
  };

  const handlePurgeNote = async (noteId: string) => {
    if (window.confirm('Permanently delete this note? This cannot be undone.')) {
      await notesService.permanentDeleteNote(noteId);
    }
  };

  const handleRestoreTask = async (task: Task) => {
    await taskService.update(task.id, { deletedAt: null });
  };

  const handlePurgeTask = async (taskId: string) => {
    if (window.confirm('Permanently delete this task? This cannot be undone.')) {
      await taskService.delete(taskId);
    }
  };

  const handleEmptyTrash = async () => {
    if (window.confirm(`Permanently purge all ${totalCount} items from Trash? This cannot be undone.`)) {
      for (const note of deletedNotes) {
        await notesService.permanentDeleteNote(note.id);
      }
      for (const task of deletedTasks) {
        await taskService.delete(task.id);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)]">
            <Trash2 className="h-3.5 w-3.5" />
            <span>Trash</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Trash
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Deleted items can be restored or removed permanently
          </p>
        </div>

        {totalCount > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-950/60 dark:bg-red-950/40 dark:text-red-300 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Empty Trash ({totalCount})
          </button>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-16 text-center">
          <Trash2 className="mx-auto h-8 w-8 text-[var(--color-text-muted)] opacity-60" />
          <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Trash is currently empty.
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Items you delete will appear here. You can restore or permanently remove them.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deleted Notes Section */}
          {deletedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Notes ({deletedNotes.length})
              </h3>
              <div className="divide-y divide-[var(--color-border-secondary)] rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] shadow-2xs">
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-4 transition hover:bg-[var(--color-bg-secondary)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-xs font-semibold uppercase text-[var(--color-accent)]">
                          note
                        </span>
                        <h4 className="text-xs font-medium text-[var(--color-text-primary)]">
                          {note.title || 'Untitled Note'}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        Deleted {note.deletedAt ? format(note.deletedAt, 'MMM d, yyyy HH:mm') : 'recently'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreNote(note)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeNote(note.id)}
                        className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-red-500 cursor-pointer"
                        title="Purge permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deleted Tasks Section */}
          {deletedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Tasks ({deletedTasks.length})
              </h3>
              <div className="divide-y divide-[var(--color-border-secondary)] rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] shadow-2xs">
                {deletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 transition hover:bg-[var(--color-bg-secondary)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          task
                        </span>
                        <h4 className="text-xs font-medium text-[var(--color-text-primary)]">
                          {task.title}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        Deleted {task.deletedAt ? format(task.deletedAt, 'MMM d, yyyy HH:mm') : 'recently'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreTask(task)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeTask(task.id)}
                        className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-red-500 cursor-pointer"
                        title="Purge permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
