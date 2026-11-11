import { z } from 'zod';
import { db } from '../db/database';
import { FolderSchema } from '../schemas/folder.schema';
import { NoteSchema } from '../schemas/note.schema';
import { TagSchema } from '../schemas/tag.schema';
import { TaskSchema, SubtaskSchema } from '../schemas/task.schema';
import { UserPreferencesSchema, type TaskSortBy } from '../schemas/settings.schema';
import { DEFAULT_TASK_SORT_SETTING_KEY, settingsService, THEME_STORAGE_KEY } from './settings.service';
import type { AppSetting, Folder, Note, SyncOperation, Tag, Task } from '../types';

export const BACKUP_FORMAT = 'daymark-backup';
export const BACKUP_VERSION = 1;
const SYNC_STATE_PREFIX = 'sync-operation-state:';
const SUPERSEDED_PREFIX = 'sync-operation-superseded:';

const OperationPayloadSchemas = {
  note: NoteSchema.partial().extend({ permanent: z.boolean().optional() }).strict(),
  task: TaskSchema.partial().extend({
    subtasks: z.array(SubtaskSchema.strict()).optional(),
    permanent: z.boolean().optional(),
  }).strict(),
  folder: FolderSchema.partial().extend({ permanent: z.boolean().optional() }).strict(),
  tag: TagSchema.partial().extend({ permanent: z.boolean().optional() }).strict(),
};

const BackupSyncOperationSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(['note', 'task', 'folder', 'tag']),
  entityId: z.string().min(1),
  action: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.number().int().positive(),
  synced: z.literal(false),
}).strict().superRefine((operation, context) => {
  const allowed: Record<string, readonly string[]> = {
    note: ['id', 'title', 'content', 'folderId', 'tagIds', 'isPinned', 'isArchived', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    task: ['id', 'title', 'description', 'status', 'isCompleted', 'completedAt', 'priority', 'dueDate', 'folderId', 'tagIds', 'noteId', 'subtasks', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    folder: ['id', 'name', 'color', 'icon', 'parentId', 'sortOrder', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    tag: ['id', 'name', 'color', 'createdAt', 'permanent'],
  };
  const payloadResult = OperationPayloadSchemas[operation.entityType].safeParse(operation.payload);
  if (!payloadResult.success) {
    context.addIssue({ code: 'custom', path: ['payload'], message: 'Outbox payload does not match its entity contract.' });
  }
  for (const key of Object.keys(operation.payload)) {
    if (!allowed[operation.entityType].includes(key)) {
      context.addIssue({ code: 'custom', path: ['payload', key], message: `Unsupported or sensitive outbox payload field “${key}”.` });
    }
  }
});

const BackupPayloadSchema = z.object({
  notes: z.array(NoteSchema.strict()),
  tasks: z.array(TaskSchema.extend({ subtasks: z.array(SubtaskSchema.strict()).default([]) }).strict()),
  folders: z.array(FolderSchema.strict()),
  tags: z.array(TagSchema.strict()),
  preferences: UserPreferencesSchema,
  outbox: z.array(BackupSyncOperationSchema),
}).strict();

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int().positive(),
  data: BackupPayloadSchema,
}).strict();

export type DaymarkBackup = z.infer<typeof BackupSchema>;
export type BackupEntityType = 'note' | 'task' | 'folder' | 'tag';
export type DuplicateChoice = 'keep-existing' | 'replace';
export type DuplicateChoices = Record<string, DuplicateChoice>;

export interface BackupDuplicate {
  entityType: BackupEntityType;
  id: string;
  label: string;
  /** Used to ensure the reviewed record did not change before restore. */
  existingFingerprint: string;
}

export interface ImportPreview {
  backup: DaymarkBackup;
  newCounts: Record<BackupEntityType, number>;
  duplicates: BackupDuplicate[];
  outboxCount: number;
  exactExistingOperationIds: string[];
  operationConflicts: string[];
  skippedOrphanOperationIds: string[];
}

export interface RestoreResult {
  added: number;
  replaced: number;
  kept: number;
  importedOperations: number;
  skippedOperations: number;
  preferences: DaymarkBackup['data']['preferences'];
}

const ENTITY_TYPES: BackupEntityType[] = ['note', 'task', 'folder', 'tag'];

function getEntityCollections(backup: DaymarkBackup['data']): Record<BackupEntityType, Array<Note | Task | Folder | Tag>> {
  return { note: backup.notes, task: backup.tasks, folder: backup.folders, tag: backup.tags };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return stableStringify(value);
}

function recordKey(type: BackupEntityType, id: string): string {
  return `${type}\u0000${id}`;
}

function duplicateChoiceKey(type: BackupEntityType, id: string): string {
  return `${type}:${id}`;
}

async function findEntity(type: BackupEntityType, id: string): Promise<Note | Task | Folder | Tag | undefined> {
  switch (type) {
    case 'note': return db.notes.get(id);
    case 'task': return db.tasks.get(id);
    case 'folder': return db.folders.get(id);
    case 'tag': return db.tags.get(id);
  }
}

async function putEntity(type: BackupEntityType, entity: Note | Task | Folder | Tag): Promise<void> {
  switch (type) {
    case 'note': await db.notes.put(entity as Note); return;
    case 'task': await db.tasks.put(entity as Task); return;
    case 'folder': await db.folders.put(entity as Folder); return;
    case 'tag': await db.tags.put(entity as Tag); return;
  }
}

async function setEntitySyncStatus(type: BackupEntityType, id: string, syncStatus: 'synced' | 'pending'): Promise<void> {
  switch (type) {
    case 'note': await db.notes.update(id, { syncStatus }); return;
    case 'task': await db.tasks.update(id, { syncStatus }); return;
    case 'folder': await db.folders.update(id, { syncStatus }); return;
    case 'tag': return;
  }
}

function assertUniqueIds(backup: DaymarkBackup): void {
  for (const type of ENTITY_TYPES) {
    const ids = getEntityCollections(backup.data)[type].map((entity) => entity.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Backup contains duplicate ${type} IDs.`);
  }
  const operationIds = backup.data.outbox.map((operation) => operation.id);
  if (new Set(operationIds).size !== operationIds.length) throw new Error('Backup contains duplicate outbox operation IDs.');
}

function parseBackup(input: string | unknown): DaymarkBackup {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      throw new Error('This file is not valid JSON.');
    }
  }

  const header = z.object({ format: z.string(), version: z.number().int() }).passthrough().safeParse(raw);
  if (!header.success) throw new Error('This file is not a supported Daymark backup.');
  if (header.data.format !== BACKUP_FORMAT) throw new Error(`Unsupported backup format: ${header.data.format}.`);
  if (header.data.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported Daymark backup version ${header.data.version}; this app supports version ${BACKUP_VERSION}.`);
  }

  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new Error(`Backup validation failed. ${path}${first?.message ?? 'Check the file and try again.'}`);
  }
  assertUniqueIds(parsed.data);
  return parsed.data;
}

function displayLabel(type: BackupEntityType, value: Note | Task | Folder | Tag): string {
  const item = value as Note & Task & Folder & Tag;
  return typeof item.title === 'string' ? item.title : typeof item.name === 'string' ? item.name : value.id;
}

function getOperationEntityType(operation: Pick<SyncOperation, 'entityType'>): BackupEntityType | null {
  return operation.entityType === 'note' || operation.entityType === 'task' ||
    operation.entityType === 'folder' || operation.entityType === 'tag'
    ? operation.entityType
    : null;
}

