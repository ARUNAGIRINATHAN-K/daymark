import type {
  PullChangesResult,
  PushOperationsResult,
  SyncAdapter,
  SyncAdapterStatus,
  PushOperation,
} from './types';

export const NO_SYNC_ENDPOINT_MESSAGE = 'No remote sync endpoint is configured for this Daymark build.';

/** V1 adapter: explicitly reports local-only operation and never acknowledges work. */
export class UnconfiguredSyncAdapter implements SyncAdapter {
  getStatus(): SyncAdapterStatus {
    return { configured: false, message: NO_SYNC_ENDPOINT_MESSAGE };
  }

  async pushOperations(_operations: PushOperation[]): Promise<PushOperationsResult> {
    return { configured: false, message: NO_SYNC_ENDPOINT_MESSAGE };
  }

  async pullChanges(_cursor?: string | null): Promise<PullChangesResult> {
    return { configured: false, message: NO_SYNC_ENDPOINT_MESSAGE };
  }
}

