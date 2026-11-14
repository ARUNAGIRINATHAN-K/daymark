import { db } from '../db/database';
import { generateId } from '../lib/utils';
import { TaskSchema } from '../schemas/task.schema';
import type { CreateTaskInput, Task, TaskPriority, TaskStatus, UpdateTaskInput, UUID } from '../types';
import { outboxService } from './outboxService';

export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  folderId?: UUID | null;
  tagId?: UUID | null;
  dateFilter?: 'today' | 'upcoming' | 'overdue';
  includeCompleted?: boolean;
  includeDeleted?: boolean;
  searchQuery?: string;
  sortBy?: 'dueDate' | 'priority' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export class IncompleteSubtasksError extends Error {
  constructor(readonly incompleteCount: number) {
    const subtaskLabel = incompleteCount === 1 ? 'subtask' : 'subtasks';
    super(
      `Complete all subtasks before marking this task as completed. (${incompleteCount} incomplete ${subtaskLabel}.)`
    );
    this.name = 'IncompleteSubtasksError';
  }
}

function assertSubtasksCompleted(task: Pick<Task, 'subtasks'>): void {
  const incompleteCount = task.subtasks?.filter((subtask) => !subtask.isCompleted).length ?? 0;
  if (incompleteCount > 0) throw new IncompleteSubtasksError(incompleteCount);
}

