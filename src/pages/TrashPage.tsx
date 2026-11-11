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
    if (window.confirm('Permanently purge this note from IndexedDB?')) {
      await notesService.permanentDeleteNote(noteId);
    }
  };

  const handleRestoreTask = async (task: Task) => {
    await taskService.update(task.id, { deletedAt: null });
  };

  const handlePurgeTask = async (taskId: string) => {
    if (window.confirm('Permanently purge this task from IndexedDB?')) {
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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
            <span>Staged Deletions</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trash
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Soft-deleted notes and tasks can be restored or purged permanently
          </p>
        </div>

        {totalCount > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-950/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Empty Trash ({totalCount})
          </button>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
          <Trash2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            Trash is currently empty.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Soft-deleted notes stay staged here with full integrity before permanent purge.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deleted Notes Section */}
          {deletedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Notes ({deletedNotes.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800/60 dark:border-slate-800 dark:bg-slate-900/60">
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          note
                        </span>
                        <h4 className="text-xs font-medium text-slate-900 dark:text-white">
                          {note.title || 'Untitled Note'}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Deleted {note.deletedAt ? format(note.deletedAt, 'MMM d, yyyy HH:mm') : 'recently'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreNote(note)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 text-indigo-500" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeNote(note.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-red-500"
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tasks ({deletedTasks.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800/60 dark:border-slate-800 dark:bg-slate-900/60">
                {deletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          task
                        </span>
                        <h4 className="text-xs font-medium text-slate-900 dark:text-white">
                          {task.title}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Deleted {task.deletedAt ? format(task.deletedAt, 'MMM d, yyyy HH:mm') : 'recently'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreTask(task)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 text-indigo-500" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeTask(task.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-red-500"
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
