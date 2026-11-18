# Complete Hub, Desk and shared services migration to Azure

The user expanded scope on 18 November 2026 to include the remaining containers,
shared services, integrations, routing and Desk with its database. The outcome
is Hub, Desk and Fleet operating without an application dependency on the VPS.
No Azure Relay is used. This is a preparation plan, not an infrastructure apply
or production cutover. No quota increases or direct pushes to main are allowed.

## Runtime and data map

Targets below are proposed deployment boundaries; SKU, region availability,
resource permissions and full recurring costs need review before provisioning.
Keep existing CDN resources separate from the new shared hosting plan. Do not
pack additional workloads onto the shared B1 without capacity measurements.

| Component | Observed source | Azure destination or preparation decision | Completion check |
| --- | --- | --- | --- |
| Hub CDN | Azure App Service and new Blob account, already serving production | Keep existing deployment and identity | Upload/download/delete, Desk backups and new files continue working |
| Hub frontend | Production VPS Caddy; independent Azure frontend preview provisioned | Existing new App Service frontend, then custom domain/HTTPS cutover | Routes/assets/refresh work without proxying any required path to VPS |
| Hub auth | VPS `auth-backend` | App Service, consume new shared plan only after capacity review; direct Azure Mongo | Real login/refresh/permissions, JWT compatibility, DB outage recovery |
| Hub API | VPS `backend`, `node api.js` | Dedicated web runtime, initially evaluate App Service | HTTP, Socket.IO rooms/events/reconnect, timeouts, health and graceful deployment |
| Hub queue worker | VPS `backend-worker`, `node worker.js` | Always-running Azure Container App, ingress disabled, minimum one replica | Existing BullMQ jobs/delays/retries and email run once per intended attempt; graceful draining |
| Hub scheduler | VPS `backend-scheduler`, `node scheduler.js` | Separate always-running Container App, initially one replica, Redis leader lease | Exactly one active scheduling owner, timezone/DST checked, no overlapping VPS scheduler |
| Hub Mongo | VPS `mongo`, shared with auth/Fleet | Atlas on Azure, preserve `main` | Coordinated Hub/auth/Fleet connection rollout and native restore validation |
| Hub PostgreSQL | VPS `postgres`, `hub_sql` | PostgreSQL Flexible Server 16 | Schemas/data/constraints/sequences/roles/migration history validated |
| Hub Redis | VPS `redis`, BullMQ plus caches | Evaluate Azure Managed Redis with a BullMQ-compatible configuration | TLS/auth, scripts/commands/key placement, no-eviction policy, persistence and queue migration proven |
| Shared email | VPS local-only email-service image, Hub and Desk consumers | First package/publish reproducible image; evaluate internal Container App retaining current mail transport | Both apps send controlled test mail; retries preserved, no unintended test deliveries |
| Public edge | Host Caddy and Hub/Desk Caddy containers | Azure app ingress/custom domains/certificates; evaluate shared gateway only if routing requires it | All public paths, headers, WebSocket upgrades and certificates validated; no VPS upstream |
| Fleet Portal | VPS `fleet-portal`, shared Hub Mongo | Include runtime packaging and Azure web hosting, not only Mongo URI change | Portal flows/auth work against Azure Mongo; no private Docker IP dependency |
| Desk frontend | VPS `desk-caddy`, Caddy frontend image | Azure web hosting with Desk domain and SPA behavior | Hub-facing pages, authentication, downloads and deep links work |
| Desk API | VPS `desk-api`, `node index.js` | Azure web runtime after DB/files/integration preparation | Desk flows, Hub external-token exchange and Sage integrations verified |
| Desk Mongo | VPS `desk-db-1`, Mongo 8.0.15 `desk` | Separate database/access boundary on Azure-hosted MongoDB | Native restore and application-level checks independent of Hub cutover |
| Desk CDN backup | VPS `desk-cdn-backup`, `node apps/cdn/cdn.backup-worker.js` | Dedicated background runtime; initially preserve its scheduler and command | One scheduled owner, source new Azure media account, destination archives preserved |
| Desk POS files | API mounts `/pos/data` and `/pos/archive` | Decide Azure Files mount versus Blob-adapted ingestion after file-operation audit | Inbound feed, parsing, archive moves and restart recovery tested |
| SFTP/FTP and local tools | External store SFTP, office proxy, VPS FTP and host scripts | Inventory each endpoint; move owned server/receiver to appropriate Azure runtime/storage | Uploaders/allowlists/DNS/keys and downstream schedules work without VPS |
| Deployment/security | GitHub workflows, environment secrets, SSH-based VPS deployment | Separate Azure workflows with OIDC/scoped identities and environment protections | Normal branch-to-PR-to-main merge deploys correct service with health gate/rollback |
| Backup/operations | Native host scripts, application exports and Blob archives | Azure-native scheduled backup/export jobs, retention, monitoring and restore receipts | Restore rehearsed for all stores; alerts reach an owned destination |

An Azure Container App is the proposed fit for continuous queue/scheduler
processes. Do not turn the existing long-running cron entry point into a finite
scheduled job unchanged. Retain current scheduling code first; moving individual
tasks to managed scheduled jobs is a later refactor. Minimum replicas prevent
scale-to-zero for continuous processes; single-revision handover and the leader
lease still need testing, since replica count alone does not prevent overlap.
References: [background workloads](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs),
[Container Apps scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app).

