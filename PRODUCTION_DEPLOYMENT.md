# Production deployment

Daymark builds to static assets in `dist/` and has no required application server or API. Use a static host that supports HTTPS and single-page application routing.

## Build

```powershell
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

Publish the contents of `dist/` at the application's configured base path. The current Vite and PWA configuration assumes the site is mounted at `/`; a subpath deployment requires coordinated Vite base, manifest, service-worker scope, and router changes, followed by browser verification.

## Docker option

The root `Dockerfile`, `compose.yaml`, and `nginx.conf` provide a multi-stage static production image. Run `docker compose up --build -d` and browse to `http://localhost:8080` for a local production-style check. The service binds to loopback. Use an HTTPS-capable reverse proxy for an externally reachable production deployment. See [Docker setup](DOCKER.md) for the optional Vite development container and browser-origin data behavior.

## Hosting requirements

- Serve `index.html` as the SPA fallback for application routes such as `/notes` and `/tasks`.
- Serve generated service-worker, Workbox, manifest, JavaScript, CSS, and icon files at their generated paths and correct MIME types.
- Enable HTTPS. Service-worker registration and installability require a secure context (localhost is the development exception).
- Do not block or rewrite service-worker requests. Ensure the worker remains in scope for the app routes.
- Avoid a long-lived immutable cache policy on `index.html`, `sw.js`, or the web manifest. Content-hashed build assets can use long-lived immutable caching.
- Keep the configured app-shell navigation fallback available. `public/offline.html` is not currently used as that fallback.

## Release checks

Preview the exact build with `bun run preview` and run `bun run test:e2e`. Then verify install prompts, update activation, offline reload, and storage behavior in the target browsers. Deployments do not provide remote sync: the current V1 adapter remains unconfigured on every host. Back up local records before users switch devices or clear browser storage.
