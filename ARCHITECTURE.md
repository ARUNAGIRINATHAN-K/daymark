# Daymark Architecture & Database Schema

## 1. Startup and UI Composition

`src/main.tsx` mounts `App` into `#root` and imports global CSS. `src/App.tsx` creates the `BrowserRouter`; its nested route tree renders pages inside `AppLayout`, which owns shared navigation, modal mounts, offline indicator, and PWA update prompt. Pages compose focused note/task components, but some data access and mutation calls remain in presentation components.

The UI stack is React 19, React Router 7, Tailwind CSS 4 through the Vite plugin, Lucide icons, and Zustand. The state store covers view/filter selection, selected item, editor mode, sidebar/drawer state, theme, and modal visibility. Entity data is not held in Zustand: Dexie `useLiveQuery` hooks provide reactive IndexedDB reads. Theme preference is stored in `localStorage` under `daymark_theme`; the default task sort is stored in the existing IndexedDB `settings` store under `user-preferences:default-task-sort`.

## 2. Structure and Data Flow

```text
src/main.tsx -> App.tsx / React Router -> AppLayout -> pages and components
                                              |             |
                                     Zustand UI state    services/hooks
                                                            |
                                                         Dexie DaymarkDB
                                                      notes, tasks, folders,
                                                    tags, outbox, syncOperations,
                                                         conflicts, settings
                                                            |
                                           durable outbox and sync manager

tests/                 Vitest with fake-indexeddb
tests/e2e/             Playwright against the production preview
```

Detailed component-to-storage flow:

```text
Routes / pages / components
        ├── useNotes / useTasks ──> notesService / tasksService ──┐
        ├── useData live queries ─────────────────────────────────┤
        ├── several direct db/useLiveQuery calls ─────────────────┤
        └── modal/editor calls to service functions ──────────────┤
                                                                 v
                                                        Dexie DaymarkDB
                                                     notes, tasks, folders,
                                                   tags, outbox, syncOperations,
                                                        conflicts, settings
```

Plural service modules (`notes.service.ts`, etc.) contain the primary entity logic. Singular modules (`noteService.ts`, etc.) re-export the same service instances as compatibility names; they are not duplicate implementations. `useNotes` and `useTasks` wrap those services and Dexie live queries. In contrast, `useData.ts`, `DashboardPage`, `TrashPage`, and `ConflictDialog` query Dexie directly, and `MarkdownEditor`, list panes, sidebar, dialogs, and pages call services directly. This mixed pattern is an existing design inconsistency, not an architectural boundary that should be changed without a scoped review.

### Dashboard data and visualizations

`DashboardPage` reads notes, tasks, folders, tags, and the 50 newest retained outbox operations through Dexie live-query hooks. `dashboard.service.ts` derives task totals, completion percentage, overdue and next-seven-calendar-day counts, daily created/completed task series, and a 12-week completion map from local entities and their existing timestamps. Trashed records are excluded; archived notes are excluded from recent-note totals. No historical comparison or synthetic activity values are presented. The selected chart range is seven or 30 days.

Recent activity is assembled from currently retained outbox operations so create, update, completion, archive, and trash actions can be identified. The outbox is a synchronization queue, not a durable audit log: acknowledged rows can be cleared, and queued updates can be coalesced. The timeline therefore reflects only operations still available locally and must not be interpreted as a complete activity history. Dashboard calculations and visualizations add no database stores, fields, network dependencies, or remote synchronization behavior.

## 3. Local Persistence and Offline Behavior

`src/db/database.ts` exports a singleton `DaymarkDatabase`, configured by `src/db/schema.ts` and `src/db/migrations.ts`. Note and task create/update/delete paths commit the entity and an outbox record in one local IndexedDB transaction. Folder and tag service paths use local transactions for their related-record changes. Browser connectivity is observed through `NetworkMonitor` and hook(s), but it does not gate local CRUD.

