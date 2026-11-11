# Installation

## Prerequisites

- Node.js 20.19+ or 22.12+ for Vite 8.
- Bun. The checked-in `bun.lock` is the dependency lockfile; use its frozen mode to avoid resolving different versions.
- Chromium for browser tests. The app itself runs in a modern browser with IndexedDB and service-worker support.

## Install dependencies

From the repository root:

```powershell
bun install --frozen-lockfile
```

This installs the project dependencies without regenerating the lockfile. Playwright’s browser binaries are installed separately:

```powershell
bunx playwright install chromium
```

No API key, server, account, or network service is needed for local note/task use. No `.env.local` file is required by the current app.

## Start the app

```powershell
bun run dev
```

Vite listens on port 3000. See [Local development](LOCAL_DEVELOPMENT.md) for scripts and verification details.
