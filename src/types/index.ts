// Re-export common types
export * from './common.types';

// Re-export entity types
export * from './note.types';
export * from './task.types';
export * from './folder.types';
export * from './tag.types';
export * from './sync.types';

// Re-export canonical schemas
export * from '../schemas/note.schema';
export * from '../schemas/task.schema';
export * from '../schemas/folder.schema';
export * from '../schemas/settings.schema';
export * from '../schemas/tag.schema';

// Maintain backwards compatibility aliases for existing services & hooks
export type OutboxOperation = import('./sync.types').SyncOperation;

// UI View Modes
export type MainView = 'all' | 'notes' | 'tasks' | 'today' | 'upcoming' | 'completed' | 'outbox';
export type ItemType = 'note' | 'task';
export type EditorMode = 'editor' | 'preview' | 'split';
