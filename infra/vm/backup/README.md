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

1. Confirm the destination container from the existing VPS backup script (read-only inspection) and create a
   **write-only SAS** for it: permissions `cw` only, no read, list or delete, with an expiry you can rotate.
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

## Retention (storage side)

The uploader cannot delete anything, so retention is an Azure Storage lifecycle policy on the container:
delete `gen7-vm/hourly/` after 2 days, `gen7-vm/daily/` after 30 days, `gen7-vm/monthly/` after 365 days. Also
enable blob soft delete (14 days) and versioning. These are production storage changes that need separate
authorization. Backups in a RA-GRS account have a read-only copy in the paired region (replication is
asynchronous). The job does not alert by itself: monitor that `last_success` in `status.json`, or the newest
`MANIFEST.json` blob, is younger than 2 hours.

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
