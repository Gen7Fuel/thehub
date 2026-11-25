#!/bin/bash
# Hourly backup of the Hub and Desk databases, Redis queue state and the email relay journal
# on gen7-erp-vm. Dumps each store from its container, verifies the files, writes a manifest,
# uploads to blob storage with a write-only SAS token (manifest last), then prunes local runs.
# Install per README.md. Exit status is non-zero on any failure so systemd marks the run failed.
set -euo pipefail
umask 077

ROOT=${GEN7_BACKUP_ROOT:-/var/backups/gen7}        # local staging; keep it off the data disk
STATE=${GEN7_BACKUP_STATE:-/var/lib/gen7-backup}   # status.json and the run lock
KEEP_LOCAL=${GEN7_BACKUP_KEEP_LOCAL:-6}
HUB_PROJECT=${GEN7_HUB_PROJECT:-gen7-hub}
DESK_PROJECT=${GEN7_DESK_PROJECT:-gen7-desk}
PREFIX=${BACKUP_BLOB_PREFIX:-gen7-vm}
DAILY_HOUR_UTC=${GEN7_BACKUP_DAILY_HOUR_UTC:-07}
BASE_URL=${BACKUP_BLOB_BASE_URL:?set BACKUP_BLOB_BASE_URL (https://<account>.blob.core.windows.net/<container>)}
SAS=${BACKUP_BLOB_SAS:-}
# How uploads authenticate: managed-identity (the VM's own Azure identity; nothing stored, nothing to
# renew) or sas (a write-only SAS token). Default: sas when BACKUP_BLOB_SAS is set, else managed-identity.
AUTH=${BACKUP_AUTH:-$([[ -n "$SAS" ]] && echo sas || echo managed-identity)}
IMDS_URL=${BACKUP_IMDS_URL:-http://169.254.169.254/metadata/identity/oauth2/token}
IDENTITY_CLIENT_ID=${BACKUP_IDENTITY_CLIENT_ID:-}   # only for a user-assigned identity
case "$AUTH" in managed-identity | sas) ;; *) echo "BACKUP_AUTH must be managed-identity or sas" >&2; exit 2 ;; esac

log() { printf '%s [gen7-backup] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if [[ "${GEN7_BACKUP_ANY_HOST:-}" != 1 ]]; then
    test "$(hostname -s)" = gen7-erp-vm || { log 'REFUSED: not running on gen7-erp-vm'; exit 2; }
fi
mkdir -p "$ROOT" "$STATE"

exec 9>"$STATE/lock"
if ! flock -n 9; then
    log 'previous run still active; skipping'
    exit 75
fi

started=$(date -u +%s)
run=$(date -u +%Y%m%dT%H%M%SZ)
dir="$ROOT/$run.partial"
stage=starting

write_status() { # key, message
    python3 - "$STATE/status.json" "$1" "$2" "$run" <<'PY'
import json, os, sys, time
path, key, message, run = sys.argv[1:5]
try:
    status = json.load(open(path))
except Exception:
    status = {}
status[key] = {'at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'run': run, 'detail': message}
tmp = path + '.tmp'
json.dump(status, open(tmp, 'w'))
os.replace(tmp, path)
PY
}

on_error() {
    local code=$?
    log "FAILED during $stage (exit $code)"
    write_status last_failure "failed during $stage" || true
    rm -rf -- "$dir"
    exit "$code"
}
trap on_error ERR

container() { # project service -> exactly one running container id
    local ids
    ids=$(docker ps -q --filter "label=com.docker.compose.project=$1" --filter "label=com.docker.compose.service=$2")
    if [[ $(printf '%s\n' "$ids" | grep -c .) -ne 1 ]]; then
        log "expected exactly one running $1/$2 container, found: $(printf '%s' "$ids" | tr '\n' ' ')"
        return 1
    fi
    printf '%s' "$ids"
}

mkdir -p "$dir"

stage=lookup
hub_mongo=$(container "$HUB_PROJECT" mongo)
hub_pg=$(container "$HUB_PROJECT" postgres)
hub_redis=$(container "$HUB_PROJECT" redis)
hub_relay=$(container "$HUB_PROJECT" email-service)
desk_mongo=$(container "$DESK_PROJECT" db)

stage=hub-mongo
log 'dumping Hub MongoDB (all databases)'
docker exec "$hub_mongo" mongodump --quiet --archive --gzip > "$dir/hub-mongo.archive.gz"

stage=desk-mongo
log 'dumping Desk MongoDB (all databases)'
docker exec "$desk_mongo" mongodump --quiet --archive --gzip > "$dir/desk-mongo.archive.gz"

stage=hub-postgres
log 'dumping Hub PostgreSQL and roles'
docker exec "$hub_pg" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$dir/hub-postgres.dump"
docker exec "$hub_pg" sh -c 'pg_dumpall -U "$POSTGRES_USER" --globals-only' > "$dir/hub-postgres-globals.sql"

stage=hub-redis
log 'saving Hub Redis (queue state)'
# redis-cli --rdb asks the server for a fresh, consistent snapshot over the sync protocol. That
# avoids polling LASTSAVE (whole-second resolution) and any assumption about dump.rdb's path.
docker exec "$hub_redis" redis-cli --rdb /tmp/gen7-backup.rdb >/dev/null
docker exec "$hub_redis" redis-check-rdb /tmp/gen7-backup.rdb >/dev/null
docker cp "$hub_redis:/tmp/gen7-backup.rdb" "$dir/hub-redis.rdb" >/dev/null
docker exec "$hub_redis" rm -f /tmp/gen7-backup.rdb

stage=hub-email-journal
log 'copying the email relay journal'
docker cp "$hub_relay:/var/lib/email-relay/journal.jsonl" "$dir/hub-email-journal.jsonl" >/dev/null

stage=verify
log 'verifying the dump files'
for file in hub-mongo.archive.gz desk-mongo.archive.gz; do
    test -s "$dir/$file"
    gzip -t "$dir/$file"
done
docker exec -i "$hub_pg" pg_restore --list < "$dir/hub-postgres.dump" | grep -q 'TABLE'
test -s "$dir/hub-postgres-globals.sql"
test "$(head -c 5 "$dir/hub-redis.rdb")" = REDIS
test -f "$dir/hub-email-journal.jsonl"

stage=manifest
python3 - "$dir" "$run" "$(hostname -s)" <<'PY'
import hashlib, json, os, sys
directory, run, host = sys.argv[1:4]
files = []
for name in sorted(os.listdir(directory)):
    path = os.path.join(directory, name)
    digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    files.append({'name': name, 'bytes': os.path.getsize(path), 'sha256': digest})
json.dump({'run': run, 'host': host, 'files': files}, open(os.path.join(directory, 'MANIFEST.json'), 'w'), indent=2)
with open(os.path.join(directory, 'SHA256SUMS'), 'w') as sums:
    for item in files:
        sums.write(f"{item['sha256']}  {item['name']}\n")
PY
files_listed=$(python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))["files"]))' "$dir/MANIFEST.json")

