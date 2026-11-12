import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Folder as FolderIcon,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react';
import { useFolders, useNotes, useTags } from '../../hooks/useData';
import { taskService } from '../../services/taskService';
import { useAppStore } from '../../store/useAppStore';
import type { Task, TaskPriority } from '../../types';

interface TaskDetailViewProps {
  task: Task;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task }) => {
  const folders = useFolders();
  const tags = useTags();
  const notes = useNotes();
  const { setActiveItem } = useAppStore();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [isSaved, setIsSaved] = useState(true);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setIsSaved(true);
  }, [task.id]);

  const triggerAutoSave = (newTitle: string, newDesc: string) => {
    setIsSaved(false);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await taskService.update(task.id, {
          title: newTitle,
          description: newDesc,
        });
        setIsSaved(true);
      } catch (err) {
        console.error('Failed to update task:', err);
      }
    }, 400);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setTitle(next);
    triggerAutoSave(next, description);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDescription(next);
    triggerAutoSave(title, next);
  };

  const handleToggleCompletion = async () => {
    await taskService.toggleCompletion(task.id);
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    await taskService.update(task.id, { priority });
  };

  const handleFolderChange = async (folderId: string | null) => {
    await taskService.update(task.id, { folderId });
  };

  const handleToggleTag = async (tagId: string) => {
    const next = task.tagIds.includes(tagId)
      ? task.tagIds.filter((t) => t !== tagId)
      : [...task.tagIds, tagId];
    await taskService.update(task.id, { tagIds: next });
  };

  const handleDueDateChange = async (dateStr: string) => {
    if (!dateStr) {
      await taskService.update(task.id, { dueDate: null });
      return;
    }
    const timestamp = new Date(dateStr).getTime();
    await taskService.update(task.id, { dueDate: timestamp });
  };

  const setDueDatePreset = async (daysFromNow: number | null) => {
    if (daysFromNow === null) {
      await taskService.update(task.id, { dueDate: null });
      return;
    }
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    target.setHours(17, 0, 0, 0);
    await taskService.update(task.id, { dueDate: target.getTime() });
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this task?')) {
      await taskService.delete(task.id);
      setActiveItem(null, null);
    }
  };

  const linkedNote = task.noteId ? notes.find((n) => n.id === task.noteId) : null;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleCompletion}
            className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {task.isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 hover:text-indigo-500" />
            )}
            <span>{task.isCompleted ? 'Completed' : 'Mark as Complete'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isSaved ? (
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Saved locally
            </span>
          ) : (
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400 animate-pulse">
              Saving...
            </span>
          )}

          <button
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Task Editor Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="What needs to be done?"
              className={`w-full bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 ${
                task.isCompleted
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
            {/* Priority Selector */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Priority
              </label>
              <div className="mt-1.5 flex items-center gap-1">
                {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                  const isActive = task.priority === p;
                  const colors =
                    p === 'high'
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                      : p === 'medium'
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition ${
                        isActive ? `${colors} font-semibold shadow-xs` : 'border-transparent text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Folder Selector */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Folder
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <FolderIcon className="h-3.5 w-3.5 text-indigo-500" />
                <select
                  value={task.folderId || ''}
                  onChange={(e) => handleFolderChange(e.target.value || null)}
                  className="w-full bg-transparent text-xs outline-none cursor-pointer"
                >
                  <option value="" className="dark:bg-slate-900">Uncategorized</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id} className="dark:bg-slate-900">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date Presets & Picker */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Due Date
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setDueDatePreset(0)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDueDatePreset(1)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setDueDatePreset(7)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Next Week
                </button>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDatePreset(null)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Tags
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {tags.map((t) => {
                  const isChecked = task.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        isChecked
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900'
                      }`}
                    >
                      #{t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description Textarea */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Task Notes & Description
            </label>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Add details, checklists, acceptance criteria, or reference links..."
              rows={6}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent p-4 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-500 dark:border-slate-800 dark:text-slate-200 dark:placeholder:text-slate-600 dark:focus:border-indigo-400"
            />
          </div>

          {/* Linked Note (if applicable) */}
          {linkedNote && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-950/60 dark:bg-indigo-950/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Linked Note
              </span>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                    {linkedNote.title}
                  </h4>
                  <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {linkedNote.content.substring(0, 80)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveItem(linkedNote.id, 'note')}
                  className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-300"
                >
                  Open Note
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800">
            <p>Created: {format(task.createdAt, 'PPP · p')}</p>
            {task.completedAt && <p>Completed: {format(task.completedAt, 'PPP · p')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
