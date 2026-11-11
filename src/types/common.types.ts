export type UUID = string;
export type Timestamp = number;

export type SyncStatus = 'synced' | 'pending' | 'failed';

export type EntityType = 'note' | 'task' | 'folder' | 'tag' | 'setting';

export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  version: number;
  syncStatus: SyncStatus;
}
