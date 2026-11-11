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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Workspace Folders
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Organize notes and tasks into collections
          </p>
        </div>

        <button
          onClick={() => setFolderModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-indigo-700"
        >
          <FolderPlus className="h-4 w-4" />
          New Folder
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => {
          const folderNotes = notes.filter((n) => n.folderId === folder.id);
          const folderTasks = tasks.filter((t) => t.folderId === folder.id);

          return (
            <div
              key={folder.id}
              onClick={() => navigate('/notes')}
              className="group relative cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-indigo-400 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-600"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-2xs"
                    style={{ backgroundColor: folder.color || '#6366f1' }}
                  >
                    <FolderIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {folder.name}
                    </h3>
                    <span className="font-mono text-[10px] text-slate-400">
                      Created {format(folder.createdAt, 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDeleteFolder(e, folder.id)}
                  className="rounded-lg p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  title="Delete folder"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
                <span className="font-mono tabular-nums">{folderNotes.length} notes</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{folderTasks.length} tasks</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
