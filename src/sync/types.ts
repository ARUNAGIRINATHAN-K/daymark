import type { SyncOperation } from '../types';

export type SyncOperationStatus = 'pending' | 'processing' | 'failed' | 'completed';

/**
 * Runtime queue state is stored as an AppSetting keyed by operation ID so the
 * existing IndexedDB SyncOperation contract and schema remain unchanged.
 */
export interface PersistedSyncState {
  operationId: string;
  status: SyncOperationStatus;
  attemptCount: number;
  nextRetryAt: number | null;
  processingStartedAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

export interface SyncQueueItem {
  operation: SyncOperation;
  status: SyncOperationStatus;
  attemptCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
  superseded?: boolean;
}

export interface SyncAdapterStatus {
  configured: boolean;
  message: string;
}

export interface PushAcknowledgement {
  /** Must equal the SyncOperation.id used as its idempotency key. */
  idempotencyKey: string;
  /** The adapter must set this only from a successful remote server response. */
  acknowledged: true;
  /** Opaque revision issued by the remote server for the accepted entity state. */
  remoteRevision: string;
}

export interface PushOperation extends SyncOperation {
  /** Opaque server revision the operation is based on; null means create/no baseline. */
  expectedRemoteRevision: string | null;
}

export interface PushFailure {
  idempotencyKey: string;
  error: string;
  retryable?: boolean;
}

export type PushOperationsResult =
  | {
      configured: true;
      acknowledgements: PushAcknowledgement[];
      failures?: PushFailure[];
    }
  | {
      configured: false;
      message: string;
    };

export interface RemoteChange {
  entityType: 'note' | 'task' | 'folder';
  entityId: string;
  action: SyncOperation['action'];
  /** Full remote entity snapshot for this change, validated before local application/resolution. */
  payload: Record<string, unknown>;
  /** Opaque revision token issued by the server. Never compare or synthesize it. */
  remoteRevision: string;
  /** Revision this change follows; null is valid only for the initial server state. */
  baseRemoteRevision: string | null;
  timestamp: number;
}

export type PullChangesResult =
  | {
      configured: true;
      /** Server-ordered changes. Clients process this order without comparing revision tokens. */
      changes: RemoteChange[];
      cursor: string | null;
    }
  | {
      configured: false;
      message: string;
    };

export interface SyncAdapter {
  getStatus(): SyncAdapterStatus;
  pushOperations(operations: PushOperation[]): Promise<PushOperationsResult>;
  pullChanges(cursor?: string | null): Promise<PullChangesResult>;
}

export type SyncRunStatus = 'completed' | 'partial' | 'unconfigured' | 'already-running';

export interface SyncRunResult {
  status: SyncRunStatus;
  message: string;
  attempted: number;
  acknowledged: number;
  failed: number;
  deferred: number;
  changes: RemoteChange[];
  conflicts?: number;
  pullError?: string;
}

