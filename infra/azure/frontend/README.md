# Azure frontend migration preparation

Status: **Azure preview provisioned on 18 November 2026**. The shared web plan
and frontend resources described below now exist. Production frontend DNS,
VPS Compose, Caddy and deployment selection are unchanged. The preview still
proxies API/auth to the VPS; this is not the public traffic cutover.

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
isolated rehearsal, infrastructure proposal and gated preview workflow. There is no overlap with
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

`.github/workflows/frontend-azure-checks.yml` repeats the build, rehearsal and
mocked-provider Terraform routing tests on relevant PRs and manual runs. It has
read-only permissions and cannot deploy.

## Concrete hosting/preview proposal

The separate [web-hosting root](../web-hosting/README.md) owns a proposed NEW
Canada East Linux B1 plan shared with auth. This frontend root owns eight
resources: Basic ACR (admin login disabled), a runtime identity and AcrPull
assignment, the frontend app, and a GitHub OIDC identity/federation with AcrPush
on this registry and Website Contributor on this app. No resource group-wide
deployment grant, JWT/DB secret or registry password is required. Existing
CDN/storage/network/auth resources are outside both roots.

Fresh Azure-backed review plans on 18 November show **1 hosting resource and
8 frontend resources to add, zero changes and zero destroys**. Both remote
backends initialized successfully. Terraform validation and all six mocked
routing tests pass. These plans establish intended changes, not actual SKU
placement, registry identity propagation, or a working Azure deployment.

`preview.tfvars.example` uses the existing public VPS app as a temporary
HTTPS origin, plus the actual Azure CDN origin. This is usable for preview
without changing DNS. Terraform rejects plaintext origins, Azure self-proxy
and production-mode upstreams pointing back to `app.gen7fuel.com`.
The initial app image `hub-frontend:bootstrap` is deliberately absent: applying
infrastructure creates an unready empty host until the first image deployment.
Terraform ignores only the deployed image name thereafter, preserving digest
deployments while continuing to own upstream/security settings.

The shared plan plus Basic ACR public retail baseline is about CA$25.58/month
before egress/storage/tax and future database costs; see the hosting review for
measurements, price date and quota limits. Both roots were applied after user
approval. Relay was not provisioned and is no longer planned.

GitHub environment `frontend-production` now has a main-only branch policy and
`AZURE_FRONTEND_CLIENT_ID` from Terraform output. Repository variable
`FRONTEND_AZURE_PREVIEW_ENABLED` is normally false; enable it only for a reviewed
manual deployment after confirming the host, identity roles and upstreams. The
`frontend-azure-preview.yml` workflow runs only by manual dispatch on main with
that variable true. It also requires the live app's routing mode to be preview,
builds and rehearses one image, pushes it using OIDC, resolves its registry
digest, and deploys that digest. It verifies the expected release, SPA/cache
headers, proxied health routes and unauthenticated API rejection. It never
changes DNS, auth routing, Terraform, or the VPS deployment selection.
It cannot be used for production mode; automated production deployment and
rollback selection must be reviewed with the shared VPS workflow at cutover.

### Managed identity helper startup

The first live deployment exposed an App Service classic-container behavior:
the platform probes its own `msiProxy` helper using the app's warmup path.
With `WEBSITE_WARMUP_STATUSES=200`, that helper timed out on port 8081 and Azure
stopped the whole site, even though the frontend container itself was ready.
Use `200,404` to accept the helper's missing application-specific endpoint.
The actual app health check remains `/frontend-health`, and release verification
still requires HTTP 200 and the exact source commit. No auth/TLS setting changes.
See [Azure's warmup response rules](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings).

```sh
terraform -chdir=infra/azure/frontend init -input=false
terraform -chdir=infra/azure/frontend plan -input=false -var-file=preview.tfvars.example -out=review.tfplan
```

## Remaining migration work

1. **Secure an independent VPS origin.** As checked on 18 November, the VPS
   Caddy exposes port 3000 and backend port 5000 is internal. Do not forward
   Azure to public plaintext port 3000: user tokens and uploads need encrypted
   transport. Establish a fixed HTTPS hostname/certificate with the existing
   VPS edge operator, or an agreed private encrypted route. Keep this separate
   from `app.gen7fuel.com`. Using the public app domain as an upstream after
   moving its DNS to Azure creates a routing loop. Verify API, auth and
   WebSocket paths against this origin before a public switch.
2. **Maintain the provisioned hosting.** The reviewed plan and frontend
   resources are provisioned. Existing CDN capacity is
   not reused. No quota request is included. The proposed ACR and runtime
   managed identity avoid registry passwords, and the workflow uses immutable
   image digests. Verify actual role propagation/pulls during preview.
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
