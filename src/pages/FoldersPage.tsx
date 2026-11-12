import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFolders, useNotes, useTasks } from '../hooks/useData';
import { folderService } from '../services/folderService';
import { useAppStore } from '../store/useAppStore';

export const FoldersPage: React.FC = () => {
  const navigate = useNavigate();
  const folders = useFolders();
  const notes = useNotes();
  const tasks = useTasks();
  const { setFolderModalOpen } = useAppStore();

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete folder? Contained notes and tasks will be moved to Uncategorized.')) {
      await folderService.delete(folderId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Workspace Folders
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Organize notes and tasks into collections
          </p>
        </div>

        <button
          onClick={() => setFolderModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)] cursor-pointer"
        >
          <FolderPlus className="h-4 w-4" />
          New Folder
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-primary)] py-16 text-center">
          <FolderIcon className="mx-auto h-8 w-8 text-[var(--color-text-muted)] opacity-60" />
          <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
            No folders created yet.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Create folders to categorize your notes and task workflows.
          </p>
          <button
            onClick={() => setFolderModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] transition cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Create First Folder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder) => {
            const folderNotes = notes.filter((n) => n.folderId === folder.id);
            const folderTasks = tasks.filter((t) => t.folderId === folder.id);

            return (
              <div
                key={folder.id}
                onClick={() => navigate('/notes')}
                className="group relative cursor-pointer rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-5 shadow-2xs transition hover:border-[var(--color-accent)] hover:shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-2xs"
                      style={{ backgroundColor: folder.color || '#3b49df' }}
                    >
                      <FolderIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                        {folder.name}
                      </h3>
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">
                        Created {format(folder.createdAt, 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                    className="rounded-lg p-1.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title="Delete folder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border-secondary)] pt-3 text-xs text-[var(--color-text-muted)]">
                  <span className="font-mono tabular-nums">{folderNotes.length} notes</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{folderTasks.length} tasks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
