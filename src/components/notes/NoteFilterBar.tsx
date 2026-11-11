import React from 'react';
import { Search, X, Folder as FolderIcon, Tag as TagIcon, RotateCcw } from 'lucide-react';
import type { Folder, Tag } from '../../types';

export interface NoteFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  folders: Folder[];
  tags: Tag[];
  onReset?: () => void;
}

export const NoteFilterBar: React.FC<NoteFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedFolderId,
  onSelectFolder,
  selectedTagId,
  onSelectTag,
  folders,
  tags,
  onReset,
}) => {
  const hasActiveFilters = Boolean(searchQuery || selectedFolderId || selectedTagId);

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onSearchChange('');
      onSelectFolder(null);
      onSelectTag(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Substring Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes by title, content, or tag..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none transition focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Folder Filter Dropdown */}
        <div className="relative">
          <select
            value={selectedFolderId || ''}
            onChange={(e) => onSelectFolder(e.target.value ? e.target.value : null)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">All Folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                📁 {folder.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Active Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <RotateCcw className="h-3 w-3" />
            Reset filters
          </button>
        )}
      </div>

      {/* Tag Filters Strip */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
            <TagIcon className="h-3 w-3" /> Tags:
          </span>
          {tags.map((t) => {
            const isSelected = selectedTagId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTag(isSelected ? null : t.id)}
                className={`rounded-lg px-2.5 py-0.5 text-xs font-medium transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
