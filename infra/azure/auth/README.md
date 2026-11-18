# Auth Azure migration preparation

This change prepares a portable auth runtime. Production remains on the VPS;
there is no Azure auth resource, routing cutover, or new secret in this PR.
Merging it rebuilds the existing VPS auth service through the normal workflow.

## Verified dependencies

Auth reads and writes the same MongoDB users, roles, permissions, locations,
maintenance state, and audit collections as Hub. Its JWT secret must match the
main API so existing clients and tokens remain compatible. Endpoint paths and
the next-09:00-UTC token expiration policy are unchanged.

The live VPS runtime inspected on 2026-11-18 uses MongoDB hostname `mongo`,
port 27017, with no published host port. Its URI requests neither credentials
nor TLS; that configuration is intended for the isolated Docker network.
Auth currently mounts shared models and `attachSiteAlias.js` from the Hub repo.
It does not depend on Redis, PostgreSQL, or the scheduled-job container.

The Gen7ERP Azure resource inventory currently has the CDN App Service/plan,
storage, Key Vault and managed identities, with no virtual network or private
database connection. The current MongoDB hostname cannot resolve from an Azure
auth app. This is the remaining infrastructure dependency before a preview.

## Prepared runtime

- `PORT` is honored, with VPS default 5005.
- Startup waits for MongoDB; missing settings or a failed connection fails startup.
- `/login-auth/health` keeps its successful `OK` response and returns 503 when
  MongoDB is disconnected or the process is stopping.
- Startup logs do not print database connection strings.
- Token refresh now requires a valid, unexpired bearer token for the requested
  user and checks current account status and maintenance permissions. The Hub
  frontend now sends that token. Previously the endpoint trusted a user ID
  alone. The existing signing key, JWT claims, and expiry policy are preserved.
- The production Docker command runs Node directly for graceful SIGTERM handling.
- Compatible Express/Mongoose/Morgan and transitive dependency fixes are locked;
  the unused `express-request-id` dependency is removed (request IDs already use
  Node crypto). The production dependency audit passes with zero findings.
  Both runtime images omit development dependencies. The development-only
  nodemon/picomatch finding remains unpatched; no forced downgrade or allowlist
  is used, and this is not a claim that the development audit is clean.
- A manifest-based package includes the seven required shared models and their
  helper, rather than depending on runtime mounts. It excludes environment files,
  local dependencies, unrelated models, tests and operational files.
- Existing VPS bind mounts, routes, credentials and proxy trust policy remain.

Build a fresh source package from the repository root:

```sh
node auth-backend/scripts/package-runtime.cjs /new/empty-destination
```

The destination must not already exist. Install its locked dependencies before
running it. This package can be used for native Node App Service hosting after
database connectivity is established. The separate standalone Dockerfile tests
the same package on Node 24 without shared filesystem mounts:

```sh
cd auth-backend && npm ci && npm test
# From repository root:
docker build -f auth-backend/Dockerfile.standalone -t hub-auth-rehearsal:local .
python3 infra/azure/auth/rehearse.py
docker build -t hub-auth-vps-rehearsal:local auth-backend
python3 infra/azure/auth/rehearse.py --vps
```

The rehearsal has fresh MongoDB, synthetic users/secrets, an internal network,
no published ports and no production credentials. It verifies identify/login,
JWT claims/signature, refresh, inactive-account denial, maintenance denial and
bypass, registration/password hashing, audit writes, custom port, database
outage/recovery readiness and clean shutdown. CI repeats it on PRs.
Refresh tests reject missing, invalid, expired, cross-user, inactive-account,
and maintenance-blocked sessions. After the normal frontend/auth VPS deployment,
older already-open frontend bundles may need a reload to send the new refresh
authorization header; existing valid access tokens continue to work.

## Next infrastructure decision

Choose a secure network path to the existing database or a separately reviewed
database migration before creating an Azure auth app. Do not publish the current
unauthenticated MongoDB listener as a shortcut. App Service VNet integration can
reach external private networks when they are connected through a site-to-site
VPN or ExpressRoute; that networking is not currently provisioned. See
[Microsoft's VNet integration documentation](https://learn.microsoft.com/en-us/azure/app-service/overview-vnet-integration).

After connectivity is proven:

1. Review hosting region/plan capacity and network costs. The current CDN is on
   a Canada East B1 plan; no quota increase or new compute is requested here.
2. Provision an independent auth preview with vault-backed MongoDB/JWT secrets.
   Preserve the existing JWT signing value; do not generate a replacement.
3. Verify database access, audit writes, maintenance rules, and token acceptance
   by the VPS API using controlled identities. Verify client IPs through the
   actual Azure/Caddy proxy chain and restrict preview access appropriately.
4. Prepare auth-specific routing/deployment selection and rollback. Keep the
   browser URL `/login-auth/*`; switch the upstream only after preview checks.
5. Merge/deploy through the normal branch/PR process, retaining the VPS auth
   image as rollback until real logins and token refresh are confirmed.

The paused Azure preview/deployment workflow and cutover are future changes.
This readiness PR does not make a claim that Azure can reach production MongoDB.
