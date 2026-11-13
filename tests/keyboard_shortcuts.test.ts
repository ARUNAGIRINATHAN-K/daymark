import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  KEYBOARD_SHORTCUTS,
  getShortcutKeys,
  isEditableTarget,
  isShortcutsHelpTrigger,
} from '../src/lib/shortcuts';

const keyEvent = (overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }>) => ({
  key: '/',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...overrides,
});

describe('Keyboard shortcuts registry', () => {
  it('keeps every shortcut entry with a description and platform-specific keys', () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0);
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.description.length).toBeGreaterThan(0);
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.macKeys.length).toBeGreaterThan(0);
    }
  });

  it('lists both the ? and the Ctrl+/ Cmd+/ triggers for the help dialog', () => {
    const descriptions = KEYBOARD_SHORTCUTS.map((s) => s.description);
    expect(descriptions.filter((d) => d.includes('shortcuts help')).length).toBe(2);
    const slash = KEYBOARD_SHORTCUTS.find((s) => s.keys.includes('/'));
    expect(slash).toBeDefined();
    expect(slash?.keys).toContain('Ctrl');
    expect(slash?.macKeys).toContain('⌘');
  });

  it('returns mac-specific keys on macOS and default keys elsewhere', () => {
    const slash = KEYBOARD_SHORTCUTS.find((s) => s.keys.includes('/'))!;
    expect(getShortcutKeys(slash, true)).toEqual(slash.macKeys);
    expect(getShortcutKeys(slash, false)).toEqual(slash.keys);
  });
});

describe('isShortcutsHelpTrigger', () => {
  it('matches ? without modifiers', () => {
    expect(isShortcutsHelpTrigger(keyEvent({ key: '?' }))).toBe(true);
  });

  it('matches Ctrl+/ and Cmd+/', () => {
    expect(isShortcutsHelpTrigger(keyEvent({ key: '/', ctrlKey: true }))).toBe(true);
    expect(isShortcutsHelpTrigger(keyEvent({ key: '/', metaKey: true }))).toBe(true);
  });

  it('ignores plain /, other keys, and alt-modified combinations', () => {
    expect(isShortcutsHelpTrigger(keyEvent({ key: '/' }))).toBe(false);
    expect(isShortcutsHelpTrigger(keyEvent({ key: 'a' }))).toBe(false);
    expect(isShortcutsHelpTrigger(keyEvent({ key: '/', ctrlKey: true, altKey: true }))).toBe(false);
    expect(isShortcutsHelpTrigger(keyEvent({ key: '?', ctrlKey: true }))).toBe(false);
  });
});

describe('isEditableTarget', () => {
  const fake = (tagName: string, isContentEditable = false) =>
    ({ tagName, isContentEditable }) as unknown as HTMLElement;

  it('detects inputs, textareas, selects, and editable regions', () => {
    expect(isEditableTarget(fake('INPUT'))).toBe(true);
    expect(isEditableTarget(fake('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(fake('SELECT'))).toBe(true);
    expect(isEditableTarget(fake('DIV', true))).toBe(true);
  });

  it('passes plain elements and null targets', () => {
    expect(isEditableTarget(fake('DIV'))).toBe(false);
    expect(isEditableTarget(fake('BUTTON'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('Shortcuts dialog wiring', () => {
  const rootDir = process.cwd();

  it('registers a global keydown handler in AppLayout and renders the dialog', () => {
    const layoutPath = path.join(rootDir, 'src/components/layout/AppLayout.tsx');
    const layout = fs.readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain("window.addEventListener('keydown'");
    expect(layout).toContain('isShortcutsHelpTrigger');
    expect(layout).toContain('isEditableTarget');
    expect(layout).toContain('<ShortcutsDialog />');
  });

  it('renders an accessible dialog driven by the shared store flag', () => {
    const dialogPath = path.join(rootDir, 'src/components/modals/ShortcutsDialog.tsx');
    const dialog = fs.readFileSync(dialogPath, 'utf-8');
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('aria-labelledby');
    expect(dialog).toContain('KEYBOARD_SHORTCUTS');
    expect(dialog).toContain('isShortcutsModalOpen');

    const storePath = path.join(rootDir, 'src/store/useAppStore.ts');
    const store = fs.readFileSync(storePath, 'utf-8');
    expect(store).toContain('isShortcutsModalOpen');
    expect(store).toContain('setShortcutsModalOpen');
  });

  it('exposes the dialog from the Settings page', () => {
    const settingsPath = path.join(rootDir, 'src/pages/SettingsPage.tsx');
    const settings = fs.readFileSync(settingsPath, 'utf-8');
    expect(settings).toContain('setShortcutsModalOpen(true)');
  });
});
