import { z } from 'zod';

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'completed']);

export const SubtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  isCompleted: z.boolean().default(false),
});

export const TaskSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().min(1, 'Task title cannot be empty'),
  description: z.string().optional().default(''),
  status: TaskStatusSchema.optional().default('todo'),
  isCompleted: z.boolean().default(false),
  completedAt: z.number().int().nullable().optional().default(null),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: z.number().int().nullable().optional().default(null),
  folderId: z.string().nullable().optional().default(null),
  tagIds: z.array(z.string()).default([]),
  noteId: z.string().nullable().optional().default(null),
  subtasks: z.array(SubtaskSchema).optional().default([]),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().nullable().default(null),
  version: z.number().int().min(1).default(1),
  syncStatus: z.enum(['synced', 'pending', 'failed']).default('pending'),
});

export const CreateTaskSchema = TaskSchema.partial().extend({
  title: z.string().min(1, 'Task title is required'),
});

export const UpdateTaskSchema = TaskSchema.partial();

export type TaskSchemaType = z.infer<typeof TaskSchema>;
