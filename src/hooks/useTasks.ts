import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tasksService, type TaskFilterOptions } from '../services/tasks.service';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput, UUID } from '../types';

export function useTasks(options: TaskFilterOptions = {}) {
  const tasks = useLiveQuery(
    () => tasksService.getTasks(options),
    [
      options.status,
      options.priority,
      options.folderId,
      options.tagId,
      options.dateFilter,
      options.includeCompleted,
      options.includeDeleted,
      options.searchQuery,
      options.sortBy,
      options.sortOrder,
    ]
  ) ?? [];

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    return tasksService.createTask(input);
  }, []);

  const updateTask = useCallback(async (id: UUID, updates: UpdateTaskInput): Promise<Task> => {
    return tasksService.updateTask(id, updates);
  }, []);

  const updateTaskStatus = useCallback(async (id: UUID, status: TaskStatus): Promise<Task> => {
    return tasksService.updateTaskStatus(id, status);
  }, []);

  const toggleCompletion = useCallback(async (id: UUID): Promise<boolean> => {
    return tasksService.toggleCompletion(id);
  }, []);

  const softDeleteTask = useCallback(async (id: UUID): Promise<void> => {
    return tasksService.softDeleteTask(id);
  }, []);

  const restoreTask = useCallback(async (id: UUID): Promise<Task> => {
    return tasksService.restoreTask(id);
  }, []);

  const permanentDeleteTask = useCallback(async (id: UUID): Promise<void> => {
    return tasksService.permanentDeleteTask(id);
  }, []);

  return {
    tasks,
    createTask,
    updateTask,
    updateTaskStatus,
    toggleCompletion,
    softDeleteTask,
    restoreTask,
    permanentDeleteTask,
  };
}

export function useTask(id: UUID | undefined): { task: Task | undefined; isLoading: boolean } {
  const task = useLiveQuery(() => (id ? tasksService.getTaskById(id) : undefined), [id]);
  return {
    task,
    isLoading: task === undefined && Boolean(id),
  };
}
