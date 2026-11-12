import { create } from 'zustand';
import type { EditorMode, ItemType, MainView } from '../types';
import type { ThemePreference } from '../schemas/settings.schema';

interface AppState {
  // Navigation & Filtering
  activeView: MainView;
  selectedFolderId: string | null;
  selectedTagId: string | null;
  searchQuery: string;

  // Selected item for active workspace
  activeItemId: string | null;
  activeItemType: ItemType | null;

  // Workspace UI
  editorMode: EditorMode;
  isSidebarOpen: boolean;
  isMobileDrawerOpen: boolean;

  // Theme
  isDarkMode: boolean;

  // Modals
  isFolderModalOpen: boolean;
  isTagModalOpen: boolean;
  isOutboxModalOpen: boolean;
  isShortcutsModalOpen: boolean;

  // Actions
  setActiveView: (view: MainView) => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedTagId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveItem: (id: string | null, type: ItemType | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setTheme: (theme: ThemePreference) => void;
  setFolderModalOpen: (open: boolean) => void;
  setTagModalOpen: (open: boolean) => void;
  setOutboxModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  resetFilters: () => void;
}

// Initial theme check
const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('daymark_theme');
  if (saved) return saved === 'dark';
  return false;
};

export const useAppStore = create<AppState>((set) => ({
  activeView: 'all',
  selectedFolderId: null,
  selectedTagId: null,
  searchQuery: '',

  activeItemId: 'note_welcome',
  activeItemType: 'note',

  editorMode: 'split',
  isSidebarOpen: true,
  isMobileDrawerOpen: false,

  isDarkMode: getInitialTheme(),

  isFolderModalOpen: false,
  isTagModalOpen: false,
  isOutboxModalOpen: false,
  isShortcutsModalOpen: false,

  setActiveView: (view) =>
    set({
      activeView: view,
      selectedFolderId: null,
      selectedTagId: null,
    }),

  setSelectedFolderId: (id) =>
    set({
      selectedFolderId: id,
      selectedTagId: null,
      activeView: 'all',
    }),

  setSelectedTagId: (id) =>
    set({
      selectedTagId: id,
      selectedFolderId: null,
      activeView: 'all',
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveItem: (id, type) =>
    set({
      activeItemId: id,
      activeItemType: type,
    }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem('daymark_theme', next ? 'dark' : 'light');
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return { isDarkMode: next };
    }),

  setTheme: (theme) => {
    const isDarkMode = theme === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
    set({ isDarkMode });
  },

  setFolderModalOpen: (open) => set({ isFolderModalOpen: open }),

  setTagModalOpen: (open) => set({ isTagModalOpen: open }),

  setOutboxModalOpen: (open) => set({ isOutboxModalOpen: open }),

  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),

  resetFilters: () =>
    set({
      activeView: 'all',
      selectedFolderId: null,
      selectedTagId: null,
      searchQuery: '',
    }),
}));
