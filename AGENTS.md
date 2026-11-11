# Daymark agent instructions

**Read this file before modifying any part of this project.** Read the relevant source, tests, and current documentation as well. These instructions describe the inspected codebase and set the rules for future changes. If the implementation changes, update this file and the related documentation in the same change. Explicit instructions from the project owner in the active session take precedence.

## 1. Project overview

Daymark is a React single-page productivity application configured as an installable Progressive Web App. It provides notes, tasks, folders, tags, search, archive, and trash views. Entity data is stored locally in browser IndexedDB through Dexie. Note and task CRUD is implemented as local operations and does not require network access.

There is no remote API, authentication, or configured remote synchronization endpoint in this repository. A backend-independent sync manager and adapter contract now exist, but the default adapter is explicitly unconfigured and performs no remote work. Outbox entries are local until a configured adapter returns a matching server acknowledgement. Do not describe queued operations as synchronized across devices.

The package is named `react-example`. The repository uses `bun.lock`; use Bun with frozen installs and do not silently regenerate, replace, or discard the lockfile. Playwright is a development-only browser-test dependency.

## 2. Verified technology stack

`package.json` declares ranges and `bun.lock` records the following exact resolutions at the time this file was written. A lockfile resolution does not prove that a package is installed in the current environment.

| Technology | Locked version |
| --- | --- |
| React / React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| Vite | 8.3.7 |
| React Vite plugin | 6.3.0 |
| React Router DOM | 7.18.5 |
| Dexie / dexie-react-hooks | 4.4.7 / 4.4.0 |
| Zustand | 5.1.0 |
| Zod / date-fns | 4.6.7 / 4.4.0 |
| Tailwind CSS / `@tailwindcss/vite` | 4.3.5 / 4.3.5 |
| vite-plugin-pwa / workbox-window | 2.0.0 / 7.4.1 |
| lucide-react | 0.546.0 |
| Vitest / fake-indexeddb | 5.1.0 / 6.2.8 |
| Playwright test | 1.65.0 |

Radix dialog, dropdown-menu, popover, tabs, and tooltip packages are declared. Styling uses Tailwind CSS utilities. No shadcn `components/ui` library was found. Do not add or substitute technologies just because they appeared on an expected stack list. Check actual source usage and the lockfile before proposing dependency changes.

## 3. Actual architecture and folder structure

The React entry point is `src/main.tsx`. `src/App.tsx` declares React Router routes under `AppLayout`. Zustand stores UI state; Dexie live-query hooks expose reactive persisted records. Entity business logic mostly resides in service modules.

```text
.
|-- docs/                 # Project, architecture, schema, status, roadmap, Codex docs
|-- public/               # PWA icons/assets and offline.html
|-- src/
|   |-- components/       # Layout, navigation, notes, tasks, editor, dialogs, PWA, outbox, settings, sync conflicts
|   |-- db/               # Dexie singleton, schema, migration registry, seed/reset helpers
|   |-- hooks/            # Data/live-query, connectivity, and PWA-install hooks
|   |-- lib/              # Shared utilities and ID generation
|   |-- mocks/            # Presentation mock data
|   |-- pages/            # Dashboard, notes, tasks, today, upcoming, folders, archive, trash, search, settings
|   |-- schemas/          # Zod note, task, folder, tag, settings, and backup schemas
|   |-- services/         # Entity CRUD, dashboard, outbox, backup, and preference operations
|   |-- store/            # Zustand UI store
|   |-- sync/             # Network monitor and backend-independent sync manager/queue/adapters
|   |-- types/            # Entity, UI, and operation contracts
|   `-- utils/            # Storage and IndexedDB diagnostics
`-- tests/                # Vitest tests and Playwright production-browser scenarios
```

The plural modules (`notes.service.ts`, `tasks.service.ts`, `folders.service.ts`, `tags.service.ts`) hold primary service implementations. Singular modules (`noteService.ts`, etc.) re-export them for compatibility; they are not separate implementations. Some current hooks/pages/components query Dexie directly. Prefer the existing services or hooks for new data flows and avoid expanding direct database access from presentation code.

## 4. Database access conventions

- Put entity reads/writes and business rules in service modules. Keep React components focused on presentation and user interaction.
- Use existing hooks (`useNotes`, `useTasks`, `useData`) for reactive data where appropriate; use `dexie-react-hooks` live queries consistently with the existing patterns.
- Do not add a new persistence layer or use localStorage for application entities. The existing theme preference is a separate UI preference stored under `daymark_theme` in localStorage.
- When a service mutation updates an entity and records its outbox operation, commit both in one Dexie read/write transaction, following the existing note/task service pattern.
- Handle async failures at an appropriate service/UI boundary; do not swallow write errors or report success if persistence failed.

