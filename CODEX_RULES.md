# Codex rules for Daymark

These repository rules preserve the existing application while development continues in VS Code with Codex.

## Before changing code

- Read the relevant implementation and current documentation first; inspect the actual lockfile and package scripts.
- Keep changes scoped to the approved request. Do not recreate the application or perform unrelated refactoring.
- Do not install, replace, remove, or upgrade dependencies to match an expected stack list. Verify current usage and the lockfile first.
- Use `bun.lock` with `bun install --frozen-lockfile`; do not create or substitute an npm lockfile. `@playwright/test` is development-only browser-test infrastructure.

## Architecture and data safety

- Preserve the existing React, TypeScript, Vite, Zustand, Dexie, and IndexedDB architecture unless the owner explicitly approves a change.
- Do not replace Dexie or IndexedDB. Do not add Firebase, Supabase, another backend, or authentication without explicit approval.
- Keep business rules in services and components focused. Do not introduce a second state-management architecture.
- Do not rename database fields, TypeScript contracts, stores, indexes, or routes without explicit approval and a reviewed migration plan.
- Use additive, versioned Dexie migrations. Preserve existing local records and pending outbox entries. Never silently clear or discard local data.
- Treat seed/reset utilities, trash purge, permanent delete, and import replacement as destructive. Require an explicit user-directed scope and a recoverable plan.
- Preserve the versioned backup format contract. Validate the complete file before writes; preview imports without mutation; require explicit duplicate-ID choices; never silently replace existing records. Keep restore additive and transactionally preserve existing outbox work.
- Backup exports must allowlist entity fields and preferences. Exclude secrets, arbitrary settings, conflict rows, remote revision tokens/cursors, and retry/error sidecars unless the owner approves a new reviewed backup format version.
- Keep local CRUD independent of network access. Do not label a queued local operation as remotely synced without a real remote acknowledgement.
- Treat the default sync adapter as unconfigured. A configured adapter must provide opaque server revisions, base-revision lineage, ordered remote changes, and acknowledged revisions; never substitute client timestamps or local entity versions for server revisions.
- Keep conflict snapshots in the existing `Conflict` model and revision/cursor/deferred/superseded metadata in namespaced `settings` entries. Resolve entity, conflict, baseline, and outbox reconciliation in one Dexie transaction. Preserve superseded and failed outbox rows.
- Validate remote and manually merged note/task/folder snapshots with their Zod schemas. Keep unresolved conflicts explicit, persist them across reloads, and reject resolution if the local version has changed.

## Verification and documentation

- Do not claim a check passed unless it was run and its result was observed. Report commands that could not run and why.
- For code changes, run `bun run lint`, `bun run test`, and `bun run build`; run `bun run test:e2e` for UI, PWA, or offline changes. Install Chromium using `bunx playwright install chromium` when needed.
- Vitest excludes `tests/e2e/`; Playwright runs against the built production preview at desktop and mobile Chromium viewports. Current browser scenarios do not verify native install/update UX, quota exhaustion, or remote sync.
- Test new features and relevant regressions when dependencies and environment permit; do not alter code or data merely to make a check pass.
- Update the architecture/schema/status documentation when an approved change alters behavior or contracts.
- Keep these rules aligned with explicit owner instructions. Owner instructions in the active session take precedence over this file.
