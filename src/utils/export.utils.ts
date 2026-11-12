export function createJsonDownloadFilename(prefix: string, date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  return `${prefix}-${datePart}.json`;
}

const RESERVED_FILESYSTEM_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function createNoteExportFilename(title: string, extension: 'md' | 'txt', date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10);
  const base = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, 80)
    .trim()
    .replace(/\.+$/g, '');
  const stem = base
    ? RESERVED_FILESYSTEM_NAMES.has(base.toUpperCase()) ? `${base}-note` : base
    : 'note';
  return `${stem}-${datePart}.${extension}`;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
}

export function markdownToPlainText(markdown: string): string {
  const out: string[] = [];
  let inCodeBlock = false;

  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      out.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      continue;
    }

    let text = line;
    const taskMatch = text.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      text = `[${taskMatch[1].toLowerCase() === 'x' ? 'x' : ' '}] ${taskMatch[2]}`;
    } else {
      const headingMatch = text.match(/^\s{0,3}#{1,6}\s+(.*)$/);
      const quoteMatch = text.match(/^(?:\s{0,3}>\s?)+(.*)$/);
      const bulletMatch = text.match(/^\s*[-*+]\s+(.*)$/);
      const numberedMatch = text.match(/^\s*\d+[.)]\s+(.*)$/);
      const blockMatch = headingMatch || quoteMatch || bulletMatch || numberedMatch;
      if (blockMatch) text = blockMatch[1];
    }

    out.push(stripInlineMarkdown(text).replace(/\s+$/g, ''));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('File downloads are unavailable in this environment.');
  }
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJsonFile(filename: string, json: string): void {
  downloadTextFile(filename, json, 'application/json');
}
