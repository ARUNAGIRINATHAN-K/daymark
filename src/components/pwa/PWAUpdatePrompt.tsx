import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      aria-label="Application update prompt"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-slate-900 p-4 text-white shadow-2xl backdrop-blur-md dark:border-indigo-900 dark:bg-slate-900/95 max-w-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
        <RefreshCw className="h-4 w-4 animate-spin" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-white">App Update Available</h4>
        <p className="mt-0.5 text-[11px] text-slate-300">
          A new version of Daymark is ready. Reload to update (your local notes and tasks remain safe).
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
        >
          Update
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg p-1 text-slate-400 hover:text-slate-200"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
