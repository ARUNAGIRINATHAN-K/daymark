import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, getShortcutKeys, isMacPlatform } from '../../lib/shortcuts';
import { useAppStore } from '../../store/useAppStore';

export const ShortcutsDialog: React.FC = () => {
  const { isShortcutsModalOpen, setShortcutsModalOpen } = useAppStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isShortcutsModalOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isShortcutsModalOpen]);

  if (!isShortcutsModalOpen) return null;

  const isMac = isMacPlatform();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Keyboard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 id="shortcuts-dialog-title" className="text-sm font-semibold">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={() => setShortcutsModalOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close shortcuts dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut, index) => (
            <li
              key={index}
              className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/60"
            >
              <span className="text-xs text-slate-600 dark:text-slate-400">{shortcut.description}</span>
              <span className="flex items-center gap-1">
                {getShortcutKeys(shortcut, isMac).map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-900 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end pt-4">
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
