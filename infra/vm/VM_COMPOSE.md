# Hub on the Azure VM

`compose.vm.yaml` defines an independent Hub project for the VM. It reuses API,
auth, worker, scheduler and database settings from `compose.yaml`. Caddy inside
the standalone frontend image serves the SPA and forwards `/api`, `/login-auth`
and `/socket.io` to the corresponding Docker services. `/cdn` goes directly to
the production Azure CDN.
The VM frontend returns 404 for `/signaling` until a supported upstream is ready.
The host edge connects to the frontend at `127.0.0.1:3000` by default.

## Host setup

- Prepare the managed data disk and install the host's Docker mount guard before
  starting the project. Set `GEN7_DATA_ROOT` to that mount, normally `/mnt/gen7-data`,
  and prepare its `hub/mongo`, `hub/postgres` and `hub/redis` directories. Compose
  refuses to create these bind source directories. The host guard must verify the
  actual mount before Docker starts, including after reboot, because the VM
  containers use Docker's `unless-stopped` restart policy.
- Supply the Hub runtime environment using a protected environment file. Set
  `BACKEND_IMAGE`, `AUTH_BACKEND_IMAGE` and `HUB_FRONTEND_IMAGE` to approved release
  images by digest. Use `thehub-auth-backend-vm` for auth. It includes the shared
  models and helper from the same revision. The **Publish Hub frontend VM image** workflow builds
  `frontend/Dockerfile.azure`, validates the image, and records a GHCR digest for
  `HUB_FRONTEND_IMAGE`. Run it from `main`. To publish a rollback candidate,
  supply the reviewed earlier commit's full SHA in `source_commit` and verify its
  digest before starting the drill.
- Set `MONGO_URI` to the intended Hub database on service `mongo` and `REDIS_URL`
  to service `redis`. Supply the existing PostgreSQL, auth and integration
  settings. PostgreSQL uses service `postgres` on the Compose network. The CDN
  upstream defaults to the existing Azure CDN. For isolated rehearsal, use a
  local fixture for `HUB_CDN_UPSTREAM` and block access to production endpoints.
- Set `HUB_VM_HTTP_PORT` only if the host edge uses a port other than `3000`. The
  frontend listener is bound to loopback and the data ports stay inside Docker.

## Checks and frontend release

Run these from the Hub repository root after host setup and deployment approval.
`config --quiet` validates the model without printing runtime secrets.

```sh
docker compose -f compose.vm.yaml config --quiet
docker compose -f compose.vm.yaml up -d --wait
curl -fsS http://127.0.0.1:3000/frontend-health
```

Pin `HUB_FRONTEND_IMAGE` to the desired release before applying a frontend-only
update. The same command can use the previous digest for rollback.

```sh
docker compose -f compose.vm.yaml pull frontend
docker compose -f compose.vm.yaml up -d --no-deps --wait frontend
```

Verify the app release and its API, auth and Socket.IO routing with isolated
fixtures, including a frontend-only redeploy that preserves the API, worker and
scheduler container IDs. Protect synthetic rehearsal networks from production
and external integrations because the worker and scheduler run their usual jobs.
Rehearse disk-backed startup and replacement-host recovery separately.

See [Azure releases for Hub and Desk](AZURE_RELEASE.md) for build-only publishing,
GitHub identity, the host dispatcher and the production activation boundary.
