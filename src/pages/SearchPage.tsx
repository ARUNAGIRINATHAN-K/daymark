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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      <div className="border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Global Search
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Find notes, tasks, checklists, and snippets instantly across IndexedDB
        </p>

        {/* Search Bar Input */}
        <div className="relative mt-4">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type keywords to search across all notes and tasks..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm text-slate-900 shadow-2xs outline-none transition focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${
                filterType === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
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
          Type search keywords in the input above to explore your offline database.
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
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {note.title}
                        </h4>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {note.content.replace(/[#*`_>-]/g, '').trim()}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tasks ({matchedTasks.length})
              </h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800/60 dark:border-slate-800 dark:bg-slate-900/60">
                {matchedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="flex items-center justify-between p-3.5 transition cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
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
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
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
