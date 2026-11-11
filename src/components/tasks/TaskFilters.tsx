import React from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import type { Folder, TaskPriority, TaskStatus } from '../../types';

export interface TaskFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStatus?: TaskStatus | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  selectedPriority?: TaskPriority | 'all';
  onPriorityChange: (priority: TaskPriority | 'all') => void;
  selectedFolderId?: string | null;
  onFolderChange: (folderId: string | null) => void;
  sortBy?: 'dueDate' | 'priority' | 'title' | 'createdAt';
  onSortChange?: (sort: 'dueDate' | 'priority' | 'title' | 'createdAt') => void;
  folders: Folder[];
  onReset?: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus = 'all',
  onStatusChange,
  selectedPriority = 'all',
  onPriorityChange,
  selectedFolderId,
  onFolderChange,
  sortBy = 'createdAt',
  onSortChange,
  folders,
  onReset,
}) => {
  const hasActiveFilters = Boolean(
    searchQuery || selectedStatus !== 'all' || selectedPriority !== 'all' || selectedFolderId
  );

  return (
    <div className="space-y-3">
      {/* Search and Sort row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none transition focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Folder Dropdown */}
        <select
          value={selectedFolderId || ''}
          onChange={(e) => onFolderChange(e.target.value || null)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">All Folders</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              📁 {f.name}
            </option>
          ))}
        </select>

        {/* Sort selector */}
        {onSortChange && (
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="createdAt">Sort by: Created Date</option>
            <option value="dueDate">Sort by: Due Date</option>
            <option value="priority">Sort by: Priority</option>
            <option value="title">Sort by: Title</option>
          </select>
        )}

        {/* Reset button */}
        {hasActiveFilters && onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Status & Priority Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
          {(['all', 'todo', 'in_progress', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => onStatusChange(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                selectedStatus === st
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Priority Filter Strip */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Priority:</span>
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((pr) => {
            const isSelected = selectedPriority === pr;
            return (
              <button
                key={pr}
                onClick={() => onPriorityChange(pr)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {pr}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