stage=upload
classes=${GEN7_BACKUP_FORCE_CLASSES:-hourly}
if [[ -z "${GEN7_BACKUP_FORCE_CLASSES:-}" ]]; then
    [[ "${run:9:2}" == "$DAILY_HOUR_UTC" ]] && classes="$classes daily"
    [[ "${run:9:2}" == "$DAILY_HOUR_UTC" && "${run:6:2}" == 01 ]] && classes="$classes monthly"
fi

TOKEN=
if [[ "$BASE_URL" != file://* && "$AUTH" == managed-identity ]]; then
    # One token per run from the VM's local identity endpoint (valid for hours, fetched fresh each run).
    query="api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F${IDENTITY_CLIENT_ID:+&client_id=$IDENTITY_CLIENT_ID}"
    TOKEN=$(curl -fsS --retry 3 --retry-delay 2 --max-time 10 -H 'Metadata: true' "$IMDS_URL?$query" \
        | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
    [[ -n "$TOKEN" ]]
    log 'acquired a storage token from the managed identity'
fi

put() { # local-file blob-path
    local file=$1 blob=$2 md5 url
    if [[ "$BASE_URL" == file://* ]]; then
        mkdir -p "$(dirname "${BASE_URL#file://}/$blob")"
        cp "$file" "${BASE_URL#file://}/$blob"
        return 0
    fi
    md5=$(openssl md5 -binary "$file" | base64)
    url="$BASE_URL/$blob${SAS:+?$SAS}"
    # The URL (SAS) and the bearer token go to curl on stdin so they never appear in the process list.
    { printf 'url = "%s"\n' "$url"; [[ -n "$TOKEN" ]] && printf 'header = "Authorization: Bearer %s"\n' "$TOKEN"; true; } \
        | curl -K - -fsS --retry 3 --retry-delay 5 --max-time 900 -X PUT \
            -H 'x-ms-blob-type: BlockBlob' -H 'x-ms-version: 2021-08-06' -H 'Content-Type: application/octet-stream' \
            -H "Content-MD5: $md5" --upload-file "$file" -o /dev/null
}

for class in $classes; do
    case "$class" in
        hourly) tag=$run ;;
        daily) tag=${run:0:8} ;;
        monthly) tag=${run:0:6} ;;
        *) log "unknown class $class"; false ;;
    esac
    log "uploading $files_listed files to $PREFIX/$class/$tag"
    for file in "$dir"/*; do
        name=$(basename "$file")
        [[ "$name" == MANIFEST.json ]] && continue
        put "$file" "$PREFIX/$class/$tag/$name"
    done
    put "$dir/MANIFEST.json" "$PREFIX/$class/$tag/MANIFEST.json"   # last: its presence marks a complete run
done

stage=finalize
mv "$dir" "$ROOT/$run"
bytes=$(du -sk "$ROOT/$run" | cut -f1)
write_status last_success "uploaded ${files_listed} files, ${bytes} KiB, classes: ${classes}, $(( $(date -u +%s) - started ))s"

stage=prune
# Keep the newest $KEEP_LOCAL completed local runs; drop abandoned partial runs older than a day.
mapfile -t runs < <(ls -1 "$ROOT" | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort)
if (( ${#runs[@]} > KEEP_LOCAL )); then
    for old in "${runs[@]:0:${#runs[@]}-KEEP_LOCAL}"; do rm -rf -- "${ROOT:?}/$old"; done
fi
find "$ROOT" -maxdepth 1 -name '*.partial' -mmin +1440 -exec rm -rf -- {} + 2>/dev/null || true

log "done: run $run in $(( $(date -u +%s) - started ))s"
