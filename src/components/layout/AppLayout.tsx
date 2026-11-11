import React, { useEffect } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { syncManager } from '../../sync/syncManager';
import { FolderDialog } from '../modals/FolderDialog';
import { TagDialog } from '../modals/TagDialog';
import { OutboxInspectorModal } from '../outbox/OutboxInspectorModal';
import { ConflictDialog } from '../sync/ConflictDialog';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PWAUpdatePrompt } from '../pwa/PWAUpdatePrompt';
import { NavigationSidebar } from '../sidebar/NavigationSidebar';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isDarkMode,
    isMobileDrawerOpen,
    setMobileDrawerOpen,
  } = useAppStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    void syncManager.recoverInterruptedProcessing().catch((error: unknown) => {
      console.error('Failed to recover interrupted sync operations:', error);
    });
  }, []);

  // Scroll main view to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // Derive human title from pathname
  const path = location.pathname;
  let pageTitle = 'Dashboard';
  if (path.startsWith('/notes')) pageTitle = 'Notes';
  else if (path.startsWith('/tasks')) pageTitle = 'Tasks';
  else if (path.startsWith('/today')) pageTitle = 'Today';
  else if (path.startsWith('/upcoming')) pageTitle = 'Upcoming';
  else if (path.startsWith('/folders')) pageTitle = 'Folders';
  else if (path.startsWith('/archive')) pageTitle = 'Archive';
  else if (path.startsWith('/trash')) pageTitle = 'Trash';
  else if (path.startsWith('/search')) pageTitle = 'Search';
  else if (path.startsWith('/settings')) pageTitle = 'Settings';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white">Daymark</span>
          <span className="text-xs text-slate-400">/ {pageTitle}</span>
        </div>

        <button
          onClick={() => navigate('/search')}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile Slide-Over Drawer for Sidebar */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85%] bg-white dark:bg-slate-950 shadow-2xl h-full">
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <NavigationSidebar />
          </div>
        </div>
      )}

      {/* Desktop Layout Grid */}
      <div className="flex h-full w-full pt-12 md:pt-0">
        {/* Sidebar Column (Desktop) */}
        <div className="hidden md:block w-64 shrink-0 h-full">
          <NavigationSidebar />
        </div>

        {/* Main Content Area (renders active route via React Router Outlet) */}
        <main className="flex flex-1 flex-col h-full overflow-hidden bg-white dark:bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* Modals & Overlays */}
      <FolderDialog />
      <TagDialog />
      <OutboxInspectorModal />
      <ConflictDialog />
      <OfflineIndicator />
      <PWAUpdatePrompt />
    </div>
  );
};
