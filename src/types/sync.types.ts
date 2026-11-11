import type { EntityType, Timestamp, UUID } from './common.types';

export type SyncAction = 'create' | 'update' | 'delete';

export interface SyncOperation {
  id: UUID;
  entityType: EntityType;
  entityId: UUID;
  action: SyncAction;
  payload: Record<string, unknown>;
  timestamp: Timestamp;
  synced: boolean;
  retryCount: number;
  error?: string | null;
}

export type ConflictResolutionStrategy = 'local' | 'remote' | 'merged';

export interface Conflict {
  id: UUID;
  entityType: 'note' | 'task' | 'folder';
  entityId: UUID;
  localState: Record<string, unknown>;
  remoteState: Record<string, unknown>;
  baseState?: Record<string, unknown> | null;
  resolved: boolean;
  resolutionStrategy?: ConflictResolutionStrategy | null;
  createdAt: Timestamp;
  resolvedAt?: Timestamp | null;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updatedAt: Timestamp;
}
