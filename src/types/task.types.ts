import type { BaseEntity, Timestamp, UUID } from './common.types';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Subtask {
  id: UUID;
  title: string;
  isCompleted: boolean;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status?: TaskStatus;
  isCompleted: boolean;
  completedAt?: Timestamp | null;
  priority: TaskPriority;
  dueDate?: Timestamp | null;
  folderId?: UUID | null;
  tagIds: UUID[];
  noteId?: UUID | null;
  subtasks?: Subtask[];
}

export type CreateTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'syncStatus'>> & {
  title: string;
};

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt'>>;
