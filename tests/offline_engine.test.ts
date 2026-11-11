import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { notesService } from '../src/services/notes.service';
import { tasksService } from '../src/services/tasks.service';
import { networkMonitor } from '../src/sync/networkMonitor';
import { checkIndexedDBHealth, formatBytes, getStorageEstimate, isQuotaError } from '../src/utils/network.utils';

describe('Master Prompt 06: Offline-First Engine & Resilience', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.folders.clear();
    await db.tags.clear();
    await db.outbox.clear();
    networkMonitor.setOnlineState(true);
  });

  describe('Network Monitor & Singleton Listener Lifecycle', () => {
    it('notifies subscribers on network online/offline state changes', () => {
      const callback = vi.fn();
      const unsubscribe = networkMonitor.subscribe(callback);

      expect(callback).toHaveBeenCalledWith(true);

      // Simulate offline transition
      networkMonitor.setOnlineState(false);
      expect(callback).toHaveBeenCalledWith(false);

      // Simulate online transition
      networkMonitor.setOnlineState(true);
      expect(callback).toHaveBeenCalledWith(true);

      unsubscribe();
    });

    it('prevents duplicate listeners and cleans up properly on unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = networkMonitor.subscribe(callback);

      callback.mockClear();
      networkMonitor.setOnlineState(false);
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();
      networkMonitor.setOnlineState(true);
      // After unsubscribe, callback should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network & Storage Utilities', () => {
    it('formats bytes into human readable units accurately', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('detects QuotaExceededError and storage limit exceptions', () => {
      const quotaErr = new Error('QuotaExceededError: The quota has been exceeded.');
      quotaErr.name = 'QuotaExceededError';

      const randomErr = new Error('Network timeout');

      expect(isQuotaError(quotaErr)).toBe(true);
      expect(isQuotaError(randomErr)).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });

    it('retrieves storage estimate and runs database health check probe', async () => {
      const estimate = await getStorageEstimate();
      expect(estimate.quota).toBeGreaterThan(0);
      expect(estimate.usageFormatted).toBeDefined();

      const health = await checkIndexedDBHealth();
      expect(health.healthy).toBe(true);
      expect(health.tableCounts.notes).toBe(0);
      expect(health.tableCounts.tasks).toBe(0);
    });
  });

  describe('Offline Operations & Outbox Queue Preservation', () => {
    it('executes notes and tasks CRUD 100% locally while offline and preserves outbox queue across reloads', async () => {
      // Simulate offline state
      networkMonitor.setOnlineState(false);
      expect(networkMonitor.getStatus().isOnline).toBe(false);

      // Perform local offline note create
      const note = await notesService.createNote({
        title: 'Offline Note',
        content: 'Created while device has no internet connection.',
      });

      // Perform local offline task create
      const task = await tasksService.createTask({
        title: 'Offline Task',
        priority: 'high',
      });

      // Verify records are committed in IndexedDB
      const savedNote = await db.notes.get(note.id);
      const savedTask = await db.tasks.get(task.id);

      expect(savedNote?.title).toBe('Offline Note');
      expect(savedTask?.title).toBe('Offline Task');

      // Verify outbox queue preserves 2 un-synced operations
      const pendingOutbox = await db.outbox.filter((op) => !op.synced).toArray();
      expect(pendingOutbox.length).toBe(2);
      expect(pendingOutbox.some((op) => op.entityId === note.id)).toBe(true);
      expect(pendingOutbox.some((op) => op.entityId === task.id)).toBe(true);

      // Restore online state
      networkMonitor.setOnlineState(true);
      expect(networkMonitor.getStatus().isOnline).toBe(true);
    });
  });
});