Existing code has direct database reads in some pages/hooks. Treat that as a known inconsistency, not a reason to add more presentation-layer persistence logic.

## 5. IndexedDB and Dexie rules

- The database singleton is `db` in `src/db/database.ts`; its name is `DaymarkDB`, and the current version is 1.
- The registered stores are `notes`, `tasks`, `folders`, `tags`, `syncOperations`, `outbox`, `conflicts`, and `settings`.
- `outbox` and `syncOperations` are distinct physical stores, even though a source comment calls `outbox` a backwards-compatible alias. Current mutation services use `outbox`. Do not merge, rename, or assume they are aliases without an approved migration plan.
- Sync lifecycle metadata (`pending`, `processing`, `failed`, `completed`, retry time, and error), accepted opaque revision baselines/snapshots, pull cursor, deferred remote changes, conflict revision context, and superseded-operation markers are stored in the existing `settings` store under namespaced keys. The approved `SyncOperation` and canonical `Conflict` fields and Dexie schema remain unchanged. Keep sidecars coordinated with entity/conflict/outbox transactions and clean operation metadata when acknowledged outbox rows are cleared.
- Preserve existing IndexedDB records, including pending outbox entries. Never clear, recreate, or silently discard local data to make code or tests pass.
- Keep service mutations offline-capable. Avoid server/network dependencies in local CRUD.
- Backups use the documented version 1 JSON format. Validate every entity and outbox operation before preview/restore; only export allowlisted entity payload fields and theme/task-sort preferences. Exclude secrets, arbitrary settings, conflict state, remote revision/cursor metadata, and retry/error history.
- Restore is additive. Require explicit per-record choices for ID duplicates, preserve existing outbox rows, and commit selected entity/outbox/default-sort changes in one Dexie transaction. Keep theme in the existing localStorage key and compensate it if the transaction fails.
- Theme remains in `daymark_theme` localStorage; default task sort uses `user-preferences:default-task-sort`. Do not add stores or indexes for these preferences.
- `seedDatabase` populates a new database with demo records. `seedDatabase({ force: true })` and `resetDatabase` can clear data; do not call them against real user data.

## 6. Offline-first requirements

- Local note/task CRUD must continue to work without a network connection.
- Connectivity state is advisory; it must not gate reads/writes to local IndexedDB.
- Do not claim an operation is synced merely because it is in the outbox or connectivity returned online. The V1 adapter has no remote transport; only a matching acknowledgement returned by a configured adapter may mark an operation completed.
- Do not introduce cloud services, remote storage, authentication, or a background sync protocol without explicit project-owner approval.
- Remote revision tokens and base-revision lineage must come from a configured adapter/server. Never compare opaque tokens with client timestamps or local entity version numbers. V1 has no endpoint, so controlled client tests do not prove cross-device synchronization.
- Preserve local/remote/base snapshots in canonical conflict rows and require an explicit resolution. Keep remote/entity/conflict/baseline/outbox changes in one Dexie transaction. Preserve superseded outbox rows and mark them in settings so the queue skips them; do not delete failed work.
- Preserve user data through failures and app updates. Any destructive purge, replacement, or migration requires a deliberate and reviewable recovery strategy.

## 7. PWA and Service Worker conventions

- PWA configuration lives in `vite.config.ts` via `vite-plugin-pwa`; the manifest and Workbox rules are configured there.
- `PWAUpdatePrompt` uses `useRegisterSW` and is mounted through the application layout. Preserve update behavior when changing app-shell caching.
- Workbox uses `index.html` as `navigateFallback`, precaches configured build assets, and has CacheFirst rules for Google font hosts. `public/offline.html` is present but is **not** configured as the navigation fallback; do not document or depend on it as such without changing and verifying the configuration.
- Keep all app-shell assets required for a warm-cache offline relaunch in the precache strategy. External fonts may be unavailable offline until cached.
- Verify service-worker registration, installation, updates, and offline relaunch in a browser for PWA changes. Existing config tests only inspect static configuration and assets; they are not a substitute for runtime verification.

## 8. TypeScript coding standards

- Use TypeScript contracts from `src/types/` and Zod schemas from `src/schemas/` where they exist. Keep runtime validation and types aligned when changing a contract.
- Avoid `any`, unsafe casts, and duplicated shapes where a shared type is appropriate. If an existing boundary requires a cast, keep it narrow and explain why.
- Use the repository's `@/*` alias where it improves clarity; existing relative imports are also common.
- `tsconfig.json` currently does not enable `strict`. Do not change compiler-wide settings as incidental cleanup; propose strictness changes separately and handle existing diagnostics deliberately.
- Existing Zod coverage is for notes, tasks, folders, tags, settings, and the version 1 backup envelope. Conflict rows have no Zod schema. Use `FolderSchema` when validating remote, merged, or imported folder entities.

