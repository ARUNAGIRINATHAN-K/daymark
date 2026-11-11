# Local development

Daymark is a Vite single-page application. Its entry is `src/main.tsx`; routes are declared in `src/App.tsx`, and shared navigation and PWA/sync dialogs are mounted in `src/components/layout/AppLayout.tsx`.

## Commands

```powershell
bun install --frozen-lockfile
bun run dev
bun run lint
bun run test
bun run build
bun run preview
bun run test:e2e
```

The dev server uses port 3000. `lint` runs `tsc --noEmit`; `test` runs Vitest; `build` writes the production app to `dist/`; `preview` serves that build. The Playwright suite expects a fresh production build and serves `dist/` on port 4173. Run `bunx playwright install chromium` once per machine before the browser suite.

Vitest coverage lives in `tests/` and uses `fake-indexeddb` for persistence scenarios. Browser scenarios are in `tests/e2e/` and use Chromium at desktop (1440×960) and mobile (390×844) viewports. Tests can seed a new database with demo content; browser contexts are isolated from a user's ordinary browser profile.

## Data development rules

- Keep persisted entities in Dexie/IndexedDB and use existing service modules for mutations.
- Entity changes and their outbox operations must remain transactional.
- Do not reset, clear, or migrate user data to make a test pass. Use the isolated fake database in tests.
- Preserve `bun.lock`; update it only alongside an approved dependency change.
- See root `AGENTS.md` before modifying code.
