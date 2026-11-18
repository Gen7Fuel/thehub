# Direct Azure database migration preparation

Decision, 18 November 2026: avoid Azure Relay entirely. Move databases before
moving auth. Production sources remain authoritative throughout preparation;
this change creates no paid database resources and changes no live connection.
The independent frontend preview can proceed while still proxying the VPS API
and auth routes. The new shared App Service plan is not a database host.

Scope expanded by the user: this is part of the [complete Hub, Desk and shared
services migration](azure-platform-migration.md), including remaining containers,
queues, routing, integrations and recovery. The database work is the first phase,
not the whole migration.

## Proposed targets

| Source | Proposed destination | Compatibility boundary |
| --- | --- | --- |
| MongoDB 8.0.15, `main` | MongoDB Atlas on Microsoft Azure, MongoDB 8-compatible dedicated cluster; evaluate Canada East first | Actual MongoDB, preserving BSON, collection options and indexes. Validate exact version, region, tier, availability and cost before provisioning. |
| PostgreSQL 16.11, `hub_sql` | Azure Database for PostgreSQL Flexible Server, major version 16; evaluate Canada East first | Preserve schema, data, constraints, sequences, migration history and application privileges. Choose tier from workload measurements, not database size alone. |
| Desk MongoDB 8.0.15, `desk` | Separate logical database and credentials on an Azure-hosted MongoDB target | Preserve isolation from Hub; evaluate shared Atlas cluster capacity and privileges before deciding placement. |

Atlas is a separate managed MongoDB service hosted on Azure and needs an Atlas
organization/project and billing/API access. It is not Azure Blob Storage or a
Mongo-compatible Cosmos DB substitution. Azure-native Mongo-compatible products
would require a separate feature/query compatibility assessment. No Atlas
account, supported target tier/version or subscription purchase is established
yet. A self-managed MongoDB Azure VM is an alternative if Atlas procurement is
unsuitable, but adds patching, replica-set operations and recovery ownership.

