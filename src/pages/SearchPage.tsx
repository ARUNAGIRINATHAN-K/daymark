import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileText, Search, Tag, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFolders, useNotes, useTags, useTasks } from '../hooks/useData';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const notes = useNotes();
  const tasks = useTasks();
  const folders = useFolders();
  const tags = useTags();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'notes' | 'tasks'>('all');

  const q = query.trim().toLowerCase();

  const matchedNotes = q
    ? notes.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      )
    : [];

  const matchedTasks = q
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      )
    : [];

  const totalMatches =
    (filterType === 'all' || filterType === 'notes' ? matchedNotes.length : 0) +
    (filterType === 'all' || filterType === 'tasks' ? matchedTasks.length : 0);

  const getFolder = (folderId?: string | null) => {
    if (!folderId) return null;
    return folders.find((f) => f.id === folderId);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="border-b border-[var(--color-border-primary)] pb-5">
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Global Search
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Find notes, tasks, and checklists instantly
        </p>

        {/* Search Bar Input */}
        <div className="relative mt-4">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type keywords to search across all notes and tasks..."
            className="w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] py-3 pl-11 pr-10 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] shadow-2xs outline-none transition focus:border-[var(--color-accent)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="mt-3 flex items-center gap-2">
          {(['all', 'notes', 'tasks'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition cursor-pointer ${
                filterType === type
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-card)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {type === 'all' ? `All Results (${totalMatches})` : type}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      {!q ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-400 dark:border-slate-800">
          Type keywords above to search your notes and tasks.
        </div>
      ) : totalMatches === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-400 dark:border-slate-800">
          No matches found for "{query}".
        </div>
      ) : (
        <div className="space-y-6">
          {/* Notes Matches */}
          {(filterType === 'all' || filterType === 'notes') && matchedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Notes ({matchedNotes.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {matchedNotes.map((note) => {
                  const folder = getFolder(note.folderId);
                  return (
                    <div
                      key={note.id}
                      onClick={() => navigate(`/notes/${note.id}`)}
                      className="cursor-pointer rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-4 shadow-2xs transition hover:border-[var(--color-accent)]"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--color-accent)]" />
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1">
                          {note.title}
                        </h4>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                        {note.content.replace(/[#*`_>-]/g, '').trim()}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <span className="font-mono tabular-nums">{format(note.updatedAt, 'MMM d, yyyy')}</span>
                        {folder && <span>{folder.name}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks Matches */}
          {(filterType === 'all' || filterType === 'tasks') && matchedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Tasks ({matchedTasks.length})
              </h3>
              <div className="divide-y divide-[var(--color-border-secondary)] rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] shadow-2xs">
                {matchedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="flex items-center justify-between p-3.5 transition cursor-pointer hover:bg-[var(--color-bg-secondary)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          task.isCompleted ? 'text-emerald-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-xs font-medium text-slate-900 dark:text-white">
                        {task.title}
                      </span>
                    </div>
                    <span className="text-xs uppercase font-semibold text-slate-400">
                      {task.priority}
                    </span>
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