The backend-independent sync infrastructure is in `src/sync/`: `SyncAdapter` defines push/pull contracts, `UnconfiguredSyncAdapter` reports that V1 has no endpoint, `SyncQueue` orders and coalesces eligible operations, `RetryManager` computes exponential backoff with jitter, and `SyncManager` coordinates bounded batches, a persisted run lease, acknowledgements, startup recovery, pull application, and conflict detection. `ConflictDetector` compares opaque server revision lineage with a persisted accepted baseline and compares local entity versions with the local version captured at that baseline. `ConflictResolver` applies Keep Local, Keep Remote, or validated manual merges transactionally. The global `ConflictDialog` makes unresolved conflicts explicit. No remote endpoint, transport, or authentication is configured; test adapters exercise client behavior only. The manager does not mark an operation complete without a matching idempotency acknowledgement carrying a server-issued revision.

The existing `SyncOperation` contract and Dexie schema remain unchanged. Queue lifecycle state (`pending`, `processing`, `failed`, `completed`, attempts, retry time, and last error), accepted opaque server revisions, revision snapshots, pull cursor, deferred remote changes, conflict revision context, and superseded-operation markers use namespaced entries in the existing `settings` store. Entity/outbox mutations continue to share a transaction. The operation ID is the unique idempotency key; never coalesce an operation that has entered processing or has a recorded attempt. Safe adjacent pending update patches can be merged while retaining the first operation ID. Acknowledged operations and their final entity `syncStatus` and revision baseline update are committed in one transaction. Failed and unacknowledged operations remain in the outbox; operations superseded by conflict resolution remain retained and are skipped by queue processing.

User-initiated task completion and reopening are confirmed before persistence from task cards, task details, Kanban status moves, and edits. Confirmed status changes use the existing task update service, which commits the task and its outbox operation together; cancellation makes no write. Dexie live queries refresh All Tasks, date-filtered task lists, and dashboard metrics from the persisted task, with completed tasks retained in All Tasks.

`BackupService` exports a versioned `daymark-backup` JSON snapshot of notes, tasks, folders, tags, allowlisted preferences, and unsynced entity operations. Export payloads are filtered through known entity fields and omit error/retry sidecars, arbitrary settings, conflicts, and device-specific remote revision metadata. Import validates the entire version 1 file before preview or writes. Restore is additive and transactional for entities, outbox rows, and task-sort preference; duplicate records require explicit Keep Existing/Replace choices. Theme remains in localStorage and is compensated if the database transaction fails. This format does not support cross-version conversion or full sync-device-state migration.

The app layout recovers stale processing metadata at startup when it can acquire the persisted run lease. `runSync` handles one bounded batch, preserves per-entity order, applies compatible pulled snapshots, and defers revision-chain gaps without advancing the pull cursor. Conflicts preserve local/remote/base snapshots in the canonical `conflicts` row and remain unresolved across reloads. A configured adapter's retryable failures schedule a later run using the persisted next-retry timestamp; V1 has no configured remote adapter to perform network retries. The Settings/outbox UI reports the unconfigured endpoint and shows pending, processing, failed, superseded-retained, and server-acknowledged states; clearing applies only to acknowledged rows. Conflict UI is wired but there is no configured endpoint in V1, so real server or cross-device behavior is unverified.

## 4. Database Schema (IndexedDB / Dexie)

The application uses Dexie over browser IndexedDB; the database name is `DaymarkDB` and the current Dexie version is `1`.

### Registered Stores and Indexes

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

### Contracts in Source

`BaseEntity` (in `src/types/common.types.ts`) supplies `id`, millisecond `createdAt` and `updatedAt`, nullable `deletedAt`, integer `version`, and `syncStatus` (`synced | pending | failed`). Notes, tasks, and folders extend it. Tags do not. IDs are typed as strings; UUID formatting is not enforced by the contract or Zod schemas.

- **Note**: `title`, `content`, optional nullable `folderId`, `tagIds`, `isPinned`, and `isArchived`, plus the base fields. Note Zod validation runs on create and update.
- **Task**: `title`, optional `description`, optional `status` (`todo | in_progress | completed`), `isCompleted`, optional nullable `completedAt`, priority (`low | medium | high | urgent`), optional nullable `dueDate`, optional nullable folder and note IDs, `tagIds`, optional `subtasks`, plus base fields. Task Zod validation runs on create and update. Completion status and the boolean are both stored and can become inconsistent through some update paths.
- **Folder**: `name` and optional `color`, `icon`, `parentId`, `sortOrder`, plus base fields. `FolderSchema` validates remote and merged folder records; folder CRUD validation has not otherwise changed.
- **Tag**: `id`, `name`, optional `color`, and `createdAt`. There is no tag uniqueness constraint at the IndexedDB index level; the service checks normalized names before insertion.
- **SyncOperation**: `id`, `entityType`, `entityId`, `action`, payload, timestamp, `synced`, retry count, and optional error. `entityType` also allows `setting`; action is create/update/delete.
- **Conflict**: local/remote snapshots, optional base snapshot, resolved state and strategy, and timestamps. Conflict revision lineage and local version context are stored separately in `settings`, leaving this persisted model unchanged.
- **AppSetting**: key, unknown value, and updated timestamp.

