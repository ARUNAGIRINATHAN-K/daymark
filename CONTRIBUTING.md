# Contributing to Daymark

Thank you for your interest in contributing to **Daymark**! We welcome contributions from developers, designers, and writers of all experience levels.

Daymark is an intentional, local-first productivity notebook and workbench built with React 19, TypeScript, Vite, Zustand, Dexie (IndexedDB), and Tailwind CSS v4.

---

## 1. Guiding Principles & Design Philosophy

Before submitting an issue or pull request, please keep our core tenets in mind:

1. **Local-First & Private by Default:** All personal data (notes, tasks, folders, tags) remains on the user's device in IndexedDB. Basic CRUD must function completely offline without network dependencies or mandatory account creation.
2. **Quiet Craft & Refined Utility:** Daymark avoids generic SaaS templates, bloated enterprise KPI metrics, gratuitous cards, and aggressive gradients. Interfaces should feel calm, tactile, and content-forward.
3. **Additive & Non-Destructive:** We never silently discard, overwrite, or purge local user data. Soft-deletion to Trash with easy recovery is always preferred over destructive actions.
4. **Accessible & Ergonomic:** Typography uses accessible scales ($12\text{px}+$), keyboard navigation is first-class, and inputs have visible focus states.

---

## 2. Development Setup

### Prerequisites
* [Bun](https://bun.sh/) (v1.1+ recommended)
* Node.js / Chromium (for Playwright browser tests)

> [!IMPORTANT]
> This repository uses **`bun.lock`**. Always use Bun with frozen installs. Do **not** replace the lockfile with `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.

### Installation & Local Server

```bash
# Clone the repository
git clone https://github.com/your-username/daymark.git
cd daymark

# Install dependencies using frozen lockfile
bun install --frozen-lockfile

# Start the Vite development server (port 3000)
bun run dev
```

### Verification Commands

Before opening a pull request, ensure all validation scripts pass locally:

```bash
# 1. Typecheck and linting
bun run lint        # Runs: tsc --noEmit (must pass with 0 errors)

# 2. Run unit and integration tests
bun run test        # Runs: vitest run (81+ tests across 11 suites)

# 3. Verify production bundle build
bun run build       # Runs: vite build (generates dist/ with PWA Service Worker)

# 4. Optional: Run Playwright browser tests
bun run test:e2e    # Runs Playwright against a local preview
```

---

## 3. Architecture & Code Guidelines

### Database & Persistence (Dexie / IndexedDB)
* The database singleton resides at [`src/db/database.ts`](file:///a:/My%20project/daymark/src/db/database.ts) (`DaymarkDB`, Version 1).
* **Do NOT change the database schema** or rename stores/indexes without an approved migration plan.
* All business logic and database writes belong in service modules (e.g., [`notes.service.ts`](file:///a:/My%20project/daymark/src/services/notes.service.ts), [`tasks.service.ts`](file:///a:/My%20project/daymark/src/services/tasks.service.ts)). Do not perform direct database mutations inside React presentation components.
* Entity mutations and outbox entries must be committed within a single atomic Dexie read/write transaction.

### State Management
* **Dexie Live Queries (`useLiveQuery`):** Used for reactive data subscriptions to notes, tasks, folders, and tags.
* **Zustand (`src/store/useAppStore.ts`):** Used strictly for transient UI state (sidebar drawer, active filter selections, editor view mode, theme preference). Never mirror the entity database inside Zustand.

### Styling & Design Tokens
* Styling uses Tailwind CSS v4 utility classes combined with custom semantic CSS properties defined in [`src/index.css`](file:///a:/My%20project/daymark/src/index.css):
  * `var(--color-bg-primary)`, `var(--color-bg-card)`, `var(--color-bg-secondary)`
  * `var(--color-border-primary)`, `var(--color-border-secondary)`
  * `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-muted)`
  * `var(--color-accent)`, `var(--color-accent-hover)`, `var(--color-accent-subtle)`
* Maintain container consistency: use `rounded-lg` for interactive controls and `rounded-xl` for cards/panels. Avoid heavy, bulbous borders or micro-text smaller than `text-xs` ($12\text{px}$).

---

## 4. Pull Request Process

1. **Fork and Branch:** Create a feature branch from `main` (e.g., `feat/export-note-markdown` or `fix/task-filter-reset`).
2. **Focused Changes:** Keep pull requests focused on a single feature, bugfix, or improvement. Avoid broad, unrelated refactorings in the same PR.
3. **Test Coverage:** Add or update tests in `tests/` for any new service logic, outbox integration, or utility function.
4. **Run Checks:** Confirm `bun run lint`, `bun run test`, and `bun run build` succeed with zero errors.
5. **Open Pull Request:** Describe the problem being solved, the files modified, and include before/after screenshots for visual UI changes.

---

## 5. Ideas & Roadmap

Looking for inspiration? Here is a curated roadmap of community contribution ideas:

### Good First Issues (Beginner-Friendly)
* [ ] **Keyboard Shortcut Modal (`?` or `Cmd/Ctrl + /`):** Implement a global keyboard listener that opens a clean modal listing Daymark's keyboard shortcuts.
* [ ] **Relative Date Tooltips:** Display the full formatted timestamp (e.g., *"March 14, 2026, 2:30 PM"*) on hover over relative dates like *"Yesterday"* or *"in 3 days"*.
* [ ] **Direct Tag Filtering from Cards:** Make `#tag` pills on note and task cards clickable to automatically filter the current list by that tag.