function portableOperation(operation: Pick<SyncOperation, 'id' | 'entityType' | 'entityId' | 'action' | 'payload' | 'timestamp'>): z.infer<typeof BackupSyncOperationSchema> {
  const allowed: Record<BackupEntityType, readonly string[]> = {
    note: ['id', 'title', 'content', 'folderId', 'tagIds', 'isPinned', 'isArchived', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    task: ['id', 'title', 'description', 'status', 'isCompleted', 'completedAt', 'priority', 'dueDate', 'folderId', 'tagIds', 'noteId', 'subtasks', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    folder: ['id', 'name', 'color', 'icon', 'parentId', 'sortOrder', 'createdAt', 'updatedAt', 'deletedAt', 'version', 'syncStatus', 'permanent'],
    tag: ['id', 'name', 'color', 'createdAt', 'permanent'],
  };
  const type = getOperationEntityType(operation);
  if (!type) throw new Error('Only note, task, folder, and tag operations can be included in backups.');
  const payload = Object.fromEntries(Object.entries(operation.payload)
    .filter(([key]) => allowed[type].includes(key))
    .map(([key, value]) => [key, type === 'task' && key === 'subtasks' && Array.isArray(value)
      ? value.map((subtask) => {
          if (!subtask || typeof subtask !== 'object' || Array.isArray(subtask)) return subtask;
          const item = subtask as Record<string, unknown>;
          return Object.fromEntries(Object.entries(item).filter(([field]) => ['id', 'title', 'isCompleted'].includes(field)));
        })
      : value]));
  return BackupSyncOperationSchema.parse({
    id: operation.id,
    entityType: type,
    entityId: operation.entityId,
    action: operation.action,
    payload,
    timestamp: operation.timestamp,
    synced: false,
  });
}

function operationFingerprint(operation: SyncOperation | z.infer<typeof BackupSyncOperationSchema>): string {
  if (!getOperationEntityType(operation)) {
    return fingerprint({
      id: operation.id,
      entityType: operation.entityType,
      entityId: operation.entityId,
      action: operation.action,
      payload: operation.payload,
      timestamp: operation.timestamp,
    });
  }
  const portable = portableOperation(operation);
  return fingerprint({
    id: portable.id,
    entityType: portable.entityType,
    entityId: portable.entityId,
    action: portable.action,
    payload: portable.payload,
    timestamp: portable.timestamp,
  });
}

export class BackupService {
  async createBackup(): Promise<DaymarkBackup> {
    const [notes, tasks, folders, tags, outbox, defaultTaskSortBy] = await db.transaction(
      'r', [db.notes, db.tasks, db.folders, db.tags, db.outbox, db.settings], async () => Promise.all([
        db.notes.toArray(), db.tasks.toArray(), db.folders.toArray(), db.tags.toArray(),
        db.outbox.filter((operation) => !operation.synced &&
          ['note', 'task', 'folder', 'tag'].includes(operation.entityType)).toArray(),
        settingsService.getDefaultTaskSort(),
      ])
    );
    return BackupSchema.parse({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      data: {
        notes,
        tasks,
        folders,
        tags,
        preferences: { theme: settingsService.getThemePreference(), defaultTaskSortBy },
        outbox: outbox.map(portableOperation),
      },
    });
  }

  async createBackupJson(): Promise<string> {
    return JSON.stringify(await this.createBackup(), null, 2);
  }

  async previewImport(input: string | unknown): Promise<ImportPreview> {
    const backup = parseBackup(input);
    const duplicateRecords: BackupDuplicate[] = [];
    const newCounts: Record<BackupEntityType, number> = { note: 0, task: 0, folder: 0, tag: 0 };
    const collections = getEntityCollections(backup.data);

    for (const type of ENTITY_TYPES) {
      for (const entity of collections[type]) {
        const existing = await findEntity(type, entity.id);
        if (existing) {
          duplicateRecords.push({
            entityType: type,
            id: entity.id,
            label: displayLabel(type, entity),
            existingFingerprint: fingerprint(existing),
          });
        } else {
          newCounts[type] += 1;
        }
      }
    }

    const exactExistingOperationIds: string[] = [];
    const operationConflicts: string[] = [];
    const skippedOrphanOperationIds: string[] = [];
    const backupEntityKeys = new Set(ENTITY_TYPES.flatMap((type) =>
      collections[type].map((entity) => recordKey(type, entity.id))));
    for (const operation of backup.data.outbox) {
      const existing = await db.outbox.get(operation.id);
      if (existing) {
        if (operationFingerprint(existing) === operationFingerprint(operation)) exactExistingOperationIds.push(operation.id);
        else operationConflicts.push(operation.id);
      }
      const entityType = getOperationEntityType(operation as SyncOperation);
      if (!entityType || backupEntityKeys.has(recordKey(entityType, operation.entityId))) continue;
      const current = await findEntity(entityType, operation.entityId);
      if (current) skippedOrphanOperationIds.push(operation.id);
    }

    return {
      backup,
      newCounts,
      duplicates: duplicateRecords,
      outboxCount: backup.data.outbox.length,
      exactExistingOperationIds,
      operationConflicts,
      skippedOrphanOperationIds,
    };
  }

  async restoreBackup(preview: ImportPreview, choices: DuplicateChoices): Promise<RestoreResult> {
    const backup = parseBackup(preview.backup);
    const currentPreview = await this.previewImport(backup);
    const backupCollections = getEntityCollections(backup.data);
    const backupEntityKeys = new Set(ENTITY_TYPES.flatMap((type) =>
      backupCollections[type].map((entity) => recordKey(type, entity.id))));
    const previewState = (value: ImportPreview) => ({
      duplicates: value.duplicates.map(({ entityType, id, existingFingerprint }) => ({ entityType, id, existingFingerprint }))
        .sort((a, b) => `${a.entityType}:${a.id}`.localeCompare(`${b.entityType}:${b.id}`)),
      operationConflicts: [...value.operationConflicts].sort(),
    });
    if (fingerprint(previewState(preview)) !== fingerprint(previewState(currentPreview))) {
      throw new Error('The database changed after preview. Review the import again.');
    }
    if (currentPreview.operationConflicts.length > 0) {
      throw new Error(`Restore stopped because outbox operation IDs conflict: ${currentPreview.operationConflicts.join(', ')}.`);
    }
    for (const duplicate of currentPreview.duplicates) {
      if (choices[duplicateChoiceKey(duplicate.entityType, duplicate.id)] !== 'keep-existing' &&
          choices[duplicateChoiceKey(duplicate.entityType, duplicate.id)] !== 'replace') {
        throw new Error(`Choose Keep Existing or Replace for ${duplicate.entityType} “${duplicate.label}”.`);
      }
    }

    const choiceByEntity = choices;
    const themeWasSet = typeof localStorage !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY) !== null;
    const previousTheme = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    settingsService.setThemePreference(backup.data.preferences.theme);

    try {
      const result = await db.transaction(
        'rw',
        [db.notes, db.tasks, db.folders, db.tags, db.outbox, db.settings],
        async () => {
          let added = 0;
          let replaced = 0;
          let kept = 0;
          const selectedEntityKeys = new Set<string>();
          const replacedEntityKeys = new Set<string>();
          const collections = backupCollections;

          // Recheck every reviewed entity so a change made after preview cannot be overwritten.
          for (const type of ENTITY_TYPES) {
            for (const imported of collections[type]) {
              const key = recordKey(type, imported.id);
              const existing = await findEntity(type, imported.id);
              const duplicate = currentPreview.duplicates.find((item) => item.entityType === type && item.id === imported.id);
              if (!duplicate && existing) throw new Error('The database changed after preview. Review the import again.');
              if (duplicate && (!existing || fingerprint(existing) !== duplicate.existingFingerprint)) {
                throw new Error('A record changed after preview. Review the import again.');
              }
              if (duplicate && choiceByEntity[duplicateChoiceKey(type, imported.id)] === 'keep-existing') {
                kept += 1;
                continue;
              }
              await putEntity(type, imported);
              selectedEntityKeys.add(key);
              if (duplicate) {
                replaced += 1;
                replacedEntityKeys.add(key);
              } else {
                added += 1;
              }
            }
          }

          const operationIds = new Set(backup.data.outbox.map((operation) => operation.id));
          // Existing pending work for replaced records is retained but marked as superseded.
          for (const key of replacedEntityKeys) {
            const separator = key.indexOf('\u0000');
            const entityType = key.slice(0, separator) as BackupEntityType;
            const entityId = key.slice(separator + 1);
            const existingOperations = await db.outbox
              .where('entityId').equals(entityId)
              .filter((operation) => operation.entityType === entityType && !operation.synced)
              .toArray();
            for (const operation of existingOperations) {
              if (operationIds.has(operation.id)) continue;
              const marker: AppSetting = {
                key: `${SUPERSEDED_PREFIX}${operation.id}`,
                value: { superseded: true, reason: 'backup-restore', restoredAt: Date.now() },
                updatedAt: Date.now(),
              };
              await db.settings.put(marker);
            }
          }

          let importedOperations = 0;
          let skippedOperations = 0;
          for (const operation of backup.data.outbox) {
            const entityType = getOperationEntityType(operation as SyncOperation);
            const key = entityType ? recordKey(entityType, operation.entityId) : '';
            if (entityType && backupEntityKeys.has(key) && !selectedEntityKeys.has(key)) {
              skippedOperations += 1;
              continue;
            }
            if (entityType && !backupEntityKeys.has(key)) {
              const current = await findEntity(entityType, operation.entityId);
              if (current) {
                skippedOperations += 1;
                continue;
              }
            }

            const existing = await db.outbox.get(operation.id);
            if (existing) {
              if (operationFingerprint(existing) !== operationFingerprint(operation)) {
                throw new Error(`Outbox operation ${operation.id} changed after preview; no records were restored.`);
              }
              skippedOperations += 1;
              continue;
            }
            const freshOperation: SyncOperation = {
              ...operation,
              synced: false,
              retryCount: 0,
              error: null,
            };
            await db.outbox.add(freshOperation);
            const now = Date.now();
            await db.settings.delete(`${SUPERSEDED_PREFIX}${freshOperation.id}`);
            await db.settings.put({
              key: `${SYNC_STATE_PREFIX}${freshOperation.id}`,
              value: {
                operationId: freshOperation.id,
                status: 'pending',
                attemptCount: 0,
                nextRetryAt: null,
                processingStartedAt: null,
                lastError: null,
                updatedAt: now,
              },
              updatedAt: now,
            });
            importedOperations += 1;
          }

          for (const key of selectedEntityKeys) {
            const separator = key.indexOf('\u0000');
            const entityType = key.slice(0, separator) as BackupEntityType;
            if (entityType === 'tag') continue;
            const entityId = key.slice(separator + 1);
            const entityHasPortableOperations = backup.data.outbox.some((operation) =>
              operation.entityType === entityType && operation.entityId === entityId);
            if (!entityHasPortableOperations) continue;
            const pendingOperations = await db.outbox
              .where('entityId').equals(entityId)
              .filter((operation) => operation.entityType === entityType && !operation.synced)
              .toArray();
            let hasRunnableOperation = false;
            for (const operation of pendingOperations) {
              const marker = await db.settings.get(`${SUPERSEDED_PREFIX}${operation.id}`);
              if (marker?.value && typeof marker.value === 'object' &&
                  (marker.value as { superseded?: unknown }).superseded === true) continue;
              hasRunnableOperation = true;
              break;
            }
            await setEntitySyncStatus(entityType, entityId, hasRunnableOperation ? 'pending' : 'synced');
          }

          const now = Date.now();
          await db.settings.put({
            key: DEFAULT_TASK_SORT_SETTING_KEY,
            value: backup.data.preferences.defaultTaskSortBy satisfies TaskSortBy,
            updatedAt: now,
          });
          return {
            added,
            replaced,
            kept,
            importedOperations,
            skippedOperations,
            preferences: backup.data.preferences,
          } satisfies RestoreResult;
        }
      );
      return result;
    } catch (error: unknown) {
      try {
        if (typeof localStorage !== 'undefined') {
          if (themeWasSet && previousTheme !== null) localStorage.setItem(THEME_STORAGE_KEY, previousTheme);
          else localStorage.removeItem(THEME_STORAGE_KEY);
        }
      } catch (rollbackError: unknown) {
        throw new AggregateError([error, rollbackError], 'Restore failed and the previous theme preference could not be restored.');
      }
      throw error;
    }
  }
}

export const backupService = new BackupService();
