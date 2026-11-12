import { describe, expect, it } from 'vitest';
import {
  createNoteExportFilename,
  downloadTextFile,
  markdownToPlainText,
} from '../src/utils/export.utils';

describe('markdownToPlainText', () => {
  it('strips headings, emphasis, inline code, and links', () => {
    const md = '# Title\n\nSome **bold** and *italic* and `code` and [a link](https://example.com) text.';
    expect(markdownToPlainText(md)).toBe('Title\n\nSome bold and italic and code and a link (https://example.com) text.');
  });

  it('converts lists, checkboxes, and blockquotes to plain text', () => {
    const md = '- item one\n- [ ] todo\n- [x] done\n1. first\n2. second\n> quoted line';
    expect(markdownToPlainText(md)).toBe('item one\n[ ] todo\n[x] done\nfirst\nsecond\nquoted line');
  });

  it('keeps code block contents verbatim and drops the fences', () => {
    const md = 'before\n```\n**not bold**\n# not a heading\n```\nafter';
    expect(markdownToPlainText(md)).toBe('before\n**not bold**\n# not a heading\nafter');
  });

  it('removes horizontal rules and collapses extra blank lines', () => {
    expect(markdownToPlainText('a\n---\n\n\n\nb')).toBe('a\n\nb');
  });

  it('handles empty notes and unicode content', () => {
    expect(markdownToPlainText('')).toBe('');
    expect(markdownToPlainText('héllo wörld ✨ **太字**')).toBe('héllo wörld ✨ 太字');
  });
});

describe('createNoteExportFilename', () => {
  const date = new Date('2026-11-12T10:00:00.000Z');

  it('uses the note title with a date and the requested extension', () => {
    expect(createNoteExportFilename('My Note', 'md', date)).toBe('My Note-2026-11-12.md');
    expect(createNoteExportFilename('My Note', 'txt', date)).toBe('My Note-2026-11-12.txt');
  });

  it('removes filesystem-hostile characters', () => {
    expect(createNoteExportFilename('a<b>:"/\\|?*c', 'md', date)).toBe('a b c-2026-11-12.md');
  });

  it('falls back to a default name for empty or whitespace-only titles', () => {
    expect(createNoteExportFilename('', 'txt', date)).toBe('note-2026-11-12.txt');
    expect(createNoteExportFilename('   ', 'md', date)).toBe('note-2026-11-12.md');
  });

  it('trims trailing dots and preserves unicode', () => {
    expect(createNoteExportFilename('café...', 'md', date)).toBe('café-2026-11-12.md');
  });

  it('avoids reserved Windows device names', () => {
    expect(createNoteExportFilename('CON', 'md', date)).toBe('CON-note-2026-11-12.md');
  });
});

describe('downloadTextFile', () => {
  it('throws a clear error outside a browser environment', () => {
    expect(() => downloadTextFile('note.md', '# Hi', 'text/markdown')).toThrow('File downloads are unavailable in this environment.');
  });
});
