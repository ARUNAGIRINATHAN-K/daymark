import { db } from '../db/database';
import { generateId } from '../lib/utils';
import { FolderSchema } from '../schemas/folder.schema';
import { NoteSchema } from '../schemas/note.schema';
import { TaskSchema } from '../schemas/task.schema';
import type { AppSetting, Conflict, Folder, Note, Task } from '../types';
import type { RemoteChange } from './types';

export const REVISION_KEY_PREFIX = 'sync-revision:';
export const CONFLICT_CONTEXT_KEY_PREFIX = 'sync-conflict-context:';
export const DEFERRED_CHANGES_KEY = 'sync-conflicts:deferred-changes';
export const PULL_CURSOR_KEY = 'sync-pull:cursor';

export interface AcceptedRevision {
  remoteRevision: string | null;
  localVersion: number | null;
}

export interface ConflictRevisionContext {
  remoteRevision: string;
  baseRemoteRevision: string | null;
  localVersion: number | null;
  action: RemoteChange['action'];
  localRecordMissing?: boolean;
}

export interface RemoteChangeBatchResult {
  applied: number;
  conflicts: number;
  deferred: number;
  cursorAdvanced: boolean;
}

export function revisionKey(entityType: string, entityId: string): string {
  return `${REVISION_KEY_PREFIX}${entityType}:${entityId}`;
}

export function conflictContextKey(conflictId: string): string {
  return `${CONFLICT_CONTEXT_KEY_PREFIX}${conflictId}`;
}

export async function getAcceptedRevision(entityType: string, entityId: string): Promise<AcceptedRevision | null> {
  const setting = await db.settings.get(revisionKey(entityType, entityId));
  if (!setting || !setting.value || typeof setting.value !== 'object') return null;
  const value = setting.value as Partial<AcceptedRevision>;
  if (value.remoteRevision !== null && typeof value.remoteRevision !== 'string') return null;
  if (value.localVersion !== null && typeof value.localVersion !== 'number') return null;
  return { remoteRevision: value.remoteRevision ?? null, localVersion: value.localVersion ?? null };
}

