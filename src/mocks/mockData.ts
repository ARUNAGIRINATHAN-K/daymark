import type { Folder, Note, Tag, Task } from '../types';

const now = Date.now();
const oneDay = 86400000;

export interface PresentationTask extends Task {
  status?: 'todo' | 'in_progress' | 'completed';
}

export const MOCK_FOLDERS: Folder[] = [
  {
    id: 'folder_general',
    name: 'General',
    color: '#6366f1',
    icon: 'folder',
    parentId: null,
    createdAt: now - oneDay * 5,
    updatedAt: now - oneDay * 2,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'folder_projects',
    name: 'Projects',
    color: '#06b6d4',
    icon: 'briefcase',
    parentId: null,
    createdAt: now - oneDay * 4,
    updatedAt: now - oneDay,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'folder_personal',
    name: 'Personal',
    color: '#10b981',
    icon: 'user',
    parentId: null,
    createdAt: now - oneDay * 3,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'folder_research',
    name: 'Research',
    color: '#f59e0b',
    icon: 'book',
    parentId: null,
    createdAt: now - oneDay * 2,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
];

export const MOCK_TAGS: Tag[] = [
  { id: 'tag_quick', name: 'quick-notes', color: '#64748b', createdAt: now - oneDay * 5 },
  { id: 'tag_offline', name: 'offline-first', color: '#6366f1', createdAt: now - oneDay * 4 },
  { id: 'tag_focus', name: 'high-focus', color: '#f59e0b', createdAt: now - oneDay * 3 },
  { id: 'tag_design', name: 'ui-ux', color: '#ec4899', createdAt: now - oneDay * 2 },
  { id: 'tag_architecture', name: 'architecture', color: '#8b5cf6', createdAt: now - oneDay },
];

export const MOCK_NOTES: Note[] = [
  {
    id: 'note_welcome',
    title: 'Welcome to Daymark',
    content: `# Daymark: Local-First Productivity

Daymark is an offline-first productivity workspace designed for speed, resilience, and privacy.

### Key Capabilities
- **Zero Network Delay**: All notes and tasks are stored locally in IndexedDB using Dexie.js.
- **Transactional Outbox**: Every mutation atomically updates the local entity and records an outbox operation in the same database transaction.
- **Rich Markdown**: Write in markdown with live preview, formatting shortcuts, and live word counts.
- **Unified Organization**: Group items by folder, tag with colors, or filter by due dates.
- **Installable PWA**: Install Daymark onto your desktop or mobile home screen for a distraction-free experience.`,
    folderId: 'folder_general',
    tagIds: ['tag_offline'],
    isPinned: true,
    isArchived: false,
    createdAt: now - oneDay * 2,
    updatedAt: now - oneDay,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'note_architecture_brief',
    title: 'Offline-First Architecture Principles',
    content: `## Guiding Architectural Pillars

1. **Local-First As Authority**: The local IndexedDB is the primary source of truth.
2. **Transactional Outbox**: All state mutations commit with audit queue events.
3. **Optimistic Rendering**: UI updates settle immediately with zero latency.
4. **Resilient Sync**: Background reconciliation without blocking user workflow.`,
    folderId: 'folder_projects',
    tagIds: ['tag_architecture', 'tag_offline'],
    isPinned: true,
    isArchived: false,
    createdAt: now - oneDay * 3,
    updatedAt: now - 3600000 * 4,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'note_design_tokens',
    title: 'Daymark Design System Tokens',
    content: `### Color Tokens
- Canvas: Slate 50 / Slate 950
- Surface: Slate 100 / Slate 900
- Borders: Slate 200 / Slate 800
- Primary Accent: Indigo 600 / Indigo 500

### Typography
- Headings: Plus Jakarta Sans
- Tabular figures and telemetry: JetBrains Mono`,
    folderId: 'folder_research',
    tagIds: ['tag_design'],
    isPinned: false,
    isArchived: false,
    createdAt: now - oneDay * 4,
    updatedAt: now - 3600000 * 2,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'note_archived_sample',
    title: 'Sprint 1 Retrospective (Archived)',
    content: `Completed initial repository bootstrap, build configuration, and theme tokens.`,
    folderId: 'folder_projects',
    tagIds: ['tag_quick'],
    isPinned: false,
    isArchived: true,
    createdAt: now - oneDay * 10,
    updatedAt: now - oneDay * 7,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
];

export const MOCK_TASKS: PresentationTask[] = [
  {
    id: 'task_explore_editor',
    title: 'Explore Daymark markdown editor & preview',
    description: 'Try the live preview toggle, formatting toolbar, and task checklists.',
    isCompleted: false,
    completedAt: null,
    priority: 'high',
    dueDate: now + 3600000 * 3,
    folderId: 'folder_general',
    tagIds: ['tag_focus'],
    noteId: 'note_welcome',
    status: 'in_progress',
    createdAt: now - oneDay,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'task_audit_pwa',
    title: 'Audit PWA Service Worker caching in DevTools',
    description: 'Check Cache Storage tab to ensure all static scripts and styles are cached offline.',
    isCompleted: false,
    completedAt: null,
    priority: 'high',
    dueDate: now + oneDay,
    folderId: 'folder_projects',
    tagIds: ['tag_offline'],
    noteId: null,
    status: 'todo',
    createdAt: now - oneDay * 2,
    updatedAt: now - 3600000,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'task_kanban_workflow',
    title: 'Test Kanban board drag & status controls',
    description: 'Transition tasks between To Do, In Progress, and Completed columns.',
    isCompleted: false,
    completedAt: null,
    priority: 'medium',
    dueDate: now + oneDay * 2,
    folderId: 'folder_projects',
    tagIds: ['tag_design'],
    noteId: null,
    status: 'todo',
    createdAt: now - oneDay,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'task_install_pwa',
    title: 'Install Daymark as a progressive web app',
    description: 'Use the Install button in the sidebar to add Daymark to your desktop or device.',
    isCompleted: true,
    completedAt: now - 3600000 * 5,
    priority: 'low',
    dueDate: now - 3600000 * 6,
    folderId: 'folder_general',
    tagIds: ['tag_quick'],
    noteId: null,
    status: 'completed',
    createdAt: now - oneDay * 3,
    updatedAt: now - 3600000 * 5,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
  {
    id: 'task_weekly_review',
    title: 'Complete weekly priority roadmap review',
    description: 'Reorder backlog and categorize upcoming deliverables into folders.',
    isCompleted: false,
    completedAt: null,
    priority: 'medium',
    dueDate: now + oneDay * 4,
    folderId: 'folder_personal',
    tagIds: ['tag_focus'],
    noteId: null,
    status: 'todo',
    createdAt: now - oneDay * 2,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncStatus: 'synced',
  },
];
