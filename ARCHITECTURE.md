# Daymark architecture 

## Startup and UI composition

`src/main.tsx` mounts `App` into `#root` and imports global CSS. `src/App.tsx` creates the `BrowserRouter`; its nested route tree renders pages inside `AppLayout`, which owns shared navigation, modal mounts, offline indicator, and PWA update prompt. Pages compose focused note/task components, but some data access and mutation calls remain in presentation components.

The UI stack is React 19, React Router 7, Tailwind CSS 4 through the Vite plugin, Lucide icons, and Zustand. The state store covers view/filter selection, selected item, editor mode, sidebar/drawer state, theme, and modal visibility. Entity data is not held in Zustand: Dexie `useLiveQuery` hooks provide reactive IndexedDB reads. Theme preference is stored in `localStorage` under `daymark_theme`; the default task sort is stored in the existing IndexedDB `settings` store under `user-preferences:default-task-sort`.

## Data flow

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

## Local persistence and offline behavior

`src/db/database.ts` exports a singleton `DaymarkDatabase`, configured by `src/db/schema.ts` and `src/db/migrations.ts`. Note and task create/update/delete paths commit the entity and an outbox record in one local IndexedDB transaction. Folder and tag service paths use local transactions for their related-record changes. Browser connectivity is observed through `NetworkMonitor` and hook(s), but it does not gate local CRUD.

The backend-independent sync infrastructure is in `src/sync/`: `SyncAdapter` defines push/pull contracts, `UnconfiguredSyncAdapter` reports that V1 has no endpoint, `SyncQueue` orders and coalesces eligible operations, `RetryManager` computes exponential backoff with jitter, and `SyncManager` coordinates bounded batches, a persisted run lease, acknowledgements, startup recovery, pull application, and conflict detection. `ConflictDetector` compares opaque server revision lineage with a persisted accepted baseline and compares local entity versions with the local version captured at that baseline. `ConflictResolver` applies Keep Local, Keep Remote, or validated manual merges transactionally. The global `ConflictDialog` makes unresolved conflicts explicit. No remote endpoint, transport, or authentication is configured; test adapters exercise client behavior only. The manager does not mark an operation complete without a matching idempotency acknowledgement carrying a server-issued revision.

The existing `SyncOperation` contract and Dexie schema remain unchanged. Queue lifecycle state (`pending`, `processing`, `failed`, `completed`, attempts, retry time, and last error), accepted opaque server revisions, revision snapshots, pull cursor, deferred remote changes, conflict revision context, and superseded-operation markers use namespaced entries in the existing `settings` store. Entity/outbox mutations continue to share a transaction. The operation ID is the unique idempotency key; never coalesce an operation that has entered processing or has a recorded attempt. Safe adjacent pending update patches can be merged while retaining the first operation ID. Acknowledged operations and their final entity `syncStatus` and revision baseline update are committed in one transaction. Failed and unacknowledged operations remain in the outbox; operations superseded by conflict resolution remain retained and are skipped by queue processing.

`BackupService` exports a versioned `daymark-backup` JSON snapshot of notes, tasks, folders, tags, allowlisted preferences, and unsynced entity operations. Export payloads are filtered through known entity fields and omit error/retry sidecars, arbitrary settings, conflicts, and device-specific remote revision metadata. Import validates the entire version 1 file before preview or writes. Restore is additive and transactional for entities, outbox rows, and task-sort preference; duplicate records require explicit Keep Existing/Replace choices. Theme remains in localStorage and is compensated if the database transaction fails. This format does not support cross-version conversion or full sync-device-state migration.

The app layout recovers stale processing metadata at startup when it can acquire the persisted run lease. `runSync` handles one bounded batch, preserves per-entity order, applies compatible pulled snapshots, and defers revision-chain gaps without advancing the pull cursor. Conflicts preserve local/remote/base snapshots in the canonical `conflicts` row and remain unresolved across reloads. A configured adapter's retryable failures schedule a later run using the persisted next-retry timestamp; V1 has no configured remote adapter to perform network retries. The Settings/outbox UI reports the unconfigured endpoint and shows pending, processing, failed, superseded-retained, and server-acknowledged states; clearing applies only to acknowledged rows. Conflict UI is wired but there is no configured endpoint in V1, so real server or cross-device behavior is unverified.

## PWA and caching

`vite.config.ts` configures `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a manifest, icons, Workbox precaching glob patterns, `index.html` as `navigateFallback`, a `/api` denylist, and CacheFirst caching for Google font hosts. `PWAUpdatePrompt` calls `useRegisterSW`, so registration and update prompting are wired into the mounted layout. `PWAInstallButton` handles the browser install prompt and offers iOS instructions. Phase 11 Playwright runs against the production preview verified manifest/icon fetches, an active controlling service worker, cached app assets, and warm-cache offline relaunch in Chromium desktop/mobile viewports. Native installation and update activation remain unverified. `public/offline.html` is not the navigation fallback; cold-cache offline startup is not guaranteed.

`public/offline.html` is included as an asset, but the Workbox navigation fallback points at `index.html`; that file unregisters service workers and redirects to `/`. It is not configured as the offline navigation fallback. App-shell offline startup depends on the generated service worker having previously cached the needed production assets and the browser serving the SPA shell. Google fonts are remote resources and only become available offline after they have been cached.

## Errors, accessibility, and responsive behavior

Some lower-level functions catch and report failures (database health and storage estimates, network listener exceptions, SW registration errors). UI async actions do not consistently catch service errors, and there is no shared error boundary or user-facing persistence error flow evident. `isQuotaError` exists but is not broadly used to protect CRUD paths; forced quota exhaustion was not tested in a browser. The UI has responsive width/layout classes, mobile navigation, labels on selected controls, and some dialog semantics. Accessibility is uneven: visible controls and search inputs do not all have explicit accessible names, and keyboard/focus behavior was not comprehensively validated.

## Architecture findings and risks

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

## Production audit verification

The Phase 11 run passed TypeScript (`npm.cmd run lint`), Vitest (11 files, 81 tests), production build, and six Playwright scenarios across Chromium desktop (1440×960) and mobile (390×844). The browser tests cover principal routes, manifest fetch, responsive overflow, local note/task creation, and persistence after warm-cache offline reload. They do not cover install UX, update activation, quota exhaustion, native devices, or a real backend. Build output still warns that the main minified JavaScript chunk exceeds 500 kB. See [implementation status](IMPLEMENTATION_STATUS.md) and [known limitations](KNOWN_LIMITATIONS.md).

