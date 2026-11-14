import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useAppStore } from '../store/useAppStore';
import type { Folder, Note, SyncOperation, Tag, Task } from '../types';

export function useFolders(): Folder[] {
  return (
    useLiveQuery(
      () =>
        db.folders
          .filter((f) => f.deletedAt === null)
          .sortBy('name'),
      []
    ) ?? []
  );
}

export function useTags(): Tag[] {
  return useLiveQuery(() => db.tags.orderBy('name').toArray(), []) ?? [];
}

export function useNotes(): Note[] {
  return (
    useLiveQuery(
      () =>
        db.notes
          .filter((n) => n.deletedAt === null)
          .reverse()
          .sortBy('updatedAt'),
      []
    ) ?? []
  );
}

export function useTasks(): Task[] {
  return (
    useLiveQuery(
      () =>
        db.tasks
          .filter((t) => t.deletedAt === null)
          .reverse()
          .sortBy('updatedAt'),
      []
    ) ?? []
  );
}

export function useOutbox(): SyncOperation[] {
  return (
    useLiveQuery(
      () => db.outbox.orderBy('timestamp').reverse().toArray(),
      []
    ) ?? []
  );
}

export function useRecentOutboxOperations(): SyncOperation[] {
  return (
    useLiveQuery(
      () => db.outbox.orderBy('timestamp').reverse().limit(50).toArray(),
      []
    ) ?? []
  );
}

export function usePendingOutboxCount(): number {
  return useLiveQuery(() => db.outbox.filter((op) => !op.synced).count(), []) ?? 0;
}

/**
 * Filtered items hook combining Notes and Tasks according to active store filters
 */
export function useFilteredItems() {
  const { activeView, selectedFolderId, selectedTagId, searchQuery } = useAppStore();
  const notes = useNotes();
  const tasks = useTasks();

  const query = searchQuery.trim().toLowerCase();
  const todayEnd = new Date().setHours(23, 59, 59, 999);

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    if (note.isArchived && activeView !== 'all') return false;

    if (selectedFolderId && note.folderId !== selectedFolderId) return false;
    if (selectedTagId && !note.tagIds.includes(selectedTagId)) return false;

    if (activeView === 'tasks' || activeView === 'today' || activeView === 'upcoming' || activeView === 'completed') {
      return false;
    }

    if (query) {
      const matchTitle = note.title.toLowerCase().includes(query);
      const matchContent = note.content.toLowerCase().includes(query);
      if (!matchTitle && !matchContent) return false;
    }

    return true;
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (selectedFolderId && task.folderId !== selectedFolderId) return false;
    if (selectedTagId && !task.tagIds.includes(selectedTagId)) return false;

    if (activeView === 'notes') return false;

    if (activeView === 'completed' && !task.isCompleted) return false;
    if (activeView === 'today') {
      if (task.isCompleted) return false;
      if (!task.dueDate) return false;
      if (task.dueDate > todayEnd) return false;
    }
    if (activeView === 'upcoming') {
      if (task.isCompleted) return false;
      if (!task.dueDate || task.dueDate <= todayEnd) return false;
    }

    if (query) {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.description?.toLowerCase().includes(query);
      if (!matchTitle && !matchDesc) return false;
    }

    return true;
  });

  return {
    notes: filteredNotes,
    tasks: filteredTasks,
    totalNotes: notes.length,
    totalTasks: tasks.length,
  };
}
