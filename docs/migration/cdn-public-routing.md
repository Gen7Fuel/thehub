# CDN public routing and deployment preparation

Prepared and rehearsed 17 November 2026. Code changes are local, not published or
deployed. No GitHub settings, production routing, writer controls, running
application environments or backup configuration were changed.

Public URLs remain `https://app.gen7fuel.com/cdn/...`. Caddy preserves the full
path and proxies to `CDN_PUBLIC_UPSTREAM`, default `cdn:5001`. The upstream Host
header uses Caddy's upstream host/port, required for Azure App Service routing.
TLS certificate verification remains enabled. This does not alter client-facing
URLs. There is no automatic fallback between storage accounts or writers.

Normal deployments derive the Caddy environment from persistent VPS state at
`/home/gen7fuel/.hub-cdn-routing.json`, outside the Git checkout. The state must
contain `{"version":1,"target":"azure"}` (or `legacy` / `standby`). The read-only
`infra/azure/cdn/scripts/routing-plan.py` emits only allowlisted environment
values and checks agreement with GitHub's deployment target and caller secret:

| State target | GitHub variable `CDN_DEPLOY_TARGET` | GitHub secret `CDN_SERVICE_URL` | Caddy upstream |
| --- | --- | --- | --- |
| `legacy` or absent | `vps` or unset | Empty or `http://cdn:5001` | `cdn:5001` |
| `azure` | `azure` | `https://gen7erp-cdn-prod-29b24248.azurewebsites.net` | Same HTTPS URL |
| `standby` | **`azure`** | `http://cdn-rollback-vps:5001` | `cdn-rollback-vps:5001` |

Keep `CDN_DEPLOY_TARGET=azure` during same-storage standby recovery: setting it
to `vps` could rebuild/recreate the original old-storage CDN. Managed deployment
with missing/invalid state, contradictory settings or endpoint changes without a
planned backend deployment fails before service updates. Runtime backend config
is inspected in memory without printing credentials. Missing state permits only
legacy settings; protect the state file as operational configuration and do not
delete it after cutover.

The workflow exports the optional GitHub Secret `CDN_SERVICE_URL` into Compose.
Setting a secret alone does not update a running container. Backend workers need
the new environment, and Caddy needs its new upstream environment. The workflow
recreates Caddy when Compose detects environment changes and otherwise hot
reloads the configuration. **Expect a brief public edge interruption on Caddy
recreation**, affecting API/frontend traffic too; this was not measured against
production. Updating the checked-in Caddy template alone is not a cutover.
The first deployment of this new Compose environment can also recreate Caddy.

## Freeze and coordinate before a future cutover

Do not set secrets yet. The following is an operator sequence, not an automated
cutover performed by the preparation scripts:

1. Publish reviewed preparation code with `[skip ci]`; deliberately deploy the
   backend support while still on legacy routing/settings. Confirm the deployed
   release before proceeding. First reconcile any unrelated work and remote
   changes; the current Hub working tree includes earlier migration preparation.
2. Set repository variable `CDN_MIGRATION_FREEZE=true`. Updated Hub VPS, Azure
   and media-copy jobs honor this gate. It is not an immediate cancellation of
   in-flight runs; drain/cancel and verify all deployment/copy runs, including
   any earlier versions without these guards. Desk's deployment is separate and
   also needs to remain idle during its backup/configuration transition.
3. On the VPS, hold `flock` on `/home/gen7fuel/.hub-deploy.lock` while preparing
   the manual switch. Normal updated VPS deployments acquire that same lock.
   Create `/home/gen7fuel/.hub-cdn-deploy-freeze` to block stale queued updated
   VPS runs independently of their GitHub variable snapshot. The marker is
   checked before Git pull and again before Caddy changes. No lock/marker/state
   was created by this preparation.
4. Verify backup reader access, pause/drain the old writer, finish and verify
   the frozen delta, and coordinate a verified backup. Review upload workers and
   clients that may still use the directly exposed VPS port 5001. Public Caddy
   routing does not intercept direct-port access; fence the original writer.
5. Explicitly tell the user when to set **Hub** `CDN_SERVICE_URL` to Azure and
   `CDN_DEPLOY_TARGET=azure`, and when to set the separately documented **Desk**
   backup-source secrets. Coordinate their actual container updates while frozen.
   Under the deployment lock, write the reviewed routing state atomically, run
   the preflight, validate Caddy with its planned environment, update backend and
   Caddy environments, then confirm all readers point to the new account. The
   standard workflow deliberately refuses to run while the marker remains.
   Manual operations must supply all existing Compose environment values; never
   run a bare Compose update that can erase other service settings.
6. Keep standby paused and activate only the selected writer. Verify public
   reads/ranges, one isolated upload/read/delete, queue behavior, and new-source
   backup provenance. Reconcile persistent state and GitHub settings before
   removing the marker and clearing the variable. Rehearse the exact coordinated
   manual commands against the deployed release before doing this for real.

For hosting rollback, follow the [writer-fencing runbook](../../infra/azure/rollback-vps/README.md).
Use `standby` state and its backend URL while retaining deployment target
`azure`; keep backup source on the same new Blob account. A router change alone
does not activate a paused writer. If writer fencing fails, do not enable a
second writer. Both new hosting targets still depend on the same Blob account.

## Evidence and limits

[Aggregate rehearsal report](../../infra/azure/cdn/diagnostics/routing-rehearsal-2026-11-17.json):
the existing production Caddy image validated and ran the complete candidate
Caddyfile with each of the three upstreams in a temporary labelled proxy bound
only to `127.0.0.1:15003`. A 32-byte read of an existing object returned matching
HTTP 206, Content-Range, MIME type and bytes on every target. Azure and standby
health remained paused/drained. No media was written. Container IDs/start times
of production CDN, Caddy, backend and Desk backup worker were unchanged. The
temporary proxy was removed; only non-secret candidate config and aggregate
report remain under `/home/gen7fuel/cdn-routing-prep-20261117/`.

Seven Python guard tests passed, including stale settings, malformed state,
freeze and backend-deployment requirements. Eleven focused backend/proxy tests
passed. All four deployment/Compose YAML files parsed successfully. The rehearsal
did not activate writes, test production Caddy recreation, perform the full
manual cutover, or establish a full production recovery time. Successful live
Desk reader authentication was subsequently verified read-only; see
[the aggregate reader report](../../infra/azure/cdn/diagnostics/desk-reader-verification-2026-11-17.json).
The final frozen delta/backup and production activation remain pending.
