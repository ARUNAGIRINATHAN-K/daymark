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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="border-b border-[var(--color-border-primary)] pb-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)]">
          <Archive className="h-3.5 w-3.5" />
          <span>Archive</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Archive
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Archived notes and completed tasks
        </p>
      </div>

      {/* Archived Notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Archived Notes ({archivedNotes.length})
        </h3>

        {archivedNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-10 text-center text-xs text-[var(--color-text-muted)]">
            No archived notes. Notes you archive will appear here safely.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-4 shadow-2xs"
              >
                <h4 className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1">
                  {note.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                  {note.content.replace(/[#*`_>-]/g, '').trim()}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-3 text-xs text-[var(--color-text-muted)]">
                  <span className="font-mono tabular-nums">{format(note.updatedAt, 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUnarchiveNote(note.id)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Unarchive
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-red-500"
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Completed Tasks Archive ({archivedTasks.length})
        </h3>

        {archivedTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-10 text-center text-xs text-[var(--color-text-muted)]">
            No completed tasks archived yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-secondary)] rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] shadow-2xs">
            {archivedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 transition hover:bg-[var(--color-bg-secondary)]"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs line-through text-[var(--color-text-muted)]">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleUnarchiveTask(task.id)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Reopen
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 text-[var(--color-text-muted)] hover:text-red-500"
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
