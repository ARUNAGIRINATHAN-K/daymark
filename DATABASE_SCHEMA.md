# Daymark database schema (as implemented)

This document describes the schema registered by `src/db/schema.ts` and the TypeScript contracts in `src/types/`. It replaces the former aspirational “canonical schema” description. The application uses Dexie over browser IndexedDB; the database name is `DaymarkDB` and the current Dexie version is `1`.

## Registered stores and indexes

| Store | Primary key | Secondary indexes | Notes |
| --- | --- | --- | --- |
| `notes` | `id` | `folderId`, `*tagIds`, `isPinned`, `isArchived`, `deletedAt`, `syncStatus`, `updatedAt`, `createdAt` | `tagIds` is a multi-entry index. |
| `tasks` | `id` | `folderId`, `*tagIds`, `isCompleted`, `priority`, `dueDate`, `deletedAt`, `syncStatus`, `updatedAt`, `createdAt` | `tagIds` is a multi-entry index. |
| `folders` | `id` | `parentId`, `deletedAt`, `updatedAt`, `createdAt` | Folder deletion currently removes the folder record. |
| `tags` | `id` | `name`, `createdAt` | `name` is indexed but the index is not declared unique. |
| `syncOperations` | `id` | `entityType`, `entityId`, `action`, `timestamp`, `synced` | Registered store; current mutation services do not write here. |
| `outbox` | `id` | `entityType`, `entityId`, `action`, `timestamp`, `synced` | Separate IndexedDB store, despite the “backwards-compatible alias” comment. Current mutation services use this store. |
| `conflicts` | `id` | `entityType`, `entityId`, `resolved`, `createdAt` | Stores canonical local/remote/base snapshots, resolution state, and timestamps. Revision context remains in settings. |
| `settings` | `key` | `updatedAt` | Registered key/value store; default task sort and sync queue lifecycle, opaque revision baselines/snapshots, pull cursor, deferred changes, conflict context, and superseded markers are namespaced here. Theme remains in localStorage. |

There are eight physical stores. `outbox` is not an alias for `syncOperations`: both names are independently included in the version 1 `.stores()` definition. This distinction matters for diagnostics and future migration work.

## Contracts in source

`BaseEntity` (in `src/types/common.types.ts`) supplies `id`, millisecond `createdAt` and `updatedAt`, nullable `deletedAt`, integer `version`, and `syncStatus` (`synced | pending | failed`). Notes, tasks, and folders extend it. Tags do not. IDs are typed as strings; UUID formatting is not enforced by the contract or Zod schemas.

- **Note**: `title`, `content`, optional nullable `folderId`, `tagIds`, `isPinned`, and `isArchived`, plus the base fields. Note Zod validation runs on create and update.
- **Task**: `title`, optional `description`, optional `status` (`todo | in_progress | completed`), `isCompleted`, optional nullable `completedAt`, priority (`low | medium | high | urgent`), optional nullable `dueDate`, optional nullable folder and note IDs, `tagIds`, optional `subtasks`, plus base fields. Task Zod validation runs on create and update. Completion status and the boolean are both stored and can become inconsistent through some update paths.
- **Folder**: `name` and optional `color`, `icon`, `parentId`, `sortOrder`, plus base fields. `FolderSchema` now validates remote and merged folder records; folder CRUD validation has not otherwise changed.
- **Tag**: `id`, `name`, optional `color`, and `createdAt`. There is no tag uniqueness constraint at the IndexedDB index level; the service checks normalized names before insertion.
- **SyncOperation**: `id`, `entityType`, `entityId`, `action`, payload, timestamp, `synced`, retry count, and optional error. `entityType` also allows `setting`; action is create/update/delete.
- **Conflict**: local/remote snapshots, optional base snapshot, resolved state and strategy, and timestamps. Conflict revision lineage and local version context are stored separately in `settings`, leaving this persisted model unchanged.
- **AppSetting**: key, unknown value, and updated timestamp.

The former document claimed stricter properties (UUID v4 validation, unique tag names, universal soft deletion/version/sync fields, and a transactional outbox as the sole sync table). Those constraints are not fully enforced by the actual types, schemas, or indexes.

## Versioning, initialization, and migrations

`src/db/migrations.ts` registers a single migration entry: version 1, with the stores above and no upgrade callback. There are no later migrations in the registry. Dexie creates/populates the database through the `DaymarkDatabase` singleton in `src/db/database.ts`; its `populate` handler calls `seedDatabase`.

The populate seed is not empty: it inserts sample folders, tags, notes, and tasks. It skips seeding if the notes store already contains at least one row. The exported `resetDatabase` helper clears all stores, including both operation stores; `seedDatabase({ force: true })` clears only folders, tags, notes, and tasks before reseeding. Treat both as destructive development utilities and do not invoke against user data.

The application schema remains Dexie version 1; Phase 10 adds no stores or indexes. Default task sorting is an `AppSetting` at `user-preferences:default-task-sort`. The theme remains the `daymark_theme` localStorage preference. Backup JSON v1 is a portable file contract rather than a database schema migration: it includes all entity rows, these allowlisted preferences, and unsynced note/task/folder/tag operations. It excludes settings keys other than the represented preference, sync retries/errors, conflict rows, remote revision/cursor data, and secrets. Restore validates before writes, requires explicit choices for existing entity IDs, preserves unrelated records, and writes imported entities/outbox/task preference in one transaction.

## Persistence and mutation behavior

The canonical service implementations are `notesService`, `tasksService`, `foldersService`, and `tagsService` under the plural `.service.ts` filenames. Singular filenames re-export these implementations for compatibility. Note/task create, update, soft-delete, restore, and permanent-delete paths write an outbox record within a Dexie read/write transaction. Folder/tag operations also use transactions for their multi-record updates. The operation is local persistence only; no remote server or synchronization protocol is present.

The current sync infrastructure stores per-operation lifecycle metadata as `AppSetting` values under `sync-operation-state:<operationId>` keys. This includes status, attempt count, retry time, processing start, last error, and update time. Revision baselines, pull cursor, deferred changes, conflict context, and superseded markers use separate namespaced settings keys. This does not add fields or indexes to the `SyncOperation` or `Conflict` models or Dexie schema. Acknowledged outbox rows may have operation metadata removed when the UI clears completed rows. Records with no outbox operation are not queued for remote synchronization.

Notes and tasks are soft-deleted by setting `deletedAt`; restore clears it. Permanent delete physically removes the record. Folder and tag deletion physically removes those records; folder deletion first unassigns contained notes and tasks, and tag deletion removes tag IDs from affected notes and tasks. Some related-record mutation paths do not consistently update `syncStatus` (tag removal is one example), despite recording an outbox operation. A matching adapter acknowledgement marks the operation completed; when no later unsynced operation exists, note/task/folder `syncStatus` is updated in the same transaction.

## Migration safety rules

1. Never rename or remove a store, index, field, or contract without an approved migration plan.
2. Add a new, higher Dexie version and an explicit `.stores()` declaration for every schema change. Use an upgrade callback for data transformation.
3. Preserve existing notes, tasks, and pending outbox records during upgrades. Test upgrades against a populated database and pending operations before shipping.
4. Clarify and migrate the separate `outbox` and `syncOperations` stores before treating either as a compatibility alias.
5. Keep runtime schemas and TypeScript contracts aligned; add validation for folders and sync records only with a deliberate compatibility plan.
