# Desk CDN daily backup deployment — 2026-11-16

## Follow-up: first full run succeeded

Read-only follow-up on 16 November at 20:06 UTC confirmed phase `succeeded`,
`lastScheduledDate=2026-11-16`, zero consecutive failures and completion at
15:29:59 UTC. October's 4,367 files and November's 1,800 files have full-TAR
readback verification results. Current archive ETags still match those results;
both completion sidecars contain the same SHA-256 values. See the
[verification record](../../infra/azure/cdn/diagnostics/backup-verification-2026-11-16.json).
This follow-up did not redownload or restore both complete archives.

The later live November inventory is 1,918 files. This backup is an earlier
recovery point and does not cover all subsequent changes; coordinate a fresh
delta and backup before production cutover. Existing worker settings still
point at the original account; no backup configuration or schedule was changed.
The original in-progress observations below remain historical.

Automation is deployed; the first full live run is still in progress at this observation. Do not mistake the successful three-file restore smoke for completion of the full production backup.

- Desk commit: `b459d864356937406324fdf036d5fdb7efc14d64`, on `origin/main`.
- Deployment succeeded: https://github.com/Gen7Fuel/desk/actions/runs/43884530914
- Isolated implementation checkout: `C:/Users/MohammadHasan/AppData/Local/Temp/desk-cdn-daily`, branch `feat/cdn-daily-backup`. The user's existing Desk worktree and unrelated changes were preserved.
- Production Desk API and frontend images both use this commit and are healthy. The new `desk-cdn-backup` worker is running the backend image with command `node apps/cdn/cdn.backup-worker.js`, with zero restarts at observation.
- Production `/api/health` returned 200. `/api/cdn/backup/status` returned 401 without authentication, as intended.

## Behavior

Separate Compose worker, not a cron imported into the Desk API. Runs daily after 02:00 America/Toronto and catches up after downtime. Manual backups now enqueue durable Azure requests and return 202; Desk polls authenticated backup status and shows progress, last verified success, failures and overdue warnings. There is no email alert recipient configured.

Azure reads the live `cdn/` prefix using Desk's existing Azure environment, bypassing CDN HTTP pagination. The renewable lease and status live at `cdn_backup/automated/status.json`, with lease-fenced status writes. Sources are pinned to inventory ETags. Every source is streamed into a TAR, original modification dates are preserved, and an embedded manifest records SHA-256, size, ETag, content type and original dates. The entire uploaded TAR is read back under its returned ETag and SHA-256 verified before publishing its JSON completion marker and last success.

Daily current-month archives: `cdn_backup/automated/daily/YYYY-MM-DD/UUID/cdn-YYYY-MM.tar`, kept 30 days after verified completion. Completed previous-month and manual monthly archives: `cdn_backup/automated/monthly/YYYY-MM-DD/UUID/`, retained permanently. Legacy `cdn_backup/cdn-YYYY-MM.tar` files are untouched. A TAR without its verified sidecar is not a completed backup. Failed partial objects remain for investigation. Archives share the existing source Azure account; this does not provide account-level disaster recovery or enable soft delete.

## Verification and pending first run

- Eight local checks passed: archive restore bytes/dates, corrupted upload readback, failed source, Toronto DST schedule, monthly rollover, retries and preserved last success, lease overlap, empty inventory, retention scope, and manual/status HTTP contract with auth stubbed only at the test boundary.
- Frontend production build and changed-file lint passed.
- Actual Azure SDK against local Postman HTTP 503 stand-in rejected the backup before publishing success. The Postman request log confirmed PUT to the status/lock blob. CLI 1.75.0 does not support `postman status`; that command's failure is not a backup failure.
- Real Azure smoke in the existing Linux Desk image: archived three real small source files under an isolated UUID restore-test prefix; verified uploaded TAR readback and extracted file checksums and original dates. Also ran the scheduled `tick` with a three-file source view and confirmed lease-protected durable success. All isolated objects were removed. Latest smoke archive was 1,155,584 bytes, SHA-256 `fe2f03f773cd2e84a80bedc6746a4c2057867110681fae753b6b6b28d845238e`.
- The full worker began at **2026-11-16 14:22:23 UTC**. Initial run finalizes October (4,367 files), then backs up November. At 14:24:28 UTC, it had streamed 375 October files and had no errors or previous full automated success. Disk had 44 GB free. Large full archives require download, upload, and readback time; they continue independently of this conversation.

To check current state without exposing credentials:

```sh
docker exec desk-cdn-backup node -e "require('./apps/cdn/cdn.backup').status().then(s => console.log(JSON.stringify(s, null, 2)))"
docker logs --tail 20 desk-cdn-backup
```

Full completion requires `current.phase === 'succeeded'`, `lastScheduledDate === '2026-11-16'`, and verified October/November results in `lastSuccess.results`. Until then, November's first complete automated archive remains pending. A missing legacy exact key `cdn_backup/cdn-2026-11.tar` no longer proves absence of a backup: inspect the dated automated namespace and verified status.

Avoid unnecessary Desk redeploys while the first large archive is running: recreating the worker interrupts its in-progress temp TAR. Its durable schedule/request retries after restart and lease expiry, but begins the interrupted archive again.

## Hosting remains unchanged

CDN Express container is still on the VPS, using Azure Blob storage. The backup worker also runs on the VPS. Running the existing Docker Compose command on the VPS cannot move CDN hosting to Azure. Azure Container Apps can import a Compose specification through Azure CLI, but a CDN-only Azure configuration/resources and deployment target are still needed. Terraform and managed CDN hosting have not been created by this change.
