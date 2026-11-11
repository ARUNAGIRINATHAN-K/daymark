import { z } from 'zod';

export const FolderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Folder name cannot be empty'),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().nullable(),
  version: z.number().int().min(1),
  syncStatus: z.enum(['synced', 'pending', 'failed']),
});

export type FolderSchemaType = z.infer<typeof FolderSchema>;
