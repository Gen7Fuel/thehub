# CDN cutover commands and rehearsal

17 November 2026. **Preparation and rehearsal only. No live cutover was run.**
Publish these changes through a branch/PR/merge. New tools/tests live under
`infra`, and the VPS workflow skips deployment when no application was selected.
The separate checks workflow has no production permissions or deployment step.

## Rehearsed evidence

- Real CDN and Caddy images ran in disposable containers on an internal network,
  with synthetic local files and a synthetic admin token. Old-writer fencing,
  new-route verification before activation, base64/PNG uploads, same-storage
  standby recovery and pause persistence across restart passed. All fixtures,
  network and media volume were removed. Production containers were unchanged.
- A separate disposable Compose project exercised `up --no-deps --wait caddy`
  while its backend stayed stopped, then restarted the backend with health
  waiting and successfully proxied a read. Those fixtures were removed.
- Actual production Compose configurations were rendered **without applying**
  Azure/standby overrides. Existing Hub settings, original CDN settings and
  Desk's archive destination were preserved; credentials stayed in memory.
- The read-only final-delta command ran against real Azure using existing VPS
  credentials. Latest observation: 10,461 source files / 34,417,464,696 bytes;
  September, October and November; zero proposed destination deletions;
  `writersFenced:false`. This is a changing online preview, not a frozen plan.
- Eight cutover fixture tests passed. Existing CDN tests: 35 total, 32 pass and
  three gated integration skips. Together: 43 tests, 40 pass, three skip.

Production execution, actual final-delta writes/deletions, full frozen backup
coverage and real outage duration were not exercised. No GitHub Secret or
variable changed. The old queued GitHub run remains unresolved, not cancelled.

## Read-only commands safe before a window

From the reviewed Hub checkout in PowerShell:

```powershell
node infra/azure/cdn/scripts/final-delta-vps.cjs plan
Get-Content -Raw infra/azure/cdn/scripts/rehearse-cutover-config.py |
  ssh gen7fuel@app.gen7fuel.com 'python3 -'
```

The first command defaults to plan. Public source code is streamed via SSH stdin
to avoid Windows argv limits. Azure credentials are selected on the VPS in memory
and inherited by a disposable runner as environment values; values never enter
command arguments, reports or new env files. Full execution plans/receipts are
retained only in private `_migration/cdn/final/` blobs, with checksum readback.

## Before the window: stage complete month backups

Use the already deployed Desk worker to make verified monthly archives, including
September. This writes backups, so it is a later authorized operational step,
**not part of the read-only rehearsal**. Check worker phase first; do not redeploy
or interrupt an active archive. Record `$backupSince` immediately before staging:

```powershell
$backupSince = [DateTime]::UtcNow.ToString('o')
@'
const { BlobServiceClient } = require('@azure/storage-blob');
const b = require('./apps/cdn/cdn.backup');
async function main() {
  if (['ACCOUNT','CONTAINER','TENANT_ID','CLIENT_ID','CLIENT_SECRET'].some(n => process.env['CDN_BACKUP_SOURCE_'+n])) throw new Error('Expected original source before cutover');
  const c = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(process.env.AZURE_CONTAINER);
  const files = await b.inventory(c);
  if (!files.length) throw new Error('Empty source');
  const months = [...new Set(files.map(f => f.lastModified.slice(0,7)))].sort();
  for (const month of months) await b.enqueue(month, c);
  console.log(JSON.stringify({queuedMonths:months}));
}
main().catch(() => {console.error('Backup enqueue failed');process.exitCode=1});
'@ | ssh gen7fuel@app.gen7fuel.com 'docker exec -i desk-cdn-backup node'
```

Wait for all requested months, not just the worker's latest success. Each archive
already receives full SHA-256 upload/readback verification. During the frozen
window below, the proof tool checks every month's exact filename/size/date/SHA/
source-ETag inventory and current archive ETag. Stale earlier archives are ignored
if a later matching archive exists. Regenerate any changed/missing month while
frozen using `b.enqueue('YYYY-MM')` above. This allows unchanged staged month
archives to be reused without pretending an earlier current-month archive covers
new uploads. Keep archive creation/checking outside public CI logs.

