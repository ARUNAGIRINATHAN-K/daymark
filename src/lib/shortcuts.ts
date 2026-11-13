export interface KeyboardShortcut {
  description: string;
  keys: string[];
  macKeys: string[];
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    description: 'Open keyboard shortcuts help',
    keys: ['?'],
    macKeys: ['?'],
  },
  {
    description: 'Open keyboard shortcuts help',
    keys: ['Ctrl', '/'],
    macKeys: ['⌘', '/'],
  },
  {
    description: 'Close dialogs',
    keys: ['Esc'],
    macKeys: ['Esc'],
  },
];

export const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform ?? '');
};

export const getShortcutKeys = (shortcut: KeyboardShortcut, isMac: boolean): string[] => {
  return isMac && shortcut.macKeys.length > 0 ? shortcut.macKeys : shortcut.keys;
};

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
};

interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export const isShortcutsHelpTrigger = (event: ShortcutKeyEvent): boolean => {
  if (event.altKey) return false;
  if (event.key === '?') return !event.ctrlKey && !event.metaKey;
  if (event.key === '/') return event.ctrlKey || event.metaKey;
  return false;
};
