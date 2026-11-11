import React, { useEffect, useRef, useState, useTransition } from 'react';
import {
  Archive,
  Bold,
  CheckSquare,
  Code,
  Columns,
  Eye,
  Folder,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Pin,
  Quote,
  SquareCode,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react';
import { useFolders, useTags } from '../../hooks/useData';
import { noteService } from '../../services/noteService';
import { useAppStore } from '../../store/useAppStore';
import type { EditorMode, Note } from '../../types';

interface MarkdownEditorProps {
  note: Note;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ note }) => {
  const folders = useFolders();
  const tags = useTags();
  const { editorMode, setEditorMode, setActiveItem } = useAppStore();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isSaved, setIsSaved] = useState(true);
  const [, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal state when active note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setIsSaved(true);
  }, [note.id]);

  // Debounced auto-save
  const triggerAutoSave = (newTitle: string, newContent: string) => {
    setIsSaved(false);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await noteService.update(note.id, {
          title: newTitle,
          content: newContent,
        });
        setIsSaved(true);
      } catch (err) {
        console.error('Failed to auto-save note:', err);
      }
    }, 400);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = e.target.value;
    setTitle(nextTitle);
    triggerAutoSave(nextTitle, content);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = e.target.value;
    setContent(nextContent);
    triggerAutoSave(title, nextContent);
  };

  // Formatting helpers for the markdown toolbar
  const insertFormatting = (prefix: string, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;

    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);

    setContent(nextContent);
    triggerAutoSave(title, nextContent);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = content.substring(start, end).split('\n');
    const modified = lines.map((l) => `${prefix}${l}`).join('\n');

    const nextContent = content.substring(0, start) + modified + content.substring(end);
    setContent(nextContent);
    triggerAutoSave(title, nextContent);
  };

  const handleTogglePin = async () => {
    await noteService.togglePin(note.id);
  };

  const handleToggleArchive = async () => {
    await noteService.toggleArchive(note.id);
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this note permanently?')) {
      await noteService.delete(note.id);
      setActiveItem(null, null);
    }
  };

  const handleFolderChange = async (folderId: string | null) => {
    await noteService.update(note.id, { folderId });
  };

  const handleToggleTag = async (tagId: string) => {
    const nextTags = note.tagIds.includes(tagId)
      ? note.tagIds.filter((t) => t !== tagId)
      : [...note.tagIds, tagId];
    await noteService.update(note.id, { tagIds: nextTags });
  };

  // Word & Reading statistics
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Handle interactive checkbox toggles in preview
  const handleCheckboxToggleInPreview = (lineIndex: number, currentChecked: boolean) => {
    const lines = content.split('\n');
    let taskCount = 0;
    const updatedLines = lines.map((line) => {
      const isTask = line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]');
      if (isTask) {
        if (taskCount === lineIndex) {
          taskCount++;
          return currentChecked ? line.replace(/- \[[xX]\]/, '- [ ]') : line.replace(/- \[ \]/, '- [x]');
        }
        taskCount++;
      }
      return line;
    });

    const nextContent = updatedLines.join('\n');
    setContent(nextContent);
    triggerAutoSave(title, nextContent);
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        {/* Folder & Tag selector strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Folder dropdown */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <Folder className="h-3.5 w-3.5 text-indigo-500" />
            <select
              value={note.folderId || ''}
              onChange={(e) => handleFolderChange(e.target.value || null)}
              className="bg-transparent text-xs outline-none cursor-pointer"
            >
              <option value="" className="dark:bg-slate-900">Uncategorized</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id} className="dark:bg-slate-900">
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags list */}
          <div className="flex items-center gap-1">
            {tags.map((t) => {
              const active = note.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToggleTag(t.id)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    active
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                  }`}
                >
                  #{t.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode controls & Note Actions */}
        <div className="flex items-center gap-1.5">
          {/* Mode switch */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setEditorMode('editor')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                editorMode === 'editor'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Editor only"
            >
              Write
            </button>
            <button
              onClick={() => setEditorMode('split')}
              className={`hidden md:block rounded px-2.5 py-1 text-xs font-medium transition ${
                editorMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Split view"
            >
              Split
            </button>
            <button
              onClick={() => setEditorMode('preview')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                editorMode === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Preview only"
            >
              Preview
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Action buttons */}
          <button
            onClick={handleTogglePin}
            className={`rounded-lg p-1.5 transition ${
              note.isPinned
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
          >
            <Pin className="h-4 w-4" />
          </button>

          <button
            onClick={handleToggleArchive}
            className={`rounded-lg p-1.5 transition ${
              note.isArchived
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300'
            }`}
            title={note.isArchived ? 'Unarchive note' : 'Archive note'}
          >
            <Archive className="h-4 w-4" />
          </button>

          <button
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Markdown Toolbar (visible when writing) */}
      {editorMode !== 'preview' && (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/70 px-6 py-2 text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/50 dark:text-slate-400">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**', 'bold text')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*', 'italic text')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => insertLinePrefix('# ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('## ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('### ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => insertLinePrefix('- ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('1. ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('- [ ] ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Task checkbox"
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => insertFormatting('`', '`', 'code')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Inline code"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('```\n', '\n```', 'code block')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Code block"
          >
            <SquareCode className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('> ')}
            className="rounded p-1 hover:bg-slate-200/80 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Blockquote"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Title Input */}
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800/80">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Note"
          className="w-full bg-transparent text-xl font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
      </div>

      {/* Main Content: Split / Editor / Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Area */}
        {(editorMode === 'editor' || editorMode === 'split') && (
          <div
            className={`flex flex-col h-full overflow-y-auto ${
              editorMode === 'split' ? 'w-full md:w-1/2 border-r border-slate-200 dark:border-slate-800' : 'w-full'
            }`}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Write in markdown... (supports bold, italics, headers, lists, code, and checklists)"
              className="h-full w-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-200 dark:placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Live Preview Area */}
        {(editorMode === 'preview' || editorMode === 'split') && (
          <div
            className={`flex flex-col h-full overflow-y-auto p-6 ${
              editorMode === 'split' ? 'hidden md:flex md:w-1/2 bg-slate-50/40 dark:bg-slate-950/40' : 'w-full'
            }`}
          >
            <MarkdownRenderer
              markdown={content}
              onToggleCheckbox={handleCheckboxToggleInPreview}
            />
          </div>
        )}
      </div>

      {/* Bottom Statistics & Auto-save Status */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-6 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            <strong className="font-mono tabular-nums">{wordCount}</strong> words
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-mono tabular-nums">{charCount}</strong> chars
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-mono tabular-nums">{readTime}</strong> min read
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {isSaved ? (
            <span className="text-emerald-600 dark:text-emerald-400">✓ Saved locally</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 animate-pulse">Saving...</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Custom Clean Markdown Parser & Renderer
// ==========================================
interface MarkdownRendererProps {
  markdown: string;
  onToggleCheckbox: (lineIndex: number, currentChecked: boolean) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, onToggleCheckbox }) => {
  if (!markdown.trim()) {
    return (
      <div className="text-xs text-slate-400 italic">
        Markdown preview will appear here as you type...
      </div>
    );
  }

  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let taskCheckboxCounter = 0;

  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block open/close
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 dark:border-slate-800"
          >
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="mb-2 mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {renderInline(line.replace('# ', ''))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mb-2 mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {renderInline(line.replace('## ', ''))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="mb-1 mt-3 text-sm font-semibold text-slate-900 dark:text-white">
          {renderInline(line.replace('### ', ''))}
        </h3>
      );
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={i} className="my-4 border-slate-200 dark:border-slate-800" />);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          className="my-2 border-l-2 border-indigo-400 bg-indigo-50/40 py-1 pl-3 pr-2 text-xs italic text-slate-700 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-slate-300"
        >
          {renderInline(line.replace('> ', ''))}
        </blockquote>
      );
      continue;
    }

    // Interactive Checkbox / Task Item
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const text = taskMatch[2];
      const currentIndex = taskCheckboxCounter;
      taskCheckboxCounter++;

      elements.push(
        <div key={i} className="flex items-center gap-2.5 my-1 text-xs">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleCheckbox(currentIndex, isChecked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
          />
          <span
            className={
              isChecked
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-200'
            }
          >
            {renderInline(text)}
          </span>
        </div>
      );
      continue;
    }

    // Bullet List
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInline(line.substring(2))}
        </li>
      );
      continue;
    }

    // Numbered List
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInline(numMatch[2])}
        </li>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="my-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInline(line)}
      </p>
    );
  }

  return <div className="prose-clean max-w-none">{elements}</div>;
};

// Inline parser for bold, italics, inline code, and links
function renderInline(text: string): React.ReactNode {
  // Regex parsing parts
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/);
    // Italic: *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/);
    // Inline code: `text`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)$/);

    // Pick closest match
    type MatchCandidate = { type: 'bold' | 'italic' | 'code'; match: RegExpMatchArray; index: number };
    const candidates: MatchCandidate[] = [];

    if (boldMatch && boldMatch[1] !== undefined) {
      candidates.push({ type: 'bold', match: boldMatch, index: boldMatch[1].length });
    }
    if (italicMatch && italicMatch[1] !== undefined) {
      candidates.push({ type: 'italic', match: italicMatch, index: italicMatch[1].length });
    }
    if (codeMatch && codeMatch[1] !== undefined) {
      candidates.push({ type: 'code', match: codeMatch, index: codeMatch[1].length });
    }

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    candidates.sort((a, b) => a.index - b.index);
    const best = candidates[0];

    const before = best.match[1];
    const target = best.match[2];
    const after = best.match[3];

    if (before) parts.push(before);

    if (best.type === 'bold') {
      parts.push(
        <strong key={keyIndex++} className="font-semibold text-slate-900 dark:text-white">
          {target}
        </strong>
      );
    } else if (best.type === 'italic') {
      parts.push(
        <em key={keyIndex++} className="italic">
          {target}
        </em>
      );
    } else if (best.type === 'code') {
      parts.push(
        <code
          key={keyIndex++}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-indigo-600 dark:bg-slate-800 dark:text-indigo-400"
        >
          {target}
        </code>
      );
    }

    remaining = after;
  }

  return <>{parts}</>;
}
