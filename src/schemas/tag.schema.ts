import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string().min(1, 'Tag ID is required'),
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional(),
  createdAt: z.number().int().positive(),
});

export type TagSchemaType = z.infer<typeof TagSchema>;