## Window commands — do not run during preparation

The operator runs these only after the user schedules the maintenance window.
Hub API will be unavailable while its backend is stopped. Full destination byte
verification still reads roughly 34 GB; backup work adds I/O. Do not promise a
fixed window based on the quick routing rehearsal.

1. Freeze both repositories' deployments operationally. Set **Hub repository
   variable** `CDN_MIGRATION_FREEZE=true`; wait for real in-flight jobs to finish.
   Monitor the known stale queued run; abort on unexpected jobs. Do not assume
   this variable cancels older runs. Keep Desk deployments idle separately.
   Install the server marker:

   ```powershell
   ssh gen7fuel@app.gen7fuel.com 'umask 077; touch /home/gen7fuel/.hub-cdn-deploy-freeze'
   ```

2. Announce maintenance, stop admission of new user work, pause the relevant
   BullMQ producers/queues and wait for active automation to finish. Record prior
   pause states so only queues paused for this window are resumed. Do not import
   worker modules merely to pause queues: instantiate BullMQ `Queue` clients
   directly. Also account for cron/request-driven automation outside BullMQ.
   This is an application quiescence checkpoint; do not kill an active Petrosoft
   transaction. Then stop Hub producers **before** pausing CDN uploads:

   ```powershell
   ssh gen7fuel@app.gen7fuel.com 'docker stop --time 60 backend'
   @'
   async function main() {
     const r=await fetch('http://127.0.0.1:5001/cdn/maintenance',{
       method:'POST',headers:{Authorization:'Bearer '+process.env.CDN_ADMIN_TOKEN,'Content-Type':'application/json'},
       body:JSON.stringify({paused:true}),signal:AbortSignal.timeout(45000)});
     const s=await r.json();
     if(!r.ok||!s.paused||!s.drained||s.activeWrites!==0)throw new Error('Not drained');
     console.log(JSON.stringify({paused:s.paused,drained:s.drained,activeWrites:s.activeWrites}));
   }
   main().catch(()=>{console.error('Pause/drain not confirmed');process.exitCode=1});
   '@ | ssh gen7fuel@app.gen7fuel.com 'docker exec -i cdn node'
   ```

   Direct-port clients are fenced by this same CDN pause. Keep Azure and standby
   paused too. On a pause failure, leave maintenance active and investigate.

3. Generate a **new frozen plan**, review its digest and proposed deletion count:

   ```powershell
   node infra/azure/cdn/scripts/final-delta-vps.cjs plan
   node infra/azure/cdn/scripts/final-delta-vps.cjs execute <REVIEWED_DIGEST> <REVIEWED_DELETE_COUNT>
   ```

   Do not reuse the rehearsal digest. If deletions are proposed, inspect the
   private inventory comparison before authorizing that count. Execution requires
   the marker, stopped backend, deployment lock and all three writers paused/
   drained with zero active writes. It refuses unmanaged objects and changed
   plans, pins destination deletions to ETags, and checks fences before mutations.
   Every destination file is fully hashed, and the source must remain unchanged.
   All partial failures leave writers fenced; re-plan after investigating. Source
   blobs are never deleted. Save the successful `manifestSha256` as `$finalManifest`.
   The result explicitly says a full backup is still required.

4. While still frozen, verify complete backup coverage against that manifest.
   `$backupSince` is the staging start time, not an invented earlier timestamp:

   ```powershell
   $proof = Get-Content -Raw infra/azure/cdn/scripts/verify-frozen-backups.cjs |
     ssh gen7fuel@app.gen7fuel.com "docker exec -i desk-cdn-backup node - $finalManifest $backupSince"
   if ($LASTEXITCODE -ne 0) { throw 'Frozen backup proof failed: finish matching month backups before proceeding' }
   $proof | ssh gen7fuel@app.gen7fuel.com 'umask 077; cat > /home/gen7fuel/.hub-cdn-backup-proof.json'
   ```

   This is receipt/current-ETag verification, relying on the worker's previously
   completed full archive readback; it does not download all TARs again. Wait for
   the worker to be idle after all months, then stop it before reconfiguration:

   ```powershell
   ssh gen7fuel@app.gen7fuel.com 'docker stop --time 60 desk-cdn-backup'
   ```

