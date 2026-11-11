import React from 'react';
import { CheckSquare, FileText, Plus } from 'lucide-react';
import { useNotes, useTasks } from '../../hooks/useData';
import { noteService } from '../../services/noteService';
import { taskService } from '../../services/taskService';
import { useAppStore } from '../../store/useAppStore';
import { MarkdownEditor } from '../editor/MarkdownEditor';
import { TaskDetailView } from '../tasks/TaskDetailView';

export const ActiveWorkspace: React.FC = () => {
  const { activeItemId, activeItemType, setActiveItem, selectedFolderId } = useAppStore();
  const notes = useNotes();
  const tasks = useTasks();

  const handleCreateNote = async () => {
    const newNote = await noteService.create({
      title: 'Untitled Note',
      content: '',
      folderId: selectedFolderId,
    });
    setActiveItem(newNote.id, 'note');
  };

  const handleCreateTask = async () => {
    const newTask = await taskService.create({
      title: 'New Task',
      folderId: selectedFolderId,
    });
    setActiveItem(newTask.id, 'task');
  };

  if (activeItemType === 'note' && activeItemId) {
    const note = notes.find((n) => n.id === activeItemId);
    if (note) {
      return <MarkdownEditor note={note} />;
    }
  }

  if (activeItemType === 'task' && activeItemId) {
    const task = tasks.find((t) => t.id === activeItemId);
    if (task) {
      return <TaskDetailView task={task} />;
    }
  }

  // Zero-State Workspace
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-950">
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <FileText className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
          No Note or Task Selected
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Select an item from the list to view its details, or create a new note or task to begin working offline.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </button>
          <button
            onClick={handleCreateTask}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            New Task
          </button>
        </div>
      </div>
    </div>
  );
};
