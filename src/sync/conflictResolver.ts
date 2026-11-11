import { db } from '../db/database';
import { FolderSchema } from '../schemas/folder.schema';
import { NoteSchema } from '../schemas/note.schema';
import { TaskSchema } from '../schemas/task.schema';
import type { AppSetting, Conflict, Folder, Note, Task } from '../types';
import { conflictContextKey, revisionKey, type ConflictRevisionContext } from './conflictDetector';
import { outboxService } from '../services/outboxService';

export type ConflictResolution = 'local' | 'remote' | 'merged';

const SUPERSEDED_KEY_PREFIX = 'sync-operation-superseded:';

function parseEntity(type: Conflict['entityType'], data: Record<string, unknown>): Note | Task | Folder {
  switch (type) {
    case 'note': return NoteSchema.parse(data) as Note;
    case 'task': return TaskSchema.parse(data) as Task;
    case 'folder': return FolderSchema.parse(data) as Folder;
  }
}

function setting(key: string, value: unknown, now: number): AppSetting {
  return { key, value, updatedAt: now };
}

function entityTable(type: Conflict['entityType']) {
  switch (type) {
    case 'note': return db.notes;
    case 'task': return db.tasks;
    case 'folder': return db.folders;
  }
}

async function putEntity(type: Conflict['entityType'], entity: Note | Task | Folder): Promise<void> {
  switch (type) {
    case 'note': await db.notes.put(entity as Note); return;
    case 'task': await db.tasks.put(entity as Task); return;
    case 'folder': await db.folders.put(entity as Folder); return;
  }
}

export class ConflictResolver {
  async resolve(conflictId: string, strategy: ConflictResolution, mergedValue?: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    await db.transaction(
      'rw',
      [db.notes, db.tasks, db.folders, db.conflicts, db.outbox, db.settings],
      async () => {
        const conflict = await db.conflicts.get(conflictId);
        if (!conflict || conflict.resolved) throw new Error('This conflict is no longer unresolved.');
        const table = entityTable(conflict.entityType);
        const current = await table.get(conflict.entityId) as Note | Task | Folder | undefined;
        const expectedVersion = typeof conflict.localState.version === 'number' ? conflict.localState.version : null;
        const contextSetting = await db.settings.get(conflictContextKey(conflictId));
        const context = contextSetting?.value as ConflictRevisionContext | undefined;
        const missingLocalRecord = context?.localRecordMissing === true;
        if (expectedVersion === null || (current ? current.version !== expectedVersion : !missingLocalRecord)) {
          throw new Error('The local record changed after this conflict was captured. Refresh conflicts before resolving.');
        }
        if (!context || typeof context.remoteRevision !== 'string' || !context.remoteRevision) {
          throw new Error('Conflict revision metadata is missing; the conflict cannot be safely resolved.');
        }

        const chosen = strategy === 'local'
          ? conflict.localState
          : strategy === 'remote'
            ? conflict.remoteState
            : mergedValue;
        if (!chosen) throw new Error('A merged entity value is required.');
        const entity = parseEntity(conflict.entityType, {
          ...chosen,
          id: conflict.entityId,
          createdAt: current?.createdAt ?? (typeof chosen.createdAt === 'number' ? chosen.createdAt : now),
          updatedAt: now,
          deletedAt: strategy === 'remote' && context.action === 'delete'
            ? (typeof chosen.deletedAt === 'number' ? chosen.deletedAt : now)
            : chosen.deletedAt ?? null,
          version: (current?.version ?? expectedVersion) + 1,
          syncStatus: strategy === 'remote' ? 'synced' : 'pending',
        });

        const operations = await db.outbox
          .filter((operation) => operation.entityType === conflict.entityType &&
            operation.entityId === conflict.entityId && !operation.synced)
          .toArray();
        for (const operation of operations) {
          await db.settings.put(setting(`${SUPERSEDED_KEY_PREFIX}${operation.id}`, {
            superseded: true,
            byConflictId: conflictId,
            at: now,
          }, now));
        }

        await putEntity(conflict.entityType, entity);
        const acceptedRevision = {
          remoteRevision: context.remoteRevision,
          // A local choice remains divergent until the server acknowledges its replacement operation.
          localVersion: strategy === 'remote' ? entity.version : null,
          snapshot: structuredClone(entity),
        };
        await db.settings.put(setting(revisionKey(conflict.entityType, conflict.entityId), acceptedRevision, now));

        if (strategy !== 'remote') {
          const operation = await outboxService.createOperationRecord(
            conflict.entityType,
            conflict.entityId,
            entity.deletedAt === null ? 'update' : 'delete',
            structuredClone(entity) as unknown as Record<string, unknown>
          );
          await db.outbox.add(operation);
          await db.settings.put(setting(`sync-operation-state:${operation.id}`, {
            operationId: operation.id,
            status: 'pending',
            attemptCount: 0,
            nextRetryAt: null,
            processingStartedAt: null,
            lastError: null,
            updatedAt: now,
          }, now));
        }

        const resolved: Conflict = {
          ...conflict,
          resolved: true,
          resolutionStrategy: strategy,
          resolvedAt: now,
        };
        await db.conflicts.put(resolved);
        await db.settings.delete(conflictContextKey(conflictId));
      }
    );
  }
}

export const conflictResolver = new ConflictResolver();