## 9. React component conventions

- Keep components focused on rendering and interaction. Put business rules and persistence in services.
- Reuse existing page/component and hook patterns instead of duplicating entity logic.
- Use semantic HTML, explicit accessible names for controls, keyboard-operable interactions, and visible focus states. Existing accessibility is inconsistent, so avoid copying unlabeled controls as a standard.
- Preserve responsive Tailwind layouts and mobile navigation behavior.
- Do not introduce a replacement component library or shadcn layer without approval and a concrete need.

## 10. State management rules

- Keep Zustand for UI state such as selection, filters, editor mode, theme, and modal/navigation state.
- Keep persisted notes/tasks/folders/tags in Dexie/IndexedDB; do not mirror the entity database into Zustand or add another global state architecture.
- Continue using Dexie live queries for UI reactivity. Avoid stale duplicate state when a live query already provides the data.
- The online-status hooks currently include both a direct browser-event hook and `NetworkMonitor`-based hook. Do not introduce a third connectivity source; any consolidation should be a separately scoped change.

## 11. Testing requirements

- Add or update tests for new features and behavior changes, especially service CRUD, transaction/outbox behavior, migrations, and offline operation.
- Existing tests use Vitest and `fake-indexeddb`; test files are under `tests/`, including backup/preferences restore tests, sync queue/retry/acknowledgement tests, and `conflict_management.test.ts` for controlled opaque-revision fixtures. Playwright tests are under `tests/e2e/` and target a local production preview in desktop and mobile Chromium viewports.
- Browser tests cover selected app-shell, manifest, route, responsive, and offline relaunch behavior. They do not prove native PWA installation, update activation, quota exhaustion recovery, or cross-device synchronization.
- Do not claim a test passed unless the command ran successfully. Report unavailable dependencies, environment constraints, and unexecuted browser checks.
- Never modify application code or database content solely to make a check pass. Preserve and report pre-existing failures.

## 12. Database migration rules

- Migration declarations are in `src/db/migrations.ts`; store/index strings are in `src/db/schema.ts`. Only version 1 currently exists, with no upgrade callback.
- For a schema change, add a higher Dexie version with a complete `.stores()` declaration and a deliberate upgrade callback where data needs transformation.
- Migrations must be additive and preserve existing entity records and pending local operations. Do not rename/remove fields, stores, or indexes without explicit approval and a reviewed migration/recovery plan.
- Test migration behavior against both a populated database and pending outbox data before shipping.
- Keep `src/types/`, Zod schemas, database indexes, service behavior, tests, and `docs/DATABASE_SCHEMA.md` aligned. Treat migrations as data-sensitive changes.

## 13. Prohibited architectural changes

Without explicit project-owner approval, do not:

- Replace Dexie or IndexedDB, replace Zustand, or recreate the application in another framework.
- Add Firebase, Supabase, an external backend, remote database, or authentication.
- Upgrade, remove, or replace dependencies just to match an expected stack list; preserve the existing lockfile and package-manager convention.
- Rename database fields, TypeScript contracts, stores, routes, or persisted keys.
- Add a new persistence/state architecture or move entity data out of IndexedDB.
- Perform broad unrelated refactors, remove files, or silently delete/overwrite user data.

## 14. Required verification commands

The scripts currently defined in `package.json` are:

```powershell
bun install --frozen-lockfile
bun run lint        # tsc --noEmit
bun run build       # vite build
bun run test        # vitest run
bun run test:e2e    # Playwright against local production preview
bun run dev         # Vite dev server on port 3000
bunx playwright install chromium
```

Use the checked-in Bun lockfile and frozen install for reproducible dependencies. Do not replace it with an npm lockfile. Run lint, build, and relevant tests for code changes when dependencies are available. Record exact failures and do not claim successful verification when local executables are missing. PWA/offline changes also require browser verification; the current Playwright checks cover warm-cache relaunch but do not prove install UX or update activation.

## 15. Documentation maintenance

- Update the relevant docs whenever an approved change affects architecture, data contracts, schema/migrations, offline/PWA behavior, feature status, or development commands.
- Keep documentation factual and distinguish implementation from UI-only, planned, or runtime-unverified behavior.
- Current project documentation is in `docs/`: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `IMPLEMENTATION_STATUS.md`, `DEVELOPMENT_ROADMAP.md`, and `CODEX_RULES.md`.
- Update this `AGENTS.md` when its instructions or the verified architecture change.
