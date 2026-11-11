import React from 'react';
import { format } from 'date-fns';
import { Archive, ArchiveRestore, CheckCircle2, FileText, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotes, useTasks } from '../hooks/useData';
import { noteService } from '../services/noteService';
import { taskService } from '../services/taskService';

export const ArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const notes = useNotes();
  const tasks = useTasks();

  const archivedNotes = notes.filter((n) => n.isArchived);
  const archivedTasks = tasks.filter((t) => t.isCompleted);

  const handleUnarchiveNote = async (noteId: string) => {
    await noteService.toggleArchive(noteId);
  };

  const handleUnarchiveTask = async (taskId: string) => {
    await taskService.update(taskId, { isCompleted: false });
  };

  const handleDeleteNote = async (noteId: string) => {
    if (window.confirm('Delete note permanently?')) {
      await noteService.delete(noteId);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Delete task permanently?')) {
      await taskService.delete(taskId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      <div className="border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Archive className="h-3.5 w-3.5" />
          <span>Historical Storage</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Archive
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Archived notes and completed workflows retained locally
        </p>
      </div>

      {/* Archived Notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Archived Notes ({archivedNotes.length})
        </h3>

        {archivedNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400 dark:border-slate-800">
            No archived notes. Notes you archive will appear here safely.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60"
              >
                <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                  {note.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {note.content.replace(/[#*`_>-]/g, '').trim()}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800">
                  <span className="font-mono tabular-nums">{format(note.updatedAt, 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUnarchiveNote(note.id)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Unarchive
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Historical Tasks */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Completed Tasks Archive ({archivedTasks.length})
        </h3>

        {archivedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400 dark:border-slate-800">
            No completed tasks archived yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800/60 dark:border-slate-800 dark:bg-slate-900/60">
            {archivedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs line-through text-slate-500 dark:text-slate-400">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    onClick={() => handleUnarchiveTask(task.id)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Reopen
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 text-slate-400 hover:text-red-500"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