### Versioning, Initialization, and Migrations

`src/db/migrations.ts` registers a single migration entry: version 1, with the stores above and no upgrade callback. There are no later migrations in the registry. Dexie creates/populates the database through the `DaymarkDatabase` singleton in `src/db/database.ts`; its `populate` handler calls `seedDatabase`.

The populate seed is not empty: it inserts sample folders, tags, notes, and tasks. It skips seeding if the notes store already contains at least one row. The exported `resetDatabase` helper clears all stores, including both operation stores; `seedDatabase({ force: true })` clears only folders, tags, notes, and tasks before reseeding. Treat both as destructive development utilities and do not invoke against user data.

The application schema remains Dexie version 1. Default task sorting is an `AppSetting` at `user-preferences:default-task-sort`. The theme remains the `daymark_theme` localStorage preference. Backup JSON v1 is a portable file contract rather than a database schema migration: it includes all entity rows, these allowlisted preferences, and unsynced note/task/folder/tag operations. It excludes settings keys other than the represented preference, sync retries/errors, conflict rows, remote revision/cursor data, and secrets. Restore validates before writes, requires explicit choices for existing entity IDs, preserves unrelated records, and writes imported entities/outbox/task preference in one transaction.

### Persistence and Mutation Behavior

The canonical service implementations are `notesService`, `tasksService`, `foldersService`, and `tagsService` under the plural `.service.ts` filenames. Singular filenames re-export these implementations for compatibility. Note/task create, update, soft-delete, restore, and permanent-delete paths write an outbox record within a Dexie read/write transaction. Folder/tag operations also use transactions for their multi-record updates. The operation is local persistence only; no remote server or synchronization protocol is present.

The current sync infrastructure stores per-operation lifecycle metadata as `AppSetting` values under `sync-operation-state:<operationId>` keys. This includes status, attempt count, retry time, processing start, last error, and update time. Revision baselines, pull cursor, deferred changes, conflict context, and superseded markers use separate namespaced settings keys. This does not add fields or indexes to the `SyncOperation` or `Conflict` models or Dexie schema. Acknowledged outbox rows may have operation metadata removed when the UI clears completed rows. Records with no outbox operation are not queued for remote synchronization.

Notes and tasks are soft-deleted by setting `deletedAt`; restore clears it. Permanent delete physically removes the record. Folder and tag deletion physically removes those records; folder deletion first unassigns contained notes and tasks, and tag deletion removes tag IDs from affected notes and tasks. Some related-record mutation paths do not consistently update `syncStatus` (tag removal is one example), despite recording an outbox operation. A matching adapter acknowledgement marks the operation completed; when no later unsynced operation exists, note/task/folder `syncStatus` is updated in the same transaction.

### Migration Safety Rules

1. Never rename or remove a store, index, field, or contract without an approved migration plan.
2. Add a new, higher Dexie version and an explicit `.stores()` declaration for every schema change. Use an upgrade callback for data transformation.
3. Preserve existing notes, tasks, and pending outbox records during upgrades. Test upgrades against a populated database and pending operations before shipping.
4. Clarify and migrate the separate `outbox` and `syncOperations` stores before treating either as a compatibility alias.
5. Keep runtime schemas and TypeScript contracts aligned; add validation for folders and sync records only with a deliberate compatibility plan.

## 5. PWA and Caching