5. **This is when to tell the user to set GitHub settings**, after verified final
   delta and backup, while deployments stay frozen:

   | Repository | Setting | Value |
   | --- | --- | --- |
   | Hub | Secret `CDN_SERVICE_URL` | `https://gen7erp-cdn-prod-29b24248.azurewebsites.net` |
   | Hub | Variable `CDN_DEPLOY_TARGET` | `azure` |
   | Desk | Secret `CDN_BACKUP_SOURCE_ACCOUNT` | `gen7erpmedia29b24248` |
   | Desk | Secret `CDN_BACKUP_SOURCE_CONTAINER` | `hub` |
   | Desk | Secret `CDN_BACKUP_SOURCE_TENANT_ID` | `21634e14-74fa-410a-8886-4c3f808b58cb` |
   | Desk | Secret `CDN_BACKUP_SOURCE_CLIENT_ID` | `8dec8f37-a249-4fd6-98e6-9643c7f87f5a` |
   | Desk | Secret `CDN_BACKUP_SOURCE_CLIENT_SECRET` | Existing approved Hub backend principal secret; transfer securely, never through chat |

   Do not change shared `AZURE_*`, `CDN_ADMIN_TOKEN`, Academy settings or backup
   destination. These setting edits alone do not alter running containers.

6. Apply the reviewed runtime sequence, retaining the freeze:

   ```powershell
   $ops = "import sys`nsys.argv += ['--apply-target','azure','--execute-production','--activate-selected-writer','--verified-backup-proof','/home/gen7fuel/.hub-cdn-backup-proof.json']`n" +
     [IO.File]::ReadAllText((Join-Path (Get-Location) 'infra/azure/cdn/scripts/rehearse-cutover-config.py'))
   $ops | ssh gen7fuel@app.gen7fuel.com 'python3 -'
   ```

   The production path is explicitly gated and was **not executed in rehearsal**.
   It reconstructs existing settings in memory, checks all writer fences, saves
   routing state atomically, updates Caddy first, compares public/direct health
   releases while paused, activates only Azure, then starts backend and Desk with
   their planned overrides and health waits. This keeps workers off a paused
   destination. If a subsequent service update fails, it attempts to pause/drain
   the selected writer and retains the freeze. A failed pause needs control-plane
   fencing; never assume the writer was fenced just because a command failed.
   The JSON proof file is an operator-controlled checkpoint, not a substitute
   for actually running and reviewing the copy/backup verification.
   Initial cutover requires proof verified after the current freeze marker. An
   activation-attempt marker is durably written before unpause; even a timeout
   can follow a committed activation. Once that marker exists, the old-source
   final-copy command refuses execution. Same-storage hosting recovery may reuse
   the initial checkpoint; never remove the marker to force an old-source copy.

7. Verify real public reads/ranges, admin auth, all three upload formats with
   isolated test files and deletion of only those files, background queue health,
   runtime source/account settings and original backup destination. Confirm old
   CDN and standby remain paused. Resume only queues paused for this window and
   close maintenance after successful checks. Validate GitHub settings and the
   persistent routing state before clearing the marker and GitHub freeze. Never
   run a bare Compose command with missing environment values.

## Same-storage rollback

Fence Azure first; if its API cannot confirm drain, stop App Service and verify
the stopped state through the control plane. Stop/drain producers and coordinate
the backup worker. Use the same runtime sequence with target `standby`, Hub
`CDN_SERVICE_URL=http://cdn-rollback-vps:5001`, and **keep** `CDN_DEPLOY_TARGET=azure`.
Desk's live source stays on the new account. Use the existing initial full-backup
proof as a checkpoint; this hosting rollback does not copy media back to old
storage. After any new-account writes, never simply reactivate old `cdn:5001`.
See [the rollback runbook](../../infra/azure/rollback-vps/README.md) for conditions.

The exact production apply path, large frozen copy/deletion behavior against live
Azure and full month-backup completion must still be observed during the actual
authorized window. The isolated tests establish command ordering and failure
guards, not a guaranteed production duration or throughput.
