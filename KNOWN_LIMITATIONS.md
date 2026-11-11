# Known limitations

- **No remote sync service:** the default adapter explicitly reports that no endpoint is configured. Outbox work remains local; there is no authentication, server acknowledgement, or cross-device sync.
- **Conflict coverage is client-side:** Vitest uses controlled mock adapter responses and opaque fixture revisions. It does not verify a real server's revision ordering, transport failures, or multi-device behavior.
- **Browser coverage is bounded:** Playwright checks Chromium desktop and mobile viewport profiles. It is not a cross-browser, assistive-technology, native installation, or real-device matrix.
- **Offline startup is warm-cache only:** a production shell cached by the service worker can relaunch offline. The standalone `public/offline.html` is not the Workbox navigation fallback; a first visit with no cached app shell is not guaranteed to work offline.
- **Quota recovery is incomplete:** storage estimates and quota-error detection exist, but there is no consistent user-facing recovery flow for exhausted browser storage. Browser eviction policy varies.
- **Data access boundaries are inconsistent:** `DashboardPage`, `TrashPage`, `ConflictDialog`, and `useData` contain direct Dexie queries. Most business logic is in services, but a service-only UI boundary is not yet achieved.
- **PWA update/install behavior:** the manifest, icons, service-worker generation, and update prompt are configured. Browser install and upgrade behavior can differ by browser and requires manual verification on target platforms.
- **Accessibility is partial:** labels, keyboard interaction, focus handling, and assistive-technology support are not consistently audited.
- **Bundle size:** current production output emits a warning for a JavaScript chunk larger than 500 kB minified. Code splitting has not been applied as part of this audit.
- **Seed content:** a newly created database is populated with demo records. Seed/reset helpers can be destructive if invoked against a populated user database.
- **Backup compatibility:** only the version 1 Daymark JSON format is supported; device-specific sync/conflict metadata is intentionally excluded.
