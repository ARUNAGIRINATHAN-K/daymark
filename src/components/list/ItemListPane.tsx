import React from 'react';
import { format, isPast, isToday } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  Filter,
  Pin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useFilteredItems, useFolders, useTags } from '../../hooks/useData';
import { noteService } from '../../services/noteService';
import { taskService } from '../../services/taskService';
import { useAppStore } from '../../store/useAppStore';
import type { MainView, Note, Task } from '../../types';

export const ItemListPane: React.FC = () => {
  const {
    activeView,
    setActiveView,
    searchQuery,
    setSearchQuery,
    activeItemId,
    setActiveItem,
    selectedFolderId,
    selectedTagId,
    resetFilters,
  } = useAppStore();

  const { notes, tasks } = useFilteredItems();
  const folders = useFolders();
  const tags = useTags();

  const handleCreateNote = async () => {
    const newNote = await noteService.create({
      title: 'Untitled Note',
      content: '',
      folderId: selectedFolderId,
      tagIds: selectedTagId ? [selectedTagId] : [],
    });
    setActiveItem(newNote.id, 'note');
  };

  const handleCreateTask = async () => {
    const newTask = await taskService.create({
      title: 'New Task',
      folderId: selectedFolderId,
      tagIds: selectedTagId ? [selectedTagId] : [],
    });
    setActiveItem(newTask.id, 'task');
  };

  const handleTaskCheckboxClick = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await taskService.toggleCompletion(taskId);
  };

  // Combine items according to view
  type UnifiedItem = { type: 'note'; item: Note } | { type: 'task'; item: Task };

  const combinedItems: UnifiedItem[] = [];

  // If in a note-only view
  if (activeView === 'notes') {
    notes.forEach((n) => combinedItems.push({ type: 'note', item: n }));
  } else if (
    activeView === 'tasks' ||
    activeView === 'today' ||
    activeView === 'upcoming' ||
    activeView === 'completed'
  ) {
    tasks.forEach((t) => combinedItems.push({ type: 'task', item: t }));
  } else {
    // 'all' view: pinned notes first, then active tasks, then regular notes, then completed tasks
    const pinnedNotes = notes.filter((n) => n.isPinned);
    const regularNotes = notes.filter((n) => !n.isPinned);
    const uncompletedTasks = tasks.filter((t) => !t.isCompleted);
    const completedTasks = tasks.filter((t) => t.isCompleted);

    pinnedNotes.forEach((n) => combinedItems.push({ type: 'note', item: n }));
    uncompletedTasks.forEach((t) => combinedItems.push({ type: 'task', item: t }));
    regularNotes.forEach((n) => combinedItems.push({ type: 'note', item: n }));
    completedTasks.forEach((t) => combinedItems.push({ type: 'task', item: t }));
  }

  const getFolder = (folderId?: string | null) => {
    if (!folderId) return null;
    return folders.find((f) => f.id === folderId);
  };

  return (
    <div className="flex h-full w-full flex-col border-r border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Top Header & Search */}
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
            {activeView === 'all'
              ? 'All Items'
              : activeView === 'today'
              ? "Today's Tasks"
              : activeView === 'upcoming'
              ? 'Upcoming Tasks'
              : activeView}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Create Note"
            >
              <Plus className="h-3 w-3" />
              Note
            </button>
            <button
              onClick={handleCreateTask}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Create Task"
            >
              <Plus className="h-3 w-3" />
              Task
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes and tasks..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none transition focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View segmentation tabs */}
        <div className="mt-3 flex items-center rounded-lg bg-slate-200/60 p-0.5 dark:bg-slate-800/80">
          {(['all', 'notes', 'tasks'] as MainView[]).map((tab) => {
            const isActive = activeView === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveView(tab)}
                className={`flex-1 rounded py-1 text-center text-[11px] font-medium capitalize transition ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Active Filter Notice */}
        {(selectedFolderId || selectedTagId) && (
          <div className="mt-2.5 flex items-center justify-between rounded-md bg-indigo-50/80 px-2.5 py-1 text-[11px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <span>
              Filtered by: {selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name : ''}
              {selectedTagId ? `#${tags.find((t) => t.id === selectedTagId)?.name}` : ''}
            </span>
            <button onClick={resetFilters} className="font-semibold hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Item List Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {combinedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Filter className="h-7 w-7 text-slate-300 dark:text-slate-700" />
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              No matching items found
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Try adjusting your search query or create a new note or task.
            </p>
          </div>
        ) : (
          combinedItems.map(({ type, item }) => {
            const isSelected = activeItemId === item.id;
            const folder = getFolder(item.folderId);

            if (type === 'note') {
              const note = item as Note;
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveItem(note.id, 'note')}
                  className={`group relative cursor-pointer rounded-xl border p-3.5 transition ${
                    isSelected
                      ? 'border-indigo-500 bg-white shadow-xs dark:border-indigo-400 dark:bg-slate-950'
                      : 'border-slate-200/80 bg-white/80 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-xs font-semibold text-slate-900 dark:text-white">
                      {note.title || 'Untitled Note'}
                    </h3>
                    {note.isPinned && (
                      <Pin className="h-3 w-3 shrink-0 text-amber-500 fill-amber-500" />
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {note.content.replace(/[#*`_>-]/g, '').trim() || 'No additional text'}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="font-mono tabular-nums">
                      {format(note.updatedAt, 'MMM d')}
                    </span>
                    {folder && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: folder.color }}
                          />
                          {folder.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            } else {
              const task = item as Task;
              const isOverdue =
                task.dueDate && !task.isCompleted && isPast(task.dueDate) && !isToday(task.dueDate);
              const isDueToday = task.dueDate && !task.isCompleted && isToday(task.dueDate);

              return (
                <div
                  key={task.id}
                  onClick={() => setActiveItem(task.id, 'task')}
                  className={`group relative cursor-pointer rounded-xl border p-3.5 transition ${
                    isSelected
                      ? 'border-indigo-500 bg-white shadow-xs dark:border-indigo-400 dark:bg-slate-950'
                      : 'border-slate-200/80 bg-white/80 hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => handleTaskCheckboxClick(e, task.id)}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {task.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 hover:stroke-indigo-600" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`line-clamp-1 text-xs font-medium ${
                            task.isCompleted
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                        </h3>

                        {task.priority === 'high' && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">
                            High
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        {task.dueDate && (
                          <span
                            className={`flex items-center gap-1 font-mono tabular-nums ${
                              isOverdue
                                ? 'text-red-600 font-semibold dark:text-red-400'
                                : isDueToday
                                ? 'text-amber-600 font-semibold dark:text-amber-400'
                                : ''
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {format(task.dueDate, 'MMM d')}
                          </span>
                        )}
                        {folder && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: folder.color }}
                              />
                              {folder.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
};
