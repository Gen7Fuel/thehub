# Backups on the Azure VM

An hourly job on `gen7-erp-vm` dumps the Hub and Desk databases, the Hub Redis queue state and the
email relay journal, verifies the files, uploads them to blob storage and prunes its local copies.
It replaces the VPS cron backups for these stores after cutover (owner decision, 2026-11-25: backups
run on the Azure VM; 1-hour RPO). Targets and owners are in `docs/migration-prep/recovery-objectives.md`
in the workspace.

## What one run does

| Store | Method | File |
|---|---|---|
| Hub MongoDB (all databases, including Fleet's) | `mongodump --archive --gzip` in the container | `hub-mongo.archive.gz` |
| Desk MongoDB | same | `desk-mongo.archive.gz` |
| Hub PostgreSQL | `pg_dump -Fc` and `pg_dumpall --globals-only` (roles, which include password hashes) | `hub-postgres.dump`, `hub-postgres-globals.sql` |
| Hub Redis (BullMQ queues) | `redis-cli --rdb` (a fresh consistent snapshot from the server), checked with `redis-check-rdb` | `hub-redis.rdb` |
| Email relay duplicate-protection journal | copied from the relay container (keys and states only, no message content) | `hub-email-journal.jsonl` |

Each file is verified (gzip test, `pg_restore --list`, RDB check, non-empty), then `MANIFEST.json` and
`SHA256SUMS` are written. Uploads go to `<prefix>/<class>/<tag>/<file>` with the manifest **last**, so a
run without `MANIFEST.json` is incomplete and must be ignored. Classes: `hourly/<UTC timestamp>` always,
`daily/<date>` for the run in the daily hour (07 UTC), `monthly/<yyyymm>` for that run on the 1st.
The newest 6 completed runs stay in `/var/backups/gen7` (the OS disk, not the data disk). `status.json` in
`/var/lib/gen7-backup` records the last success and last failure. A failed run uploads nothing and leaves no
partial directory; an overlapping run exits 75 and does nothing.

The three stores are dumped one after another, so a run is consistent per store but not one atomic
snapshot across stores. That is acceptable because a restore is always followed by reconciling in-flight jobs.

## Install (inside an approved window; this is a production configuration change)

1. **Destination:** dedicated container `gen7-vm-backups` in storage account `gen7fuel` (created 2026-11-25; the old
   VPS jobs use the shared `hub` container and a full-access key, which this job must not reuse). Uploads
   authenticate as the VM's **managed identity** (recommended, see "Azure setup" below), or with a write-only SAS.
2. On the VM: install the files, then the environment file (names in `backup.env.example`, root only):
   ```sh
   sudo install -o root -g root -m 0755 gen7-backup.sh /usr/local/libexec/gen7-backup
   sudo install -o root -g root -m 0755 gen7-restore.sh /usr/local/libexec/gen7-restore
   sudo install -d -m 0700 /etc/gen7-backup /var/backups/gen7 /var/lib/gen7-backup
   sudo install -o root -g root -m 0600 backup.env /etc/gen7-backup/backup.env
   sudo install -m 0644 gen7-backup.service gen7-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   ```
3. Run it once by hand and check the destination: `sudo systemctl start gen7-backup.service`, then
   `journalctl -u gen7-backup -n 30` and the new `hourly/<run>/MANIFEST.json` blob. Then
   `sudo systemctl enable --now gen7-backup.timer`.
4. Do not enable it on the VPS or alongside the VPS jobs for the same stores; keep exactly one active backup owner
   per store. After cutover, verify one scheduled result and then retire the VPS jobs for Hub and Desk.

Requirements on the VM: `docker`, `bash`, `python3`, `curl`, `openssl`, `flock` (all in Ubuntu 24.04), and the
Compose project names `gen7-hub` and `gen7-desk` with services `mongo`, `postgres`, `redis`, `email-service` and `db`.

## Azure setup for the managed identity (one time, needs an identity-grant approval)

The job fetches a short-lived token from the VM's local identity endpoint at the start of each upload stage, so there is
no secret on the VM and nothing to renew. The role can only write blobs, and it is assigned on the one container.
Review `backup-writer-role.json` (fill in the subscription id), then, as someone who may create roles and assignments:

```sh
az role definition create --role-definition @backup-writer-role.json
az vm identity assign -g Gen7ERP -n gen7-erp-vm                      # system-assigned identity
principal=$(az vm show -g Gen7ERP -n gen7-erp-vm --query identity.principalId -o tsv)
az role assignment create --assignee-object-id "$principal" --assignee-principal-type ServicePrincipal \
  --role "Gen7 VM Backup Writer" \
  --scope /subscriptions/<subscription-id>/resourceGroups/EDW_GEN7FUEL/providers/Microsoft.Storage/storageAccounts/gen7fuel/blobServices/default/containers/gen7-vm-backups
```

Role assignments can take a few minutes to take effect. The first run on the VM proves it: a `403
AuthorizationPermissionMismatch` means a missing data action, an authentication error means the assignment has not
propagated yet. Rollback: delete the role assignment, then the role definition, then `az vm identity remove`.

**Exposure to contain:** any process on the VM that can reach `169.254.169.254` can request the same token, including the
app containers. A compromised container could then write (not read or delete) blobs into the backup container. Block the
endpoint from the Docker bridges, for example `iptables -I DOCKER-USER -d 169.254.169.254 -j DROP`, persisted
across reboots, and re-run the rehearsal; the job itself runs on the host and is unaffected. Soft delete, unique blob
names and a restore drill limit the damage of junk writes, and the freshness alert should catch missing real backups.

## Retention (storage side)

The uploader cannot delete anything, so retention is an Azure Storage lifecycle policy. **Applied to account `gen7fuel`
on 2026-11-25**, scoped by prefix to this container only: `gen7-vm-backups/gen7-vm/hourly/` is deleted 2 days after
creation, `daily/` after 30 days, `monthly/` after 365 days (Azure evaluates policies about daily, so expiry can lag by a
day). **Blob soft delete (14 days) is also on**, account-wide, so deleted or overwritten backup blobs stay recoverable for
14 days. **Blob versioning is deliberately off**: it is an account-wide setting that would also keep every prior version of
the CDN media in `hub`, and soft delete already covers overwrites. Backups in a RA-GRS account have a read-only copy
in the paired region (replication is asynchronous). The job does not alert by itself: monitor that `last_success` in
`status.json`, or the newest `MANIFEST.json` blob, is younger than 2 hours.

## Restore

Declare an incident first, fence every writer (Hub API, worker, scheduler, Desk API, Fleet) and decide the restore
point. Then, with the backup directory on the VM (copy it down from blob storage, or use a recent local run):

```sh
sudo gen7-restore /var/backups/gen7/<run>                                  # verify checksums only
sudo gen7-restore /var/backups/gen7/<run> --apply --writers-fenced         # MongoDB (both) and PostgreSQL
# add --with-globals to replay PostgreSQL roles (needed on a brand new PostgreSQL volume)
```

Redis and the relay journal need the service stopped, so they are manual:

```sh
# Redis: stop it, keep the old files aside, load the RDB with AOF off, then turn AOF back on.
docker compose -p gen7-hub stop redis      # with the project's -f and --env-file flags
# put hub-redis.rdb at <GEN7_DATA_ROOT>/hub/redis/dump.rdb (owner 999:999), move appendonlydir aside,
# start redis with --appendonly no, check the keys, then start it normally and wait for the AOF rewrite.
# Email relay journal (so blocked mail keys are still blocked): with the relay stopped,
IMAGE=$(docker inspect --format '{{.Config.Image}}' <relay container>)
uid=$(docker run --rm --entrypoint id "$IMAGE" -u appuser)
docker cp hub-email-journal.jsonl <relay container>:/var/lib/email-relay/journal.jsonl
docker run --rm --volumes-from <relay container> --entrypoint chown "$IMAGE" "$uid" /var/lib/email-relay/journal.jsonl
```

Before releasing queues, **reconcile every job that was pending in the backup**: it may already have sent mail or
posted to Sage after the backup point. Rehearse this runbook before relying on it.

## Test

```sh
bash infra/vm/backup/test-backup.sh
```
Starts real MongoDB, PostgreSQL and Redis containers with synthetic data and proves: the run, the checksums, a
stub blob endpoint receiving checksum-verified uploads with the manifest last and the SAS kept out of the log,
retention classes and pruning, a failed run leaving nothing complete, the overlap guard, a full restore after
dropping all three databases, the fenced-writers refusal and rejection of a damaged backup. CI runs it on pull
requests that touch this directory. Not covered: the real storage account, real data sizes, the VM, and the
manual Redis and relay steps.
