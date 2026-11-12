# Daymark

**A quiet, local-first personal productivity workspace.**  
Notes, tasks, tags, and daily focus powered by browser IndexedDB. Zero tracking. Zero cloud lock-in.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-daymark--umber--nine.vercel.app-black?style=flat-square&logo=vercel)](https://daymark-umber-nine.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Dexie](https://img.shields.io/badge/Storage-IndexedDB-00d26a.svg?style=flat-square)](https://dexie.org/)

**🌐 [Try the Live App](https://daymark-umber-nine.vercel.app/)**

---

## ✦ Features

- **100% Offline-First:** Persisted locally in IndexedDB via Dexie (`DaymarkDB`). Full CRUD without network access.
- **Daily Focus Canvas:** Fast quick-capture bar with inline task/note toggling, priority, and scheduled due dates.
- **Markdown Editor:** Book-proportioned editorial canvas with auto-save and live split preview.
- **Precision Tasks:** List & Kanban views, nested subtasks, and smart date filters (*Today*, *Upcoming*).
- **Data Sovereignty:** Portable Version 1 JSON backup/restore and non-destructive trash recovery.
- **Installable PWA:** Offline app-shell precaching powered by Workbox.

 **Sync Status (v1):** *Operates entirely client-side. The database outbox and conflict queues are local infrastructure; no remote sync server or external API is connected.*

---

## ⚡ Quick Start

```bash
bun install --frozen-lockfile

bun run dev
```
Open **`http://localhost:3000`**. No environment variables or external services required.

---

## Essential Commands

| Command | Action |
| :--- | :--- |
| `bun run dev` | Start Vite dev server on port `3000` |
| `bun run lint` | Typecheck with `tsc --noEmit` |
| `bun run test` | Run 81 Vitest unit & integration tests |
| `bun run build` | Build static production assets to `dist/` |
| `bun run preview` | Preview production build on port `4173` |
| `bun run test:e2e` | Run Playwright browser tests |

---

## Deployment & Docker

Daymark compiles to pure static files (`dist/`) and includes [vercel.json](vercel.json) for instant SPA hosting.

```bash
docker compose up --build -d

docker compose --profile dev up --build daymark-dev
```

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, IndexedDB schemas, and sync queue specs.
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines and roadmap ideas.
- [AGENTS.md](AGENTS.md) — Architectural rules and pair-programming constraints.

---

<div align="center">

## 🌟 Star if you like it ! 🌟

Released under the <a href="LICENSE">MIT License</a>.
</div>
