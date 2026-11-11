import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().default('Untitled Note'),
  content: z.string().default(''),
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().nullable().default(null),
  version: z.number().int().min(1).default(1),
  syncStatus: z.enum(['synced', 'pending', 'failed']).default('pending'),
});

export const CreateNoteSchema = NoteSchema.partial().extend({
  title: z.string().optional(),
  content: z.string().optional(),
});

export const UpdateNoteSchema = NoteSchema.partial();

export type NoteSchemaType = z.infer<typeof NoteSchema>;
