# Azure frontend migration preparation

Status: **runtime prepared; not deployed to Azure**. Production frontend, DNS,
VPS Compose, Caddy and deployment workflow are unchanged. This preparation does
not create billable resources or enable an automatic deployment target.

The frontend can migrate separately from auth. The Azure frontend must serve
both the static SPA and its existing same-origin service paths; changing only
the static-file host would break relative API calls. Use Linux App Service with
the new `frontend/Dockerfile.azure` image. Caddy listens on port **8080** behind
Azure TLS termination. The existing `frontend/Dockerfile` remains the VPS build.

## Runtime contract

All four upstream environment variables are required. Values are a single
origin (scheme and host/port, without a path). Use HTTPS with certificate
verification for public origins. HTTP in the rehearsal is only for disposable
fixtures on its dedicated Docker network.

| App setting | Routes | Initial production destination |
| --- | --- | --- |
| `HUB_API_UPSTREAM` | `/api`, `/api/*`, `/socket.io`, `/socket.io/*` | Fixed, independently secured VPS origin |
| `HUB_AUTH_UPSTREAM` | `/login-auth`, `/login-auth/*` | Fixed VPS origin until separate auth cutover |
| `HUB_CDN_UPSTREAM` | `/cdn`, `/cdn/*` | Existing Azure CDN App Service HTTPS origin |
| `HUB_SIGNALING_UPSTREAM` | `/signaling`, `/signaling/*` | Fixed VPS origin; confirm signaling is actually available |
| `WEBSITES_PORT` | Azure routing to the container | `8080` (classic custom-container hosting) |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | Container storage | `false`; assets are immutable image content |

For App Service's newer sidecar container configuration, set the main
container's target port to 8080 instead of relying on `WEBSITES_PORT`.
Use `/frontend-health` for health checks; it checks the frontend listener only,
not MongoDB, API, auth, or CDN availability. Enable HTTPS-only/minimum TLS 1.2,
disable FTP/basic publishing credentials, and retain container logs.

The image does not need JWT signing keys, MongoDB credentials, or CDN admin
tokens. It forwards browser authorization and request bodies to the selected
upstream. It preserves service paths, queries, Origin headers, upstream errors,
WebSocket upgrades, HEAD responses and byte ranges. Public upstream Host/SNI
must match the upstream certificate. Static deep links use `index.html`; service
errors and missing code chunks never become a successful SPA response. App shell,
version metadata and service worker files use `Cache-Control: no-store`.

## Coordination with auth migration

Auth PR #973 was merged as `c3c6c7e62b49de1845af794941c9bad47fbd152f` while
this work was being prepared. This branch includes that base, including the
frontend's existing Bearer token on refresh. No auth service files are edited.
The auth migration session owns auth packaging/networking and any shared
production routing/deployment changes. Its current `/login-auth/*` route and
JWT format remain the contract. Do not switch frontend and auth traffic in one
unverified step. Agree on upstream settings before either production cutover.

Frontend changes here are additive: the Azure Dockerfile, its own Caddyfile,
isolated rehearsal, and a checks-only GitHub workflow. There is no overlap with
the existing root Caddyfile, Compose, `main.yml`, or auth service source.

## Local verification

From the repository root:

```sh
docker build -f frontend/Dockerfile.azure --build-arg RELEASE_COMMIT=local -t hub-frontend-azure:local frontend
python infra/azure/frontend/rehearse.py
```

The build runs the existing Vite/TypeScript production build on Node 24.
The rehearsal runs the actual built Caddy image against four synthetic upstreams
and checks SPA reloads/update caching, distinct route destinations, query and
Bearer/Origin preservation, upstream 404/503 responses, multipart/base64 upload
bodies, HEAD, video-style byte ranges and bidirectional WebSocket frames for
Socket.IO/signaling. Fixtures cannot exercise a real Socket.IO login/session,
Azure TLS/IAM, load balancing, real CDN uploads, or production data.
It creates uniquely named local containers/network, publishes only to loopback,
and removes its own containers/network on exit. It makes no production calls.

`.github/workflows/frontend-azure-checks.yml` repeats the build and rehearsal
on relevant PRs and manual runs. It has read-only permissions and cannot deploy.

## Remaining migration work

1. **Secure an independent VPS origin.** As checked on 18 November, the VPS
   Caddy exposes port 3000 and backend port 5000 is internal. Do not forward
   Azure to public plaintext port 3000: user tokens and uploads need encrypted
   transport. Establish a fixed HTTPS hostname/certificate with the existing
   VPS edge operator, or an agreed private encrypted route. Keep this separate
   from `app.gen7fuel.com`. Using the public app domain as an upstream after
   moving its DNS to Azure creates a routing loop. Verify API, auth and
   WebSocket paths against this origin before a public switch.
2. **Choose/size the Azure host and registry.** The existing CDN B1 plan is in
   Canada East. A second app can share that plan's compute, but frontend proxy
   bandwidth and concurrent video/uploads then compete with CDN work. Inspect
   measured CPU/memory first; agree with the auth session before sharing it.
   Alternatively review a separate plan's current cost/quota. No quota request
   or new plan is included here. Use an immutable image digest and authenticated
   registry pulls (prefer managed identity with ACR); do not place registry
   passwords in Git or Terraform state.
3. **Preview without public DNS changes.** Provision the reviewed host and
   deploy an image built from the merged main commit. Configure the four
   upstreams, port/health/TLS and registry identity. Use a frontend-specific
   deployment identity/environment. Inspect actual frontend release metadata,
   health, deep-link reloads and cache headers on its Azure URL.
4. **Verify real browser flows.** Backend Socket.IO currently allows the public
   app/Desk/local origins. A preview hostname needs an explicitly agreed temporary
   origin or controlled host mapping; do not replace every browser Origin header
   at the proxy to bypass this restriction. Test login, authenticated API/refresh,
   real socket authentication/reconnect, uploads, CDN/video seeking, offline/PWA
   updates and client-IP audit logging through Azure plus VPS. Use isolated
   test files and remove only those files. Verify upstream outage behavior.
5. **Prepare coordinated deployment and rollback.** Disable VPS frontend asset
   publication only after the Azure path and its deployment workflow are ready;
   backend/auth/CDN deploys must continue independently. Preserve previous
   immutable chunks for open tabs at cutover, record image/source/old DNS, and
   keep VPS static assets ready. Validate a managed certificate for the real app
   domain, then switch DNS as a separate reviewed action. Keep existing browser
   origin and JWT storage intact. Watch real login/API/socket/upload traffic.
   Rollback changes only the frontend domain/target to the retained VPS release;
   coordinate any auth upstream rollback separately.

## References

- [Azure custom-container configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?pivots=container-linux)
- [App Service container settings](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings)
- [App Service sidecar target ports](https://learn.microsoft.com/en-us/azure/app-service/configure-sidecar)
- [Sharing App Service plans and capacity](https://learn.microsoft.com/en-us/azure/app-service/overview-hosting-plans)
- [Caddy reverse proxy, HTTPS upstreams and WebSockets](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