async function saveSetting(key: string, value: unknown, now: number): Promise<void> {
  const setting: AppSetting = { key, value, updatedAt: now };
  await db.settings.put(setting);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function entityTable(entityType: RemoteChange['entityType']) {
  switch (entityType) {
    case 'note': return db.notes;
    case 'task': return db.tasks;
    case 'folder': return db.folders;
  }
}

async function putEntity(entityType: RemoteChange['entityType'], entity: Note | Task | Folder): Promise<void> {
  switch (entityType) {
    case 'note': await db.notes.put(entity as Note); return;
    case 'task': await db.tasks.put(entity as Task); return;
    case 'folder': await db.folders.put(entity as Folder); return;
  }
}

function parseEntity(entityType: RemoteChange['entityType'], value: Record<string, unknown>): Note | Task | Folder {
  switch (entityType) {
    case 'note': return NoteSchema.parse(value) as Note;
    case 'task': return TaskSchema.parse(value) as Task;
    case 'folder': return FolderSchema.parse(value) as Folder;
  }
}

function asSnapshot(value: Note | Task | Folder | undefined): Record<string, unknown> | null {
  return value ? structuredClone(value) as unknown as Record<string, unknown> : null;
}

function makeRemoteEntity(
  change: RemoteChange,
  current: Note | Task | Folder | undefined,
  now: number
): Note | Task | Folder {
  const payload = recordOf(change.payload);
  if (!payload) throw new Error(`Remote ${change.entityType} ${change.entityId} has an invalid payload.`);
  const merged = { ...(current ?? {}), ...payload } as Record<string, unknown>;
  const createdAt = typeof current?.createdAt === 'number'
    ? current.createdAt
    : typeof merged.createdAt === 'number' ? merged.createdAt : now;
  const deletedAt = change.action === 'delete'
    ? (typeof merged.deletedAt === 'number' ? merged.deletedAt : now)
    : (merged.deletedAt ?? null);
  const data = {
    ...merged,
    id: change.entityId,
    createdAt,
    updatedAt: typeof merged.updatedAt === 'number' ? merged.updatedAt : now,
    deletedAt,
    version: typeof current?.version === 'number' ? current.version + 1 : 1,
    syncStatus: 'synced',
  };
  return parseEntity(change.entityType, data);
}

/** Applies ordered server changes only when both opaque revision lineage and local version match. */
export class ConflictDetector {
  async processChanges(
    changes: RemoteChange[],
    cursor: string | null,
    options: { cursorKey?: string; now?: number } = {}
  ): Promise<RemoteChangeBatchResult> {
    const now = options.now ?? Date.now();
    const cursorKey = options.cursorKey ?? PULL_CURSOR_KEY;
    return db.transaction(
      'rw',
      [db.notes, db.tasks, db.folders, db.conflicts, db.outbox, db.settings],
      async () => {
        const deferredSetting = await db.settings.get(DEFERRED_CHANGES_KEY);
        const deferred = Array.isArray(deferredSetting?.value)
          ? deferredSetting.value as RemoteChange[]
          : [];
        const seenChanges = new Set<string>();
        const pending = [...deferred, ...changes].filter((change) => {
          const key = `${change.entityType}:${change.entityId}:${change.remoteRevision}`;
          if (seenChanges.has(key)) return false;
          seenChanges.add(key);
          return true;
        });
        let applied = 0;
        let conflicts = 0;
        let deferredCount = 0;
        let blockedLineage = false;
        const remaining: RemoteChange[] = [];
        const heldEntities = new Set<string>();

        for (const change of pending) {
          const entityKey = `${change.entityType}:${change.entityId}`;
          if (blockedLineage || heldEntities.has(entityKey)) {
            remaining.push(change);
            deferredCount += 1;
            continue;
          }
          if (typeof change.remoteRevision !== 'string' || change.remoteRevision.length === 0 ||
              !Object.prototype.hasOwnProperty.call(change, 'baseRemoteRevision')) {
            remaining.push(change);
            deferredCount += 1;
            blockedLineage = true;
            continue;
          }

          const existingConflict = await db.conflicts
            .where('entityId')
            .equals(change.entityId)
            .filter((conflict) => conflict.entityType === change.entityType && !conflict.resolved)
            .first();
          if (existingConflict) {
            remaining.push(change);
            deferredCount += 1;
            heldEntities.add(entityKey);
            continue;
          }

          const baselineSetting = await db.settings.get(revisionKey(change.entityType, change.entityId));
          const baselineValue = baselineSetting?.value as Partial<AcceptedRevision> | undefined;
          const baseline: AcceptedRevision | null = baselineValue && typeof baselineValue === 'object'
            ? { remoteRevision: baselineValue.remoteRevision ?? null, localVersion: baselineValue.localVersion ?? null }
            : null;
          // A pull may repeat an already-applied prefix when a later item in
          // the same page had a lineage gap and the cursor had to stay put.
          if (baseline && baseline.remoteRevision === change.remoteRevision) continue;
          if (baseline && baseline.remoteRevision !== change.baseRemoteRevision) {
            remaining.push(change);
            deferredCount += 1;
            blockedLineage = true;
            continue;
          }
          if (!baseline && change.baseRemoteRevision !== null) {
            remaining.push(change);
            deferredCount += 1;
            blockedLineage = true;
            continue;
          }

          const table = entityTable(change.entityType);
          const current = await table.get(change.entityId) as Note | Task | Folder | undefined;
          const pendingOperations = await db.outbox
            .where('entityId')
            .equals(change.entityId)
            .filter((operation) => operation.entityType === change.entityType && !operation.synced)
            .toArray();
          let latestLocalDelete: (typeof pendingOperations)[number] | undefined;
          for (const operation of pendingOperations.sort((a, b) => b.timestamp - a.timestamp)) {
            if (operation.action !== 'delete') continue;
            const superseded = await db.settings.get(`sync-operation-superseded:${operation.id}`);
            if (superseded?.value && typeof superseded.value === 'object' &&
                (superseded.value as { superseded?: unknown }).superseded === true) continue;
            latestLocalDelete = operation;
            break;
          }
          const localChanged = current
            ? !baseline || baseline.localVersion === null || baseline.localVersion !== current.version
            : Boolean(latestLocalDelete);
          if (localChanged) {
            const conflictId = generateId();
            const baseSnapshot = baselineSetting?.value && typeof baselineSetting.value === 'object'
              ? (baselineSetting.value as { snapshot?: Record<string, unknown> }).snapshot
              : undefined;
            const localSnapshot = asSnapshot(current) ?? (latestLocalDelete
              ? {
                  ...(baseSnapshot ?? {}),
                  id: change.entityId,
                  deletedAt: typeof latestLocalDelete.payload.deletedAt === 'number' ? latestLocalDelete.payload.deletedAt : latestLocalDelete.timestamp,
                  updatedAt: latestLocalDelete.timestamp,
                  version: (baseline?.localVersion ?? 0) + 1,
                  syncStatus: 'pending',
                }
              : {});
            const conflict: Conflict = {
              id: conflictId,
              entityType: change.entityType,
              entityId: change.entityId,
              localState: localSnapshot,
              remoteState: recordOf(change.payload) ?? {},
              baseState: null,
              resolved: false,
              resolutionStrategy: null,
              createdAt: now,
            };
            conflict.baseState = baseSnapshot ?? null;
            await db.conflicts.add(conflict);
            await saveSetting(conflictContextKey(conflictId), {
              remoteRevision: change.remoteRevision,
              baseRemoteRevision: change.baseRemoteRevision,
              localVersion: current?.version ?? null,
              action: change.action,
              localRecordMissing: !current && Boolean(latestLocalDelete),
            } satisfies ConflictRevisionContext, now);
            conflicts += 1;
            heldEntities.add(entityKey);
            continue;
          }

          const entity = makeRemoteEntity(change, current, now);
          await putEntity(change.entityType, entity);
          await saveSetting(revisionKey(change.entityType, change.entityId), {
            remoteRevision: change.remoteRevision,
            localVersion: entity.version,
            snapshot: structuredClone(entity),
          }, now);
          applied += 1;
        }

        if (remaining.length > 0) await saveSetting(DEFERRED_CHANGES_KEY, remaining, now);
        else await db.settings.delete(DEFERRED_CHANGES_KEY);
        if (!blockedLineage) await saveSetting(cursorKey, cursor, now);
        return { applied, conflicts, deferred: deferredCount, cursorAdvanced: !blockedLineage };
      }
    );
  }
}

export const conflictDetector = new ConflictDetector();
