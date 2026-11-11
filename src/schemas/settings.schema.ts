import { z } from 'zod';

export const ThemePreferenceSchema = z.enum(['dark', 'light']);
export const TaskSortBySchema = z.enum(['dueDate', 'priority', 'title', 'createdAt']);

export const UserPreferencesSchema = z.object({
  theme: ThemePreferenceSchema,
  defaultTaskSortBy: TaskSortBySchema,
}).strict();

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type TaskSortBy = z.infer<typeof TaskSortBySchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const AppSettingSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.unknown(),
  updatedAt: z.number().int().positive(),
});

export type AppSettingSchemaType = z.infer<typeof AppSettingSchema>;
