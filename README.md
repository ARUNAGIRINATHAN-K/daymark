# Daymark

Daymark is an offline-first, local-first productivity web app for notes, tasks, folders, tags, search, archive, and trash. It is built with React 19, TypeScript, Vite, Zustand, and Dexie (IndexedDB), and ships as an installable Progressive Web App (PWA).

All data is stored on the device in IndexedDB (`DaymarkDB`). Core CRUD, search, and organization work without a network connection or backend.

**Sync status (V1):** *This build has no remote sync server, authentication, or external API. The sync queue and conflict-management code is client-side infrastructure only, so queued changes are not synchronized to other devices.*

## Technologies

Versions are pinned in `bun.lock`.

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS 4](https://tailwindcss.com/), [Vite](https://vite.dev/)
- **State & Routing:** [Zustand](https://zustand.docs.pmnd.rs/), [React Router](https://reactrouter.com/)
- **Storage:** [Dexie.js](https://dexie.org/) (IndexedDB)
- **Utilities:** [Zod](https://zod.dev/), [date-fns](https://date-fns.org/), [Lucide React](https://lucide.dev/)
- **PWA:** [Vite PWA](https://vite-pwa-org.netlify.app/), [Workbox](https://developer.chrome.com/docs/workbox/)
- **Testing:** [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)

## Getting Started

```bash
bun install --frozen-lockfile
bunx playwright install chromium  
bun run dev
```

Open http://localhost:3000. No API keys or `.env` file is needed.

## Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start the Vite dev server on port 3000 |
| `bun run lint` | Type-check with `tsc --noEmit` |
| `bun run test` | Run 81 Vitest unit tests (fake-indexeddb) |
| `bun run build` | Build production assets to `dist/` |
| `bun run preview` | Serve the production build on port 4173 |
| `bun run test:e2e` | Run Playwright tests against the production preview |

## Development Guidelines

- Persist entities through Dexie/IndexedDB, and make mutations through service modules (`notesService`, `tasksService`, etc.).
- Entity changes and their outbox operations must commit in a single Dexie transaction.
- Tests run against isolated `fake-indexeddb` instances. Do not reset or alter real user data to make tests pass.
- Do not modify `bun.lock` without intent.

## Docker

**Production-style build (Nginx, SPA routing, PWA caching headers)**

```bash
docker compose up --build -d
docker compose ps
docker compose down
```

Open http://localhost:8080.

**Vite dev server with hot reload**

```bash
docker compose --profile dev up --build daymark-dev
```

Open http://localhost:3000. Source is bind-mounted, and `node_modules` lives in the named volume `daymark_node_modules`.

> Containers do not hold an application database. Each origin has its own IndexedDB, so data at `localhost:3000` is separate from data at `localhost:8080`.

## Offline & PWA

Workbox precaches the application shell, so Daymark launches offline after it has loaded online at least once.

**Manual check**

1. Run `bun run build && bun run preview`, open http://localhost:4173, and reload once so the service worker registers.
2. Create or edit notes and tasks.
3. In DevTools, set network throttling to **Offline**.
4. Reload. The shell should load from cache, and your records should remain.
5. Close and reopen the tab while offline to confirm persistence.

**Automated coverage**

- `bun run test`: offline CRUD and sync-engine logic.
- `bun run test:e2e`: offline warm reload and navigation at desktop (1440×960) and mobile (390×844) viewports.

## Deployment

Daymark compiles to static files in `dist/` and can be hosted on any static provider (Cloudflare Pages, Netlify, Vercel, AWS S3/CloudFront, Nginx, etc.).

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

**Hosting requirements**

- **SPA fallback:** Every route (e.g., `/notes`, `/tasks/:id`, `/settings`) must serve `index.html`.
- **HTTPS:** Required for service workers, storage persistence, and installation (`localhost` is exempt).
- **Cache headers:**
  - `sw.js` and `manifest.webmanifest`: `no-cache` or a short TTL.
  - `/assets/*`: `public, max-age=31536000, immutable`.
- **Subpath hosting:** The default base is `/`. Hosting under a subpath requires updating the Vite base, manifest, router, and service worker scope.

**Vercel:** The repository includes a `vercel.json` with SPA routing and cache headers. Import the repository, then set Framework Preset to `Vite`, Build Command to `bun run build`, Output Directory to `dist`, and Install Command to `bun install --frozen-lockfile`. No environment variables are required.

## Data, Backup & Restore

- **Storage:** Notes, tasks, folders, and tags are stored in IndexedDB via Dexie, along with the outbox, conflict records, and settings.
- **Export:** *Settings → Backup & Restore* produces a versioned JSON backup (v1) containing all entity rows, allowlisted preferences (theme and default task sort), and portable unsynced outbox operations. Device-specific revision markers, conflict logs, and retry errors are excluded.
- **Restore:** Restoring is additive and non-destructive. For duplicate IDs, you choose *Keep Existing* or *Replace* per record. Unrelated local data is never silently deleted.

## Known Limitations

- **No remote sync server.** The default sync adapter reports that no endpoint is configured, so outbox entries remain queued locally until a real adapter and server exist.
- **Conflict handling is client-tested only.** Tests use fixture data. Real multi-device concurrency has not been tested against a backend.
- **Offline startup depends on a prior online session.** `public/offline.html` is not configured as the Workbox navigation fallback.
- **Quota recovery is incomplete.** Quota errors are detected, but automatic recovery is not fully implemented.
- **Direct Dexie access in the UI.** `DashboardPage`, `TrashPage`, `ConflictDialog`, and `useData` query Dexie directly alongside service calls.
- **Large bundle.** The production JavaScript chunk exceeds 500 kB; code-splitting is pending.
- **Accessibility.** Labels, ARIA landmarks, and focus states are partially implemented and have not had a full audit.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): database stores, contracts, lifecycle state, sync design, and migrations
- [AGENTS.md](AGENTS.md): coding conventions and constraints for AI assistants