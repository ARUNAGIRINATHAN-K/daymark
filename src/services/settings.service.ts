import { db } from '../db/database';
import { TaskSortBySchema, ThemePreferenceSchema, type TaskSortBy, type ThemePreference } from '../schemas/settings.schema';

export const DEFAULT_TASK_SORT_SETTING_KEY = 'user-preferences:default-task-sort';
export const THEME_STORAGE_KEY = 'daymark_theme';
export const DEFAULT_TASK_SORT: TaskSortBy = 'createdAt';

export class SettingsService {
  getThemePreference(): ThemePreference {
    if (typeof localStorage === 'undefined') return 'dark';
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = ThemePreferenceSchema.safeParse(saved);
      if (parsed.success) return parsed.data;
    }
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  setThemePreference(theme: ThemePreference): void {
    const value = ThemePreferenceSchema.parse(theme);
    if (typeof localStorage === 'undefined') throw new Error('Theme preferences are unavailable in this environment.');
    localStorage.setItem(THEME_STORAGE_KEY, value);
  }

  async getDefaultTaskSort(): Promise<TaskSortBy> {
    const setting = await db.settings.get(DEFAULT_TASK_SORT_SETTING_KEY);
    const result = TaskSortBySchema.safeParse(setting?.value);
    return result.success ? result.data : DEFAULT_TASK_SORT;
  }

  async setDefaultTaskSort(sortBy: TaskSortBy): Promise<void> {
    const value = TaskSortBySchema.parse(sortBy);
    const now = Date.now();
    await db.settings.put({ key: DEFAULT_TASK_SORT_SETTING_KEY, value, updatedAt: now });
  }
}

export const settingsService = new SettingsService();