`vite.config.ts` configures `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest, icons, Workbox precaching glob patterns, `index.html` as `navigateFallback`, a `/api` denylist, and CacheFirst caching for Google font hosts. `PWAUpdatePrompt` calls `useRegisterSW`, so registration and update prompting are wired into the mounted layout. `PWAInstallButton` handles the browser install prompt and offers iOS instructions. Phase 11 Playwright runs against the production preview verified manifest/icon fetches, an active controlling service worker, cached app assets, and warm-cache offline relaunch in Chromium desktop/mobile viewports. Native installation and update activation remain unverified. `public/offline.html` is not the navigation fallback; cold-cache offline startup is not guaranteed.

`public/offline.html` is included as an asset, but the Workbox navigation fallback points at `index.html`; that file unregisters service workers and redirects to `/`. It is not configured as the offline navigation fallback. App-shell offline startup depends on the generated service worker having previously cached the needed production assets and the browser serving the SPA shell. Google fonts are remote resources and only become available offline after they have been cached.

## 6. Errors, Accessibility, and Responsive Behavior

Some lower-level functions catch and report failures (database health and storage estimates, network listener exceptions, SW registration errors). UI async actions do not consistently catch service errors, and there is no shared error boundary or user-facing persistence error flow evident. `isQuotaError` exists but is not broadly used to protect CRUD paths; forced quota exhaustion was not tested in a browser. The UI has responsive width/layout classes, mobile navigation, labels on selected controls, and some dialog semantics. Accessibility is uneven: visible controls and search inputs do not all have explicit accessible names, and keyboard/focus behavior was not comprehensively validated.

## 7. Architecture Findings and Risks

1. **Two operation stores**: `outbox` and `syncOperations` are separate physical stores while comments call one an alias. Services and UI use `outbox`; health diagnostics report `syncOperations` separately. This can mislead operational counts and needs an explicit future migration decision.
2. **Mixed service boundaries**: React code directly queries Dexie and invokes mutation services. `DashboardPage` independently reads all note/task rows while also loading service metrics; the raw reads include deleted and archived rows and can disagree with active metrics.
3. **Duplicated data behavior**: `useOnlineStatus` listens directly to browser events while `useNetworkStatus` uses `NetworkMonitor`. These are two connectivity state paths. Singular service files are wrappers, not duplicate logic.
4. **Contracts and validation drift**: `FolderSchema` now validates remote and merged folder entities, while folder CRUD is otherwise unchanged. `Tag` omits base synchronization fields despite tag mutations entering the outbox, operation/conflict Zod validation is absent, and task completion uses both `status` and `isCompleted`. Some update paths can diverge these representations.
5. **Outbox semantics**: Operation records are durable local queue entries; they are remote-pending only when represented in `outbox`. Existing records without such an operation remain local-only. V1 has no configured server, and retry eligibility advances only when the manager is run again. Conflict detection, persisted snapshots, explicit resolution, and pending operation reconciliation are implemented and tested with client-side fixtures only.
6. **Recovery and data retention**: Backup export/import now supports the documented version 1 format with additive restore and explicit duplicate choices. It does not restore conflict history or opaque device-specific sync state. Trash supports restore and permanent purge. Settings exposes a destructive purge behind `window.confirm`; exported seed/reset helpers can clear data and must not be used as production recovery tools.
7. **Startup seed**: New databases are populated with sample content. This is intentional development/demo behavior, but should be reviewed before real user onboarding.
8. **Search and query performance**: Search is in-memory substring filtering after loading collections, not full-text indexed search. `SearchPage` searches note body/title and task title/description; note service search also checks tag names.
9. **PWA fallback mismatch**: `offline.html` describes a redirect/unregister recovery path, but is not the configured navigation fallback. Warm-cache offline relaunch is covered by Playwright; cold-cache startup is not guaranteed.
10. **Declared dependency review**: `@google/genai`, Express, dotenv, Motion, and some Radix packages appear not to be used by source imports. Verify usage and lockfile state before proposing removal; no dependency changes are part of this audit.

## 8. Production Audit Verification

The audit suite passed TypeScript (`bun run lint`), Vitest (11 files, 81 tests), production build, and six Playwright scenarios across Chromium desktop (1440×960) and mobile (390×844). The browser tests cover principal routes, manifest fetch, responsive overflow, local note/task creation, and persistence after warm-cache offline reload. They do not cover install UX, update activation, quota exhaustion, native devices, or a real backend. Build output still warns that the main minified JavaScript chunk exceeds 500 kB. See the [Known Limitations](README.md#known-limitations) section in the README.