Redis is production work storage, not just disposable cache. Validate BullMQ's
Lua/script/transaction and clustering requirements against the selected managed
configuration before choosing it. Retain a single compatible Redis-on-Azure-VM
alternative if managed compatibility or pricing is unsuitable; no silent queue
recreation or cache-only migration. Review persistence, eviction, restore/export
and delayed/failed/active job handling explicitly. Persistence alone is not a
point-in-time backup or an exactly-once guarantee. See [Managed Redis persistence](https://learn.microsoft.com/en-us/azure/redis/how-to-persistence).

## Verified Desk inventory and correction

The previous response described Desk's database as PostgreSQL. That was incorrect.
Live inspection on 18 November confirms `desk-db-1` uses MongoDB 8.0.15, `desk`,
29 collections and 3,580,595 logical data bytes, with no replica-set name.
`desk-api` and `desk-caddy` were healthy with restart count zero; the dedicated
backup process had restart count zero and no Docker healthcheck. Running images
were `eed3b8a2c74ce3bb1b3bff1ec7971ef03721eb09`. Counts are live observations,
not a consistent backup. The API has writable POS data/archive mounts; the
backup worker has no filesystem mount in the inspected runtime.

## Migration waves and dependencies

1. **Inventory and connection readiness:** finish endpoints, writers, external
   allowlists, host scripts, filesystem usage, credentials and deployment owners.
   Inventory Desk's own schedules/side effects before assuming its API is safe
   to run in multiple replicas. Establish baseline availability/latency/resource
   usage. Produce per-service costs and capacity checks without quota requests.
2. **Databases:** execute the [database preparation/rehearsal plan](azure-databases.md).
   Migrate Hub PostgreSQL, shared Hub Mongo and Desk Mongo in separate rehearsed
   windows. VPS clients initially use direct authenticated TLS with narrow egress
   allowlists; no Relay. Keep database isolation and secret ownership explicit.
3. **Web runtimes:** cut over Hub auth/API, Fleet and Desk web/API after their
   Azure dependencies pass isolated tests. Coordinate Socket.IO scaling/session
   behavior and Desk-to-Hub external tokens. Verify frontend production routing;
   the current Azure frontend preview still proxies VPS API/auth paths.
4. **Queues and background services:** choose a Redis migration method proven
   compatible with the selected target. Quiesce producers and drain/pause workers
   under recorded pause state, preserve queue/delay state, switch all Redis clients
   together, then hand over workers and scheduler. Keep leader lease and Pub/Sub
   delivery consistent; do not run old/new schedulers against independent Redis
   stores. Move Desk backup scheduling with one owner and verify its next run.
5. **Mail, files and integrations:** move the email service, POS feed/storage,
   owned FTP/SFTP receivers/proxies, native backup/export jobs and remaining host
   tools. Identify access to external MSSQL/Azure SQL, Sage, store SFTP and office
   network services; those systems can remain external, but their path cannot
   depend on this VPS. Validate any Puppeteer/browser automation, OS packages,
   writable temp paths and outbound-IP allowlists on the chosen Azure runtime.
6. **Edge and operations:** finalize custom domains, TLS, path routing and DNS
   cutover/rollback; preserve required CORS/cookies/proxy trust/client IP handling.
   Verify secrets/managed identities, alerting, logs, health/readiness, restart
   behavior, least-privilege access and native restore procedures.
7. **Dependency exit:** observe full overnight/daily cycles, including the 11 AM
   job and 2 AM Toronto Desk backup. Check DNS/upstreams, runtime settings and
   host access logs for remaining VPS calls. After a rehearsed rollback window,
   disable only migrated services, retain protected recovery copies and remove
   obsolete deploy credentials. Do not delete the VPS as a shortcut.

Waves can overlap in preparation, but dependency gates control activation. All
rehearsal apps must fence real mail, accounting writes, file ingestion, schedules
and queue side effects. Preserve original queue pause states during handover.
Callback completion markers do not establish all asynchronous cron work drained.

## What "finished" means

Hub, Desk and Fleet traffic and background work use Azure runtimes and data
stores; deployments use reviewed GitHub merges; app operation and recovery do
not require the VPS Caddy, Docker network, Redis, Mongo, PostgreSQL, email, POS
mounts or host scripts. All expected scheduled cycles and representative user
flows are verified. A service preview or an HTTP 200 alone does not establish
that outcome. Record recovery time and data-loss boundaries from rehearsals,
especially once the destination has accepted new writes.

Docmost, n8n, Wekan and other independent VPS applications are not implicitly
included. Their existence prevents whole-server shutdown even after this scope
is finished. Explicitly inventory/decide their ownership before a VPS retirement
proposal. The owned FTP feed is included where it supports Hub/Desk operations.

Current state: scope and proposed boundaries prepared. CDN already migrated;
frontend Azure resources provisioned independently. Remaining targets are not
provisioned by this document. No live cutover, new paid resource, DNS edit,
database copy or shutdown is authorized merely by merging this plan.
