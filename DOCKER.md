# Docker setup

Daymark is a static PWA. The production container builds the Vite app with the repository's pinned Bun lockfile and serves `dist/` using Nginx with SPA routing, PWA asset caching, and no-cache headers for the service worker and manifest.

## Production-style local run

Requirements: Docker Engine and the Docker Compose v2 plugin.

```powershell
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`. The Compose service binds to loopback on the host. Stop it with:

```powershell
docker compose down
```

No application database is stored in this container. Notes, tasks, preferences, and other user data remain in IndexedDB for the browser origin where Daymark is opened. Browser data at `http://localhost:3000` and `http://localhost:8080` uses different origins and is not shared. Use the in-app backup to move data deliberately.

## Development server

```powershell
docker compose --profile dev up --build daymark-dev
```

Open `http://localhost:3000`. The repository is bind-mounted for live editing; dependencies use the named `daymark_node_modules` volume so Windows host modules are not mounted into the Linux container. After changing dependencies or `bun.lock`, rebuild the image and recreate that volume deliberately:

```powershell
docker compose --profile dev down
docker compose --profile dev build daymark-dev
docker compose --profile dev up daymark-dev
```

If the dependency volume still contains the old install after a lockfile change, remove only the Compose dependency volume with `docker compose --profile dev down -v`, then rebuild and start again. This volume contains `node_modules`, not Daymark user records.

This development service runs Vite with the existing project script and service-worker development configuration.

## Production hosting notes

- The Nginx image serves the app at `/`; subpath hosting is not configured.
- Put a TLS reverse proxy or HTTPS-capable host in front of the container for production. Service workers and installability require a secure context (localhost is an exception).
- `compose.yaml` publishes the container port on `127.0.0.1` for local use. Change exposure only as part of a deliberate hosting/network design.
- Nginx falls back to `index.html` for client routes and returns 404 for `/api`, because this repository has no backend.
- Service worker, web manifest, and unhashed root assets are revalidated; Vite's content-hashed `/assets/` files are served immutable.
- Container availability does not provide user-data persistence, authentication, remote synchronization, or backups. Local user data remains subject to browser storage limits and eviction.

## Verification

The Docker setup could not be built or started in the current development environment because Docker Engine/Compose was not detected. Once Docker is available, verify with `docker compose config`, `docker compose build`, `docker compose up -d`, `docker compose ps`, and the browser checks in [offline testing](OFFLINE_TESTING.md). Do not treat a successful image build as proof of browser installability or offline behavior.
