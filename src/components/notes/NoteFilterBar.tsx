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
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes by title, content, or tag..."
            className="w-full rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] py-1.5 pl-8 pr-8 text-xs text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
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
            className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] outline-none cursor-pointer"
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
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reset filters
          </button>
        )}
      </div>

      {/* Tag Filters Strip */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)] mr-1 flex items-center gap-1">
            <TagIcon className="h-3 w-3" /> Tags:
          </span>
          {tags.map((t) => {
            const isSelected = selectedTagId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTag(isSelected ? null : t.id)}
                className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${
                  isSelected
                    ? 'bg-[var(--color-accent)] text-white shadow-2xs'
                    : 'bg-[var(--color-bg-card)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
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