### Editorial & Markdown Writing
* [ ] **Export Note to File (`.md` / `.txt`):** Add an export action in the editor header that downloads the note content to the local filesystem using the browser Blob API.
* [ ] **Drag-and-Drop Markdown Import:** Allow dragging `.md` files into the Notes view or editor canvas to create a new note with the heading as the title.
* [ ] **Distraction-Free Zen Mode:** A toggle in the editor that hides sidebars and top headers for an unencumbered full-screen writing session.
* [ ] **Lightweight Code Syntax Highlighting:** Add unobtrusive code block syntax highlighting in Markdown preview mode.

### Task & Workflow Power Tools
* [ ] **Due-Time Support:** Extend task due dates to support optional specific times with reminder/overdue styling.
* [ ] **Kanban Drag-and-Drop:** Enhance the Kanban board with smooth, accessible drag-and-drop between columns.
* [ ] **Recurring Tasks:** Add recurrence rules (Daily, Weekly, Monthly) that automatically schedule the next task upon completion.
* [ ] **Batch Task Actions:** Support multi-selecting tasks to mark complete, move folders, or move to trash simultaneously.

### Local-First & Data Sovereignty
* [ ] **File System Access API Sync Adapter:** Implement a secondary sync adapter in `src/sync/adapters/` that saves encrypted backups directly to a user-chosen local directory.
* [ ] **Interactive Storage Breakdown:** Add an interactive storage visualizer in Settings showing disk usage breakdown across notes, tasks, and outbox logs.
* [ ] **Quick Note Scratchpad / Global Shortcut:** Support a global shortcut to open the Quick Capture bar from anywhere in the app.

### Accessibility (a11y) & Mobile Experience
* [ ] **Mobile Swipe Actions:** Support touch gestures on mobile task cards (swipe right to complete, swipe left to trash).
* [ ] **App Badging API:** Use `navigator.setAppBadge()` to reflect overdue/today task counts on the installed PWA desktop and home-screen app icon.
* [ ] **High-Contrast Theme Preset:** Provide an optional true-black OLED mode alongside warm light and slate dark modes.
* [ ] **Screen Reader Live Announcements:** Add ARIA live regions for task completions, auto-save statuses, and search result counts.

---

## 6. Questions & Discussions

Have questions about an architectural decision or need feedback on an idea before writing code? Open an issue or discussion on GitHub. We are excited to build Daymark with you!

