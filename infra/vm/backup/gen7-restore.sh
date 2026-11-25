#!/bin/bash
# Restore MongoDB and PostgreSQL from a gen7-backup run directory into the running containers.
# Redis and the relay journal are NOT restored here: they need the service stopped (see README.md).
#
#   gen7-restore.sh <run-directory>                                  verify only (default)
#   gen7-restore.sh <run-directory> --apply --writers-fenced         restore Hub and Desk databases
#   add --with-globals to also replay PostgreSQL roles
set -euo pipefail
umask 077

HUB_PROJECT=${GEN7_HUB_PROJECT:-gen7-hub}
DESK_PROJECT=${GEN7_DESK_PROJECT:-gen7-desk}
log() { printf '%s [gen7-restore] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

dir=${1:?usage: gen7-restore.sh <run-directory> [--apply --writers-fenced] [--with-globals]}
shift
apply=0; fenced=0; globals=0
for arg in "$@"; do
    case "$arg" in
        --apply) apply=1 ;;
        --writers-fenced) fenced=1 ;;
        --with-globals) globals=1 ;;
        *) log "unknown option $arg"; exit 2 ;;
    esac
done

if [[ "${GEN7_BACKUP_ANY_HOST:-}" != 1 ]]; then
    test "$(hostname -s)" = gen7-erp-vm || { log 'REFUSED: not running on gen7-erp-vm'; exit 2; }
fi

log "verifying checksums in $dir"
(cd "$dir" && sha256sum -c SHA256SUMS >/dev/null)
python3 - "$dir" <<'PY'
import json, os, sys
manifest = json.load(open(os.path.join(sys.argv[1], 'MANIFEST.json')))
names = {item['name'] for item in manifest['files']}
required = {'hub-mongo.archive.gz', 'desk-mongo.archive.gz', 'hub-postgres.dump', 'hub-postgres-globals.sql', 'hub-redis.rdb'}
missing = required - names
if missing:
    sys.exit(f'manifest is missing {sorted(missing)}')
print(f"run {manifest['run']} from {manifest['host']}: {len(names)} files verified")
PY

if (( apply == 0 )); then
    log 'verify only. Re-run with --apply --writers-fenced to restore.'
    exit 0
fi
if (( fenced == 0 )); then
    log 'REFUSED: restoring overwrites live data. Fence every writer (Hub API, worker, scheduler, Desk API, Fleet) and pass --writers-fenced.'
    exit 2
fi

container() {
    local ids
    ids=$(docker ps -q --filter "label=com.docker.compose.project=$1" --filter "label=com.docker.compose.service=$2")
    test "$(printf '%s\n' "$ids" | grep -c .)" -eq 1 || { log "expected exactly one running $1/$2 container" >&2; return 1; }
    printf '%s' "$ids"
}
hub_mongo=$(container "$HUB_PROJECT" mongo)
desk_mongo=$(container "$DESK_PROJECT" db)
hub_pg=$(container "$HUB_PROJECT" postgres)

log 'restoring Hub MongoDB (existing collections are dropped and replaced)'
docker exec -i "$hub_mongo" mongorestore --quiet --archive --gzip --drop < "$dir/hub-mongo.archive.gz"
log 'restoring Desk MongoDB'
docker exec -i "$desk_mongo" mongorestore --quiet --archive --gzip --drop < "$dir/desk-mongo.archive.gz"
if (( globals == 1 )); then
    log 'replaying PostgreSQL roles'
    docker exec -i "$hub_pg" sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=0 -q' < "$dir/hub-postgres-globals.sql" >/dev/null
fi
log 'restoring Hub PostgreSQL (objects are dropped and recreated)'
docker exec -i "$hub_pg" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$dir/hub-postgres.dump"

log 'done. Redis and the relay journal still need the manual steps in README.md. Reconcile any job that was pending in the backup before releasing queues.'
