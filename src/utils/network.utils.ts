import { db } from '../db/database';

export interface StorageEstimateResult {
  usage: number;
  quota: number;
  percentUsed: number;
  usageFormatted: string;
  quotaFormatted: string;
  isHighUsage: boolean;
}

/**
 * Format bytes to human-readable string (B, KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Check if error is an IndexedDB QuotaExceededError or storage limit issue
 */
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const msg = err.message.toLowerCase();
    return (
      name.includes('quotaexceeded') ||
      name.includes('storage') ||
      msg.includes('quota') ||
      msg.includes('storage limit')
    );
  }
  return false;
}

/**
 * Fetch browser storage quota estimate
 */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 100 * 1024 * 1024; // Fallback 100MB
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;

      return {
        usage,
        quota,
        percentUsed,
        usageFormatted: formatBytes(usage),
        quotaFormatted: formatBytes(quota),
        isHighUsage: percentUsed >= 85,
      };
    } catch (err) {
      console.warn('Failed to estimate storage quota:', err);
    }
  }

  // Fallback defaults
  return {
    usage: 0,
    quota: 100 * 1024 * 1024,
    percentUsed: 0,
    usageFormatted: '0 MB',
    quotaFormatted: '100 MB',
    isHighUsage: false,
  };
}

/**
 * Verify IndexedDB health and table accessibility
 */
export async function checkIndexedDBHealth(): Promise<{ healthy: boolean; tableCounts: Record<string, number> }> {
  try {
    const noteCount = await db.notes.count();
    const taskCount = await db.tasks.count();
    const folderCount = await db.folders.count();
    const outboxCount = await db.outbox.count();

    return {
      healthy: true,
      tableCounts: {
        notes: noteCount,
        tasks: taskCount,
        folders: folderCount,
        outbox: outboxCount,
      },
    };
  } catch (err) {
    console.error('IndexedDB Health Check Failed:', err);
    return {
      healthy: false,
      tableCounts: {},
    };
  }
}
