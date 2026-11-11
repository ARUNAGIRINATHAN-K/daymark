# Offline testing

Daymark stores entities in the browser's `DaymarkDB` IndexedDB database. CRUD services do not require the network; the Workbox service worker provides a warm-cache application shell. Offline behavior depends on the app having been loaded online at least once so its shell assets can be cached.

## Manual browser check

1. Build and serve the production app over localhost or HTTPS. Service workers require a secure context; localhost is treated as secure.
2. Open the app online, wait for the service worker to register, then reload once so the page is controlled by it.
3. Create and edit a note and task. Visit search and confirm the local records appear.
4. Use browser DevTools to switch the page to Offline. Reload and confirm the warmed shell opens and saved records remain visible.
5. Close and reopen the tab while still offline, then check the same records.
6. Return online and inspect Settings for storage estimates. The app has a quota detection/estimate utility, but browser-specific quota exhaustion recovery is not fully implemented or verified.

Do not clear site storage during this check: that destroys the local database and service-worker cache. `public/offline.html` exists but is not configured as the navigation fallback. A cold first launch without cached assets is therefore not guaranteed offline.

## Automated coverage

`bun run test` checks offline service behavior with `fake-indexeddb`. `bun run test:e2e` checks production-shell reload and local task/note persistence while Chromium is offline at both supported viewport profiles. These checks do not emulate every browser's storage eviction, quota limits, install UX, or operating-system process termination. Report any scenario not run as unverified.
