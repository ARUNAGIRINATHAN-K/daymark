# Daymark

Daymark is an offline-first, local-first productivity web application for notes, tasks, folders, tags, search, archive, and trash. It is built with React 19, TypeScript, Vite 8, Zustand, and Dexie/IndexedDB, and configured as an installable Progressive Web App (PWA).

All entity records are stored locally on the device in IndexedDB (`DaymarkDB`). Basic CRUD, search, and organization do not require a network connection or external backend services.

> **Sync Notice (V1):** The repository has no configured remote sync server, authentication, or external API. The sync queue and conflict management workflows represent client-side infrastructure; in this V1 build, queued work is not synchronized to another device.

---

## Table of Contents

- [Verified Technology Stack](#verified-technology-stack)
- [Prerequisites & Installation](#prerequisites--installation)
- [Local Development & Verification](#local-development--verification)
- [Docker Setup](#docker-setup)
- [Offline & PWA Testing](#offline--pwa-testing)
- [Production Deployment](#production-deployment)
- [Data Storage, Backup & Restore](#data-storage-backup--restore)
- [Known Limitations](#known-limitations)
- [Architecture & Agent Guidelines](#architecture--agent-guidelines)

---

## Verified Technology Stack

`package.json` declares semver ranges and `bun.lock` pins the exact resolutions verified for this build:

| Area | Technology / Package | Locked Version |
| :--- | :--- | :--- |
| **UI Library** | React / React DOM | 19.3.1 |
| **Language** | TypeScript | 7.0.2 |
| **Build Tooling** | Vite / React Plugin | 8.3.7 / 6.3.0 |
| **Routing** | React Router DOM | 7.18.5 |
| **Database** | Dexie / dexie-react-hooks | 4.4.7 / 4.4.0 |
| **State Management** | Zustand | 5.1.0 |
| **Validation & Dates** | Zod / date-fns | 4.6.7 / 4.4.0 |
| **Styling** | Tailwind CSS / Vite Plugin | 4.3.5 / 4.3.5 |
| **PWA & Service Worker**| vite-plugin-pwa / Workbox Window | 2.0.0 / 7.4.1 |
| **Icons** | Lucide React | 0.546.0 |
| **Unit Testing** | Vitest / fake-indexeddb | 5.1.0 / 6.2.8 |
| **E2E Browser Testing** | Playwright Test | 1.65.0 |

---

## Prerequisites & Installation

### Prerequisites
- **Node.js**: Supported by Vite 8 (Node 20.19+ or 22.12+).
- **Bun**: Required to maintain locked dependency installations from `bun.lock`.
- **Chromium**: Required for Playwright end-to-end tests.
- **Browser**: Any modern browser with IndexedDB and Service Worker support.

### Setup Steps

1. **Install dependencies** (using frozen lockfile mode):
   ```powershell
   bun install --frozen-lockfile
   ```

2. **Install Chromium for Playwright browser testing** (one-time setup):
   ```powershell
   bunx playwright install chromium
   ```

3. **Start the local development server**:
   ```powershell
   bun run dev
   ```
   Open `http://localhost:3000`. No API keys, credentials, or `.env` configurations are required for local note/task functionality.

---

## Local Development & Verification

### Available Scripts

| Command | Purpose |
| :--- | :--- |
| `bun run dev` | Starts the Vite dev server at `http://localhost:3000` |
| `bun run lint` | Runs TypeScript static type checking (`tsc --noEmit`) |
| `bun run test` | Runs the Vitest test suite with `fake-indexeddb` |
| `bun run build` | Compiles production assets into `dist/` |
| `bun run preview` | Locally serves the built production bundle on port 4173 |
| `bun run test:e2e` | Runs Playwright tests against the production preview build |

### Data Development Guidelines
- Keep persisted entities in Dexie/IndexedDB and utilize existing service modules (`notesService`, `tasksService`, etc.) for mutations.
- Entity modifications and their outbox operations must commit in a single Dexie transaction.
- Do not reset, purge, or alter user database content to force tests to pass; tests run against isolated `fake-indexeddb` instances.
- Maintain `bun.lock` without silent modifications.

---

## Docker Setup

Daymark provides containerized options via `Dockerfile` and `compose.yaml`.

### 1. Production-Style Local Container (Nginx)

Runs the multi-stage static build served through Nginx with SPA routing and PWA caching headers:

```powershell
docker compose up --build -d

docker compose ps

docker compose down
```
Open `http://localhost:8080`.

> **Note on Data Isolation:** The Docker container does not store an application database. All records reside in the browser's IndexedDB for the active origin. Browser data created at `http://localhost:3000` is isolated from `http://localhost:8080`.

### 2. Vite Development Container

Runs the hot-reloading Vite dev server inside a container:

```powershell
docker compose --profile dev up --build daymark-dev
```
Open `http://localhost:3000`. Code is bind-mounted for live editing, while `node_modules` is preserved inside a named volume (`daymark_node_modules`).

---

## Offline & PWA Testing

Daymark relies on Workbox to precache the application shell assets, allowing the app to launch offline once loaded online at least once (warm-cache offline support).

### Manual Offline Browser Verification
1. Build and preview the production app (`bun run build && bun run preview`).
2. Open `http://localhost:4173` in your browser. Wait for the Service Worker to register and reload the page once.
3. Create or edit notes and tasks; confirm search results display correctly.
4. In browser DevTools, switch network throttling to **Offline**.
5. Reload the page: verify the app shell loads from cache and stored records remain accessible.
6. Close and reopen the tab while still offline to confirm persistence.

### Automated Coverage
- `bun run test`: Executes 81 Vitest unit tests verifying offline CRUD and sync engine logic in `fake-indexeddb`.
- `bun run test:e2e`: Executes Playwright tests against the production preview in desktop (1440×960) and mobile (390×844) viewports, verifying offline warm reload and navigation.

---

## Production Deployment

Daymark compiles to pure static client-side files in `dist/`. Deploy to any static hosting provider (e.g., Cloudflare Pages, Netlify, Vercel, AWS S3/CloudFront, Nginx):

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

### Hosting Requirements
- **SPA Fallback:** All client route requests (e.g., `/notes`, `/tasks`, `/settings`) must serve `index.html`.
- **HTTPS Required:** Service Workers, storage persistence, and PWA installation require a secure HTTPS origin (with `localhost` as the local development exception).
- **Cache Headers:**
  - `sw.js` and `manifest.webmanifest`: `no-cache` or short TTL to ensure prompt updates.
  - `/assets/*` (content-hashed JS/CSS/images): Long-lived immutable caching (`Cache-Control: public, max-age=31536000, immutable`).
- **Base Path:** Default configuration mounts at `/`. Subpath hosting requires updating the Vite base, manifest, router, and Service Worker scope.

### Deploying to Vercel
Daymark includes a pre-configured `vercel.json` with SPA routing and PWA caching headers.

1. **Push your repository to GitHub.**
2. Go to [vercel.com/new](https://vercel.com/new) and import your `daymark` repository.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `bun run build` (or `vite build`)
   - **Output Directory:** `dist`
   - **Install Command:** `bun install --frozen-lockfile`
   - **Environment Variables:** None required.
4. Click **Deploy**. Vercel will build the static PWA and serve it over HTTPS. Direct links and refreshes on nested routes (`/notes`, `/tasks/:id`, `/settings`) will route seamlessly to `index.html`.

---

## Data Storage, Backup & Restore

### IndexedDB Storage (`DaymarkDB`)
Entity records (notes, tasks, folders, tags) and operational records (outbox, conflicts, settings) are managed by Dexie in browser IndexedDB.

### Backup & Restore Specification
Daymark provides a versioned JSON backup format (v1) accessible under **Settings → Backup & Restore**:
- **Export Scope:** Exports all entity rows (notes, tasks, folders, tags), allowlisted UI preferences (theme in localStorage, default task sort in settings), and portable unsynced outbox operations. Excludes device-specific revision markers, conflict logs, and retry errors.
- **Additive Restore:** Restoring a backup is additive and non-destructive. Duplicate IDs prompt the user for an explicit per-record action (*Keep Existing* vs. *Replace*). It will never silently delete unrelated local data.

---

## Known Limitations

- **No Remote Sync Server:** The default sync adapter reports that no remote endpoint is configured. Outbox entries remain queued locally until a real adapter and server are provided.
- **Client-Side Conflict Verification:** Conflict resolution tests validate client logic with fixture data; real multi-device concurrent revision behavior is not tested against an external backend.
- **Warm-Cache Offline Startup:** Offline startup requires that the application shell was cached during a prior online session. `public/offline.html` is not configured as the Workbox navigation fallback.
- **Browser-Specific Quota Recovery:** While storage estimation and quota error detection are present, automatic recovery from browser storage quota exhaustion is incomplete.
- **Direct Dexie Access in Presentation:** `DashboardPage`, `TrashPage`, `ConflictDialog`, and `useData` currently make direct Dexie queries alongside service calls.
- **Bundle Chunk Size:** Production builds currently generate a JavaScript chunk exceeding 500 kB (code-splitting optimization pending).
- **Accessibility & Focus Auditing:** Control labels, ARIA landmarks, and keyboard focus states are partially implemented and have not undergone a full accessibility audit.

---

## Architecture & Agent Guidelines

For in-depth technical documentation:
- **System Architecture & Database Schema:** See [ARCHITECTURE.md](ARCHITECTURE.md) for database store definitions, contracts, lifecycle state, sync design, and migration guidelines.
- **Agent Pair Programming Instructions:** See [AGENTS.md](AGENTS.md) for coding conventions, rules, and operational constraints for AI assistants.
