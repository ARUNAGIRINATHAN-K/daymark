import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside standalone window, do not render
  if (isInstalled) {
    return null;
  }

  // Chromium / Edge / Android install prompt flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex w-full items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
        title="Install Daymark to desktop or home screen"
      >
        <span className="flex items-center gap-2">
          <Download className="h-3.5 w-3.5" />
          Install App
        </span>
        <span className="text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Offline PWA</span>
      </button>
    );
  }

  // iOS Safari instruction modal
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="h-3.5 w-3.5" />
            Install on iOS
          </span>
          <span className="text-[10px] uppercase text-slate-400">Safari</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Install Daymark on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                1. Tap the <strong className="text-slate-900 dark:text-white">Share</strong> button in the Safari bottom toolbar.<br />
                2. Scroll down and choose <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.<br />
                3. Launch Daymark directly from your home screen for full offline support.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