export class TasksService {
  /**
   * Helper to get local midnight start/end timestamps
   */
  private getLocalDayBounds() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    return { startOfToday, endOfToday };
  }

  /**
   * Query tasks with reactive filtering, date filters, and sorting
   */
  async getTasks(options: TaskFilterOptions = {}): Promise<Task[]> {
    let collection = db.tasks.toCollection();

    // Soft deletion filter (default: active tasks only)
    if (!options.includeDeleted) {
      collection = collection.filter((t) => t.deletedAt === null);
    }

    // Completion status filter
    if (options.includeCompleted === false) {
      collection = collection.filter((t) => !t.isCompleted);
    }

    // Direct status filter
    if (options.status) {
      collection = collection.filter((t) => (t.status ?? (t.isCompleted ? 'completed' : 'todo')) === options.status);
    }

    // Priority filter
    if (options.priority) {
      collection = collection.filter((t) => t.priority === options.priority);
    }

    // Folder filter
    if (options.folderId !== undefined) {
      collection = collection.filter((t) => t.folderId === options.folderId);
    }

    // Tag filter
    if (options.tagId) {
      collection = collection.filter((t) => t.tagIds.includes(options.tagId!));
    }

    // Date filters (Today, Upcoming, Overdue)
    if (options.dateFilter) {
      const { startOfToday, endOfToday } = this.getLocalDayBounds();

      if (options.dateFilter === 'overdue') {
        collection = collection.filter(
          (t) => !t.isCompleted && t.dueDate !== null && t.dueDate !== undefined && t.dueDate < startOfToday
        );
      } else if (options.dateFilter === 'today') {
        collection = collection.filter(
          (t) =>
            t.dueDate !== null &&
            t.dueDate !== undefined &&
            t.dueDate >= startOfToday &&
            t.dueDate <= endOfToday
        );
      } else if (options.dateFilter === 'upcoming') {
        collection = collection.filter(
          (t) => t.dueDate !== null && t.dueDate !== undefined && t.dueDate > endOfToday
        );
      }
    }

    let results = await collection.toArray();

    // Substring search filter across title and description
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      results = results.filter((task) => {
        const titleMatch = task.title.toLowerCase().includes(q);
        const descMatch = task.description?.toLowerCase().includes(q);
        return titleMatch || Boolean(descMatch);
      });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const isAsc = options.sortOrder === 'asc';

    return results.sort((a, b) => {
      // Completed items usually sort to the bottom unless explicitly sorting by title
      if (a.isCompleted !== b.isCompleted && sortBy !== 'title') {
        return a.isCompleted ? 1 : -1;
      }

      if (sortBy === 'priority') {
        const diff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        return isAsc ? -diff : diff;
      }

      if (sortBy === 'dueDate') {
        const aDue = a.dueDate ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ?? Number.MAX_SAFE_INTEGER;
        return isAsc ? aDue - bDue : bDue - aDue;
      }

      if (sortBy === 'title') {
        const cmp = a.title.localeCompare(b.title);
        return isAsc ? cmp : -cmp;
      }

      // Default: createdAt descending
      return isAsc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    });
  }

  /**
   * Query single active task by ID
   */
  async getTaskById(id: UUID): Promise<Task | undefined> {
    const task = await db.tasks.get(id);
    if (!task || task.deletedAt !== null) return undefined;
    return task;
  }

  /**
   * Create a new task with atomic outbox logging
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = Date.now();
    const isCompleted = input.isCompleted ?? (input.status === 'completed');
    const status: TaskStatus = input.status ?? (isCompleted ? 'completed' : 'todo');

    const task: Task = {
      id: generateId(),
      title: input.title.trim(),
      description: input.description ?? '',
      status,
      isCompleted,
      completedAt: isCompleted ? (input.completedAt ?? now) : null,
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      folderId: input.folderId ?? null,
      tagIds: input.tagIds ?? [],
      noteId: input.noteId ?? null,
      subtasks: input.subtasks ?? [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
    };

    TaskSchema.parse(task);
    if (task.isCompleted || task.status === 'completed') {
      assertSubtasksCompleted(task);
    }

    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.add(task);
      await db.outbox.add(
        await outboxService.createOperationRecord('task', task.id, 'create', task as unknown as Record<string, unknown>)
      );
    });

    return task;
  }

  /**
   * Update an existing task with status sync, version increment, and outbox logging
   */
  async updateTask(id: UUID, updates: UpdateTaskInput): Promise<Task> {
    return db.transaction('rw', [db.tasks, db.outbox], async () => {
      const existing = await db.tasks.get(id);
      if (!existing) {
        throw new Error(`Task with ID ${id} not found.`);
      }

      const now = Date.now();
      let nextStatus: TaskStatus =
        updates.status ?? existing.status ?? (existing.isCompleted ? 'completed' : 'todo');
      let nextIsCompleted: boolean = updates.isCompleted ?? existing.isCompleted;
      let nextCompletedAt: number | null | undefined = updates.completedAt ?? existing.completedAt;

      // Handle explicit status change
      if (updates.status !== undefined && updates.status !== existing.status) {
        if (updates.status === 'completed') {
          nextIsCompleted = true;
          nextCompletedAt = now;
        } else {
          nextIsCompleted = false;
          nextCompletedAt = null;
        }
      } else if (updates.isCompleted !== undefined && updates.isCompleted !== existing.isCompleted) {
        // Handle explicit completion toggle
        if (updates.isCompleted) {
          nextStatus = 'completed';
          nextCompletedAt = updates.completedAt ?? now;
        } else {
          nextStatus = existing.status === 'completed' ? 'todo' : existing.status ?? 'todo';
          nextCompletedAt = null;
        }
      }

      const updated: Task = {
        ...existing,
        ...updates,
        status: nextStatus,
        isCompleted: nextIsCompleted,
        completedAt: nextCompletedAt,
        updatedAt: now,
        version: existing.version + 1,
        syncStatus: 'pending',
      };

      TaskSchema.parse(updated);
      if (
        updates.isCompleted === true ||
        updates.status === 'completed' ||
        ((updated.isCompleted || updated.status === 'completed') && updates.subtasks !== undefined)
      ) {
        assertSubtasksCompleted(updated);
      }

      await db.tasks.put(updated);
      await db.outbox.add(
        await outboxService.createOperationRecord('task', id, 'update', updates as Record<string, unknown>)
      );

      return updated;
    });
  }

  /**
   * Shortcut to update task status (e.g. Kanban column move)
   */
  async updateTaskStatus(id: UUID, status: TaskStatus): Promise<Task> {
    return this.updateTask(id, { status });
  }

  /**
   * Toggle task completion state
   */
  async toggleCompletion(id: UUID): Promise<boolean> {
    const existing = await db.tasks.get(id);
    if (!existing) return false;

    const nextCompleted = !existing.isCompleted;
    await this.updateTask(id, { isCompleted: nextCompleted });
    return nextCompleted;
  }

  /**
   * Soft-delete task: sets deletedAt timestamp and logs outbox operation
   */
  async softDeleteTask(id: UUID): Promise<void> {
    const existing = await db.tasks.get(id);
    if (!existing) return;

    const now = Date.now();
    const updated: Task = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.put(updated);
      await db.outbox.add(
        await outboxService.createOperationRecord('task', id, 'delete', { id, deletedAt: now })
      );
    });
  }

  /**
   * Restore soft-deleted task
   */
  async restoreTask(id: UUID): Promise<Task> {
    const existing = await db.tasks.get(id);
    if (!existing) {
      throw new Error(`Task with ID ${id} not found.`);
    }

    const now = Date.now();
    const restored: Task = {
      ...existing,
      deletedAt: null,
      updatedAt: now,
      version: existing.version + 1,
      syncStatus: 'pending',
    };

    TaskSchema.parse(restored);

    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.put(restored);
      await db.outbox.add(
        await outboxService.createOperationRecord('task', id, 'update', { deletedAt: null, updatedAt: now })
      );
    });

    return restored;
  }

  /**
   * Permanently delete task from database
   */
  async permanentDeleteTask(id: UUID): Promise<void> {
    const existing = await db.tasks.get(id);
    if (!existing) return;

    await db.transaction('rw', [db.tasks, db.outbox], async () => {
      await db.tasks.delete(id);
      await db.outbox.add(
        await outboxService.createOperationRecord('task', id, 'delete', { id, permanent: true })
      );
    });
  }

  /**
   * Compatibility aliases
   */
  async create(input: CreateTaskInput): Promise<Task> {
    return this.createTask(input);
  }

  async update(id: UUID, updates: UpdateTaskInput): Promise<Task> {
    return this.updateTask(id, updates);
  }

  async delete(id: UUID): Promise<void> {
    return this.softDeleteTask(id);
  }

  async softDelete(id: UUID): Promise<void> {
    return this.softDeleteTask(id);
  }

  async restore(id: UUID): Promise<Task> {
    return this.restoreTask(id);
  }

  async getAll(options: TaskFilterOptions = {}): Promise<Task[]> {
    return this.getTasks(options);
  }

  async getById(id: UUID): Promise<Task | undefined> {
    return this.getTaskById(id);
  }
}

export const tasksService = new TasksService();
