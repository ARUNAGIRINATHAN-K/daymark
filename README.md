# Daymark

Daymark is a local-first productivity web app for notes, tasks, folders, tags, search, archive, and trash. It is built with React, TypeScript, Vite, Zustand, and Dexie/IndexedDB, and is configured as an installable PWA. Notes and tasks remain stored on the device and basic CRUD does not require a network connection.

The repository has no configured remote sync server, authentication, or API. The sync queue and conflict workflow are client-side infrastructure; queued work is not synchronized to another device in this V1 build.

## Requirements

- Node.js supported by Vite 8 (Node 20.19+ or 22.12+).
- Bun, to install the exact versions pinned in `bun.lock`.
- Chromium for the Playwright browser suite.

## Install and run

```powershell
bun install --frozen-lockfile
bun run dev
```

Open `http://localhost:3000`. The repository is a static Vite application and does not require a Gemini API key or a backend for its local features.

See [installation](docs/INSTALLATION.md), [local development](docs/LOCAL_DEVELOPMENT.md), and [production deployment](docs/PRODUCTION_DEPLOYMENT.md) for full steps.

## Verification

```powershell
bun run lint
bun run test
bun run build
bun run test:e2e
```

Install the Playwright browser once with `bunx playwright install chromium`. Playwright exercises the local production build in desktop and mobile Chromium viewports. Vitest uses `fake-indexeddb`; neither suite proves real server sync or cross-device behavior.

## Data and backups

Entity records are stored in the browser database `DaymarkDB`. Use Settings → Backup & Restore to export or preview an additive restore. The version 1 JSON backup includes notes, tasks, folders, tags, allowlisted preferences, and unsynced portable outbox operations. Restore requires an explicit choice for each existing ID and does not erase unrelated local data. See [backup and restore](docs/BACKUP_RESTORE.md).

## Project documentation

- [AGENTS.md](AGENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Database schema](DATABASE_SCHEMA.md)
- [Offline testing](OFFLINE_TESTING.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
- [Codex rules](CODEX_RULES.md)