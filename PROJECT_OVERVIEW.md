# Daymark project overview

Daymark is a local-first React single-page productivity app delivered as an installable PWA. It provides notes, tasks, folders, tags, search, archive, trash, settings, and versioned backup/restore. Entity records live in browser IndexedDB through Dexie. Local CRUD does not depend on a network connection.

The repository contains backend-independent sync queue, retry, revision conflict, and resolution infrastructure. V1 has no API, authentication, or configured remote adapter. Queued work is local and does not synchronize between devices.

## Verified stack

`package.json` declares semver ranges; `bun.lock` pins the exact resolutions. The checked-in Bun lockfile was installed with frozen mode for Phase 11 verification.

| Area | Package | Locked version |
| --- | --- | --- |
| UI | React / React DOM | 19.3.1 |
| Language | TypeScript | 7.0.2 |
| Build | Vite / React plugin | 8.3.7 / 6.3.0 |
| Routing | React Router DOM | 7.18.5 |
| Local database | Dexie / dexie-react-hooks | 4.4.7 / 4.4.0 |
| State | Zustand | 5.1.0 |
| Validation / dates | Zod / date-fns | 4.6.7 / 4.4.0 |
| Styling | Tailwind CSS / Vite plugin | 4.3.5 / 4.3.5 |
| PWA | vite-plugin-pwa / Workbox Window | 2.0.0 / 7.4.1 |
| Icons | Lucide React | 0.546.0 |
| Unit tests | Vitest / fake-indexeddb | 5.1.0 / 6.2.8 |
| Browser tests | Playwright Test | 1.65.0 |

Radix dialog, dropdown-menu, popover, tabs, and tooltip packages are declared. No shadcn `components/ui` library exists. Declared GenAI, Express, dotenv, Motion, and some Radix dependencies appear unused by app source; this audit did not remove dependencies.

## Structure and data flow

```text
src/main.tsx -> App.tsx / React Router -> AppLayout -> pages and components
                                              |             |
                                     Zustand UI state    services/hooks
                                                            |
                                         Dexie DaymarkDB (IndexedDB)
                                                            |
                                          durable outbox and sync manager

tests/                 Vitest with fake-indexeddb
tests/e2e/             Playwright against the production preview
docs/                  architecture, schema, status, and user/development guides
```

Plural service modules contain primary entity logic; singular modules re-export for compatibility. Live query hooks connect persisted data to the UI. Some pages, the `useData` hook, and the conflict dialog query Dexie directly; this is a known service-boundary inconsistency. Zustand stores UI state only. Dexie schema v1 has eight stores: notes, tasks, folders, tags, syncOperations, outbox, conflicts, and settings.

## Commands and audit result

Use Node.js supported by Vite 8 and Bun with the checked-in lockfile:

```powershell
bun install --frozen-lockfile
bun run dev
bun run lint
bun run test
bun run build
bunx playwright install chromium
bun run test:e2e
```

Phase 11 verification passed TypeScript validation, 81 Vitest tests, the production build, and six Playwright scenarios across Chromium desktop (1440×960) and mobile (390×844). Those browser checks cover routes, manifest fetch, responsive overflow, and local note/task persistence after a warm-cache offline reload. Native install/update UX, forced quota exhaustion, cold-cache startup, assistive technology, and real remote sync remain unverified or unavailable. Build emits a warning for a minified JavaScript chunk larger than 500 kB.

See [Architecture](ARCHITECTURE.md), [Implementation status](IMPLEMENTATION_STATUS.md), and [Known limitations](KNOWN_LIMITATIONS.md) for details.
