import { db } from '../db/database';
import {
  ProductivityCalendarPreferencesSchema,
  TaskSortBySchema,
  ThemePreferenceSchema,
  type ProductivityCalendarPreferences,
  type TaskSortBy,
  type ThemePreference,
} from '../schemas/settings.schema';

export const DEFAULT_TASK_SORT_SETTING_KEY = 'user-preferences:default-task-sort';
export const PRODUCTIVITY_CALENDAR_SETTING_KEY = 'user-preferences:productivity-calendar';
export const THEME_STORAGE_KEY = 'daymark_theme';
export const DEFAULT_TASK_SORT: TaskSortBy = 'createdAt';
export const DEFAULT_PRODUCTIVITY_CALENDAR_PREFERENCES: ProductivityCalendarPreferences = {
  showDeadlines: true,
};

export class SettingsService {
  getThemePreference(): ThemePreference {
    if (typeof localStorage === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = ThemePreferenceSchema.safeParse(saved);
      if (parsed.success) return parsed.data;
    }
    return 'light';
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

  async getProductivityCalendarPreferences(): Promise<ProductivityCalendarPreferences> {
    const setting = await db.settings.get(PRODUCTIVITY_CALENDAR_SETTING_KEY);
    const result = ProductivityCalendarPreferencesSchema.safeParse(setting?.value);
    return result.success ? result.data : DEFAULT_PRODUCTIVITY_CALENDAR_PREFERENCES;
  }

  async setProductivityCalendarPreferences(
    preferences: ProductivityCalendarPreferences
  ): Promise<void> {
    const value = ProductivityCalendarPreferencesSchema.parse(preferences);
    await db.settings.put({
      key: PRODUCTIVITY_CALENDAR_SETTING_KEY,
      value,
      updatedAt: Date.now(),
    });
  }
}

export const settingsService = new SettingsService();