References: [Atlas Azure regions](https://www.mongodb.com/docs/atlas/reference/microsoft-azure/),
[PostgreSQL networking](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-public),
[PostgreSQL TLS](https://learn.microsoft.com/en-us/azure/postgresql/security/security-tls).

## Current evidence and scope

Read-only live inspection on 18 November 2026 (rounded decimal MB):

| Store | Observed metadata | Consequence |
| --- | --- | --- |
| MongoDB `main` | 71 collections; 253,317,197 data bytes, 69,353,472 storage bytes, 50,044,928 index bytes; standalone, no replica set | Do not assume change streams, oplog replay or online synchronization are available. |
| PostgreSQL `hub_sql` | 37,958,115 database bytes; 13 user tables; `plpgsql` only; WAL level `replica`; primary | Logical replication is not enabled. Start with native dump/restore rehearsal; do not change WAL settings during preparation. |

Consumers that must be updated together at each respective database cutover:

| Consumer | MongoDB | Hub PostgreSQL | Current location |
| --- | --- | --- | --- |
| Hub API | `MONGO_URI` | `POSTGRES_*` | VPS `backend` |
| Hub worker | `MONGO_URI` | `POSTGRES_*` | VPS `backend-worker` |
| Hub scheduler | `MONGO_URI` | `POSTGRES_*` | VPS `backend-scheduler` |
| Auth | `MONGO_URI` | None | VPS `auth-backend` |
| Fleet Portal | `MONGO_URI`, currently hard-coded private IP in runtime configuration | None | VPS `fleet-portal` |

Desk uses **MongoDB, not PostgreSQL**. Live inspection of `desk-db-1` confirms
MongoDB 8.0.15, standalone database `desk`: 29 collections, 3,580,595 data bytes,
4,132,864 storage bytes and 1,167,360 index bytes. Desk API and any scheduled/
backup process that uses its models need their own connection rollout and restore
test. Do not merge Hub and Desk data or reuse unrestricted credentials. Desk is
now in scope, with its own migration window. The prior PostgreSQL image filter
missed it because it is MongoDB. Docmost, n8n and Wekan remain unrelated stores.
Redis stays on the VPS during this first database phase but is included in the
complete platform migration. Moving these databases alone does not remove API
dependencies on Redis, email, SFTP or other services.

`Microsoft.DBforPostgreSQL`, `Microsoft.Compute` and `Microsoft.Network` are
registered. `Microsoft.DocumentDB` and `Microsoft.Relay` are not. Registration
does not prove create permissions, regional capacity, quota or SKU eligibility.
Do not request quota increases or broaden roles. Recheck permissions/capacity
read-only before proposing a concrete paid resource plan.

## Connectivity without a bridge

During the transition, VPS services connect directly to the Azure database
FQDNs using database authentication and verified TLS. Allow only the verified
VPS outbound IP and the required App Service outbound IP set. Verify actual
egress rather than assuming inbound DNS gives the outbound IP. Do not use an
all-internet rule or PostgreSQL's broad "allow Azure services" rule. Atlas
network access lists must be equally narrow. No database port is opened on the
VPS, no Relay namespace is needed, and no VPN/HCM agent is installed.

This uses encrypted public endpoints during the transition; it is not private
network connectivity. When the last consumer moves to Azure, assess App Service
VNet integration, private endpoints, Atlas tier support and private DNS, then
remove public access. Private-only databases while Fleet/VPS clients remain
would still require a network path; do not promise that without designing one.

Use separate least-privilege runtime credentials, privileged migration credentials
only for the operator, and secret storage outside Git/Terraform output. Review
App Service possible outbound IPs on plan changes before deployment. Test denied
IP, wrong credentials, wrong CA and hostname verification as well as successful
connections. Never disable certificate verification to get a connection working.

## Required connection preparation before cutover

1. Hub Compose currently fixes `POSTGRES_HOST=postgres` and port 5432. Parameterize
   the runtime host/port with current defaults for all three roles, export them
   in the deployment workflow, and add verified TLS/CA configuration. Preserve
   local database service configuration separately from cloud runtime credentials.
2. `backend/config/pg.js` currently uses `rejectUnauthorized:false` when TLS is
   enabled; `DATABASE_URL` bypasses that branch. Replace this with a single
   fail-closed connection builder and tests for URL and discrete-variable paths,
   CA handling, hostname checks and invalid configuration. This design PR does
   not silently alter production TLS behavior.
3. Preserve `MONGO_URI` as the Mongo configuration contract. Test authenticated
   TLS/SRV Atlas connections with the actual Hub, auth and Fleet driver versions,
   startup readiness, reconnect and graceful shutdown. Remove URI credential
   logging wherever present, including tools and backup scripts.
4. Inventory host-native backup/export scripts, manual tools, deployment-time
   migrations and less obvious writers. Update their endpoints and privileges.
   A stopped HTTP API alone does not fence worker, cron, Fleet or operator writes.
5. Keep GitHub branch/PR deployments. No direct main pushes, live database URI
   secret changes, or cloud infrastructure apply as part of preparation.

## Rehearsal and cutover sequence

1. Produce a concrete target SKU/storage/backup/retention/network plan and current
   monthly estimate separately for Atlas and PostgreSQL. Include backup storage,
   network transfer and any private networking. The old Relay estimate is removed;
   the frontend/shared-plan spend already approved is independent. Do not infer
   database provisioning approval from approval of the former temporary bridge.
2. Build isolated targets. Native `mongodump`/`mongorestore` and `pg_dump`/
   `pg_restore` rehearsal must preserve metadata and indexes, not just CSV data.
   Encrypt artifacts, restrict access, keep secrets out of arguments/logs and
   record checksums privately. Never restore over the live source.
3. Measure end-to-end export, upload, restore, validation and restart time. A live
   rehearsal snapshot is not the final consistent copy. Compare per-collection/
   table counts, indexes, constraints, sequences, extensions and migration state;
   keep identifiers and records private. Restore roles/ownership using a mapping
   compatible with managed PostgreSQL, which does not provide host superuser.
4. Run previews against the isolated targets: positive and negative login/refresh,
   API permissions, representative PostgreSQL reads/writes and Fleet behavior.
   Fence email, external API calls, schedules and queues in previews. Never start
   a second set of production workers against a rehearsal database.
5. PostgreSQL can move first, then MongoDB/auth/Fleet, as separately rehearsed
   windows. Before each final dump, stop/fence all writers for that store and
   verify active operations have finished. Existing cron wrappers sometimes
   launch asynchronous work without awaiting it; a wrapper completion marker
   alone is insufficient. Preserve BullMQ pause states and delayed jobs.
6. With the source quiesced, make the final consistent native copy, restore and
   validate. Switch every consumer of that store to the new authenticated TLS
   endpoint while writes remain fenced. Do not dual-write. Re-enable writes only
   after the coordinated connection and smoke checks pass.
7. Once MongoDB works from the VPS clients, deploy Azure auth directly against
   Azure MongoDB, rehearse its route, then switch auth routing. No Relay needed.
   Retain the VPS source and recovery artifacts for an agreed retention period.

The source is currently standalone MongoDB: do not use `mongodump --oplog` as if
it were a replica set. A consistent final copy requires writer quiescence or a
separately designed replication migration. No downtime duration is promised
until the rehearsal is measured. See [mongodump consistency requirements](https://www.mongodb.com/docs/database-tools/mongodump/).

## Rollback boundary

Before destination writes are enabled, a failed validation can revert all
consumers to the unchanged VPS source and resume the original writers. Record
the previous configuration securely and verify all consumers agree.

After destination writes begin, the VPS copy is stale. A blind connection-string
rollback would discard new data. Stop writers, preserve destination data, then
choose forward repair or a rehearsed reverse transfer/reconciliation before
resuming. Database rollback is therefore different from switching a stateless
CDN app. Keep one authoritative database per store at all times.

Preparation status: targets proposed, live metadata and consumers inspected,
Relay activation blocked by default. No paid database resource, native dump,
restore, connection secret update, writer pause or live cutover performed.
