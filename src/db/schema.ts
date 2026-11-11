export const DATABASE_NAME = 'DaymarkDB';
export const CURRENT_DATABASE_VERSION = 1;

/**
 * Dexie Schema Version 1 Definition
 * Indexes follow the canonical specification:
 * - id: Primary Key (UUID)
 * - *tagIds: Multi-entry index for array tags
 * - deletedAt: Soft deletion filter index
 * - syncStatus: Synchronization queue index
 * - timestamps: Numeric ordering indexes
 */
export const DEXIE_SCHEMA_V1 = {
  notes: 'id, folderId, *tagIds, isPinned, isArchived, deletedAt, syncStatus, updatedAt, createdAt',
  tasks: 'id, folderId, *tagIds, isCompleted, priority, dueDate, deletedAt, syncStatus, updatedAt, createdAt',
  folders: 'id, parentId, deletedAt, updatedAt, createdAt',
  tags: 'id, name, createdAt',
  syncOperations: 'id, entityType, entityId, action, timestamp, synced',
  outbox: 'id, entityType, entityId, action, timestamp, synced', // Backward-compatible outbox alias
  conflicts: 'id, entityType, entityId, resolved, createdAt',
  settings: 'key, updatedAt',
} as const;
