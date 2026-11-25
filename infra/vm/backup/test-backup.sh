#!/bin/bash
# End-to-end test of gen7-backup.sh and gen7-restore.sh against real MongoDB, PostgreSQL and
# Redis containers. Needs docker, bash, python3, curl, openssl and flock. Synthetic data only.
#   bash infra/vm/backup/test-backup.sh
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
id=$(date +%s)$$
work=$(mktemp -d)
hub=g7bk-hub-$id
desk=g7bk-desk-$id
export GEN7_BACKUP_ANY_HOST=1 GEN7_BACKUP_ROOT=$work/root GEN7_BACKUP_STATE=$work/state \
       GEN7_HUB_PROJECT=$hub GEN7_DESK_PROJECT=$desk BACKUP_BLOB_SAS=

cleanup() {
    docker rm -f $(docker ps -aq --filter "label=g7bk=$id") >/dev/null 2>&1 || true
    [[ -n "${putpid:-}" ]] && kill "$putpid" 2>/dev/null || true
    rm -rf "$work"
}
trap cleanup EXIT

checks=0
pass() { checks=$((checks + 1)); printf 'PASS %s: %s\n' "$checks" "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
expect() { [[ "$1" == "$2" ]] || fail "$3 (got '$1', expected '$2')"; }

start() { # name project service image [docker args...] -- [command...]
    local name=$1 project=$2 service=$3 image=$4
    shift 4
    docker run -d --name "$name-$id" --label "g7bk=$id" --label "com.docker.compose.project=$project" \
        --label "com.docker.compose.service=$service" "$@" "$image" >/dev/null
}
until_ok() { for _ in $(seq 1 60); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }

echo "starting fixture containers"
start hubmongo "$hub" mongo mongo:8
start deskmongo "$desk" db mongo:8
start hubpg "$hub" postgres postgres:16 -e POSTGRES_USER=fixture -e POSTGRES_PASSWORD=fixture -e POSTGRES_DB=hubsql
start hubredis "$hub" redis redis:7
docker run -d --name "relay-$id" --label "g7bk=$id" --label "com.docker.compose.project=$hub" \
    --label "com.docker.compose.service=email-service" alpine:3 sh -c \
    'mkdir -p /var/lib/email-relay && echo "{\"key\":\"emailQueue:1\",\"state\":\"sent\"}" > /var/lib/email-relay/journal.jsonl && sleep 3600' >/dev/null

hm=hubmongo-$id; dm=deskmongo-$id; pg=hubpg-$id; rd=hubredis-$id
until_ok docker exec "$hm" mongosh --quiet --eval 'db.runCommand({ping:1})'
until_ok docker exec "$dm" mongosh --quiet --eval 'db.runCommand({ping:1})'
until_ok docker exec "$pg" pg_isready -U fixture -d hubsql
until_ok docker exec "$rd" redis-cli ping
until_ok docker exec "relay-$id" test -f /var/lib/email-relay/journal.jsonl
# postgres restarts once during init; wait for a real query
until_ok docker exec "$pg" psql -U fixture -d hubsql -c 'select 1'

docker exec "$hm" mongosh --quiet --eval 'db.getSiblingDB("main").shifts.insertMany([{n:1},{n:2},{n:3}])' >/dev/null
docker exec "$dm" mongosh --quiet --eval 'db.getSiblingDB("desk").assets.insertMany([{n:1},{n:2}])' >/dev/null
docker exec "$pg" psql -U fixture -d hubsql -q -c "create table cash(id int primary key, note text); insert into cash values (1,'a'),(2,'b'),(3,'c');"
docker exec "$rd" redis-cli SET marker restored-ok >/dev/null
docker exec "$rd" redis-cli RPUSH queue job1 job2 >/dev/null
pass "fixture databases seeded"

# --- a stub blob endpoint that records what the uploader sends --------------------------------
cat > "$work/put.py" <<'PY'
import base64, hashlib, http.server, json, os, sys
root, log = sys.argv[1], sys.argv[2]
TOKEN = 'identity-token-' + hashlib.sha256(os.urandom(8)).hexdigest()[:16]
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Stands in for the VM's local identity endpoint (169.254.169.254).
        path, _, query = self.path.partition('?')
        if path == '/imds/token' and self.headers.get('Metadata') == 'true' and 'resource=https%3A%2F%2Fstorage.azure.com%2F' in query:
            payload = json.dumps({'access_token': TOKEN, 'expires_in': '86399', 'token_type': 'Bearer'}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(payload)
            with open(log, 'a') as out:
                out.write(json.dumps({'imds': True, 'token': TOKEN}) + '\n')
        else:
            self.send_response(200 if path == '/' else 404); self.end_headers()
    def do_PUT(self):
        body = self.rfile.read(int(self.headers['Content-Length']))
        md5 = base64.b64encode(hashlib.md5(body).digest()).decode()
        ok = self.headers.get('Content-MD5') == md5 and self.headers.get('x-ms-blob-type') == 'BlockBlob'
        path = self.path.split('?')[0]
        bearer = self.headers.get('Authorization')
        auth = 'none' if not bearer else ('bearer' if bearer == 'Bearer ' + TOKEN else 'bearer-bad')
        with open(log, 'a') as out:
            out.write(json.dumps({'path': path, 'query': self.path.partition('?')[2], 'md5_ok': ok, 'auth': auth}) + '\n')
        if not ok or auth == 'bearer-bad':
            self.send_response(400); self.end_headers(); return
        target = os.path.join(root, path.lstrip('/'))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        open(target, 'wb').write(body)
        self.send_response(201); self.end_headers()
    def log_message(self, *args): pass
http.server.HTTPServer(('127.0.0.1', int(sys.argv[3])), Handler).serve_forever()
PY
port=$((20000 + RANDOM % 20000))
mkdir -p "$work/blob"
python3 "$work/put.py" "$work/blob" "$work/put.log" "$port" &
putpid=$!
until_ok curl -s -o /dev/null "http://127.0.0.1:$port/"

# --- 1. a full run over HTTP (hourly class) ----------------------------------------------------
BACKUP_BLOB_BASE_URL="http://127.0.0.1:$port/container" BACKUP_BLOB_SAS='sp=cw&sig=SECRETSIG' \
    bash "$HERE/gen7-backup.sh" > "$work/run1.log" 2>&1 || { cat "$work/run1.log"; fail "first run failed"; }
grep -q SECRETSIG "$work/run1.log" && fail "the SAS token appears in the log"
pass "backup run succeeds and does not log the SAS token"

run1=$(ls -1 "$GEN7_BACKUP_ROOT" | grep -E '^[0-9]{8}T[0-9]{6}Z$' | head -1)
[[ -n "$run1" ]] || fail "no completed local run"
blob="$work/blob/container/gen7-vm/hourly/$run1"
count=$(ls -1 "$blob" | wc -l)
expect "$count" 8 "uploaded file count"
(cd "$blob" && sha256sum -c SHA256SUMS >/dev/null) || fail "uploaded files do not match SHA256SUMS"
pass "8 files uploaded under hourly/<run> and every checksum verifies"

expect "$(grep -c '"md5_ok": true' "$work/put.log")" 8 "every PUT carried a correct Content-MD5 and block blob header"
[[ "$(tail -1 "$work/put.log")" == *"/MANIFEST.json"* ]] || fail "MANIFEST.json was not uploaded last"
grep -q 'sig=SECRETSIG' "$work/put.log" || fail "the SAS query was not sent"
pass "uploads are checksum-verified by the server, the manifest goes last, and the SAS rides on the request"

python3 - "$blob/MANIFEST.json" <<'PY' || fail "manifest content"
import json, sys
m = json.load(open(sys.argv[1]))
names = {f['name'] for f in m['files']}
assert names == {'hub-mongo.archive.gz', 'desk-mongo.archive.gz', 'hub-postgres.dump', 'hub-postgres-globals.sql',
                 'hub-redis.rdb', 'hub-email-journal.jsonl'}, names
assert all(f['bytes'] > 0 for f in m['files'])
PY
# An exact byte search: grep on binary data is not reliable for this check.
python3 -c 'import sys; d = open(sys.argv[1], "rb").read(); sys.exit(0 if b"marker" in d and b"restored-ok" in d and b"job1" in d else 1)' "$blob/hub-redis.rdb" || fail "the Redis snapshot is missing the seeded key or queue"
grep -q 'emailQueue:1' "$blob/hub-email-journal.jsonl" || fail "relay journal not captured"
pass "manifest lists all six stores; Redis and relay journal captured"
python3 -c 'import json,sys;s=json.load(open(sys.argv[1]));assert "last_success" in s' "$GEN7_BACKUP_STATE/status.json" || fail "status.json"
pass "status.json records the last success"

# --- 1b. managed identity: a bearer token from the identity endpoint, no SAS and nothing stored ---
sleep 1
lines_before=$(wc -l < "$work/put.log")
BACKUP_BLOB_BASE_URL="http://127.0.0.1:$port/container-mi" BACKUP_BLOB_SAS= BACKUP_AUTH=managed-identity \
    BACKUP_IMDS_URL="http://127.0.0.1:$port/imds/token" bash "$HERE/gen7-backup.sh" > "$work/run-mi.log" 2>&1 \
    || { cat "$work/run-mi.log"; fail "managed identity run failed"; }
python3 - "$work/put.log" "$lines_before" "$work/run-mi.log" <<'PY' || fail "managed identity upload checks"
import json, sys
log, skip, run = sys.argv[1], int(sys.argv[2]), sys.argv[3]
rows = [json.loads(line) for line in open(log).read().splitlines()[skip:]]
tokens = [r for r in rows if r.get('imds')]
puts = [r for r in rows if 'path' in r]
assert len(tokens) == 1, 'expected exactly one token request per run'
assert len(puts) == 8, len(puts)
assert all(r['auth'] == 'bearer' and r['query'] == '' and r['md5_ok'] for r in puts), puts
assert puts[-1]['path'].endswith('/MANIFEST.json')
assert tokens[0]['token'] not in open(run).read(), 'the token appears in the run log'
PY
pass "managed identity: one token per run, every upload carries it, no SAS is sent, the token stays out of the log"

before_mi=$(find "$work/blob/container-mi/gen7-vm/hourly" -name MANIFEST.json | wc -l)
sleep 1
set +e
BACKUP_BLOB_BASE_URL="http://127.0.0.1:$port/container-mi" BACKUP_BLOB_SAS= BACKUP_AUTH=managed-identity \
    BACKUP_IMDS_URL="http://127.0.0.1:1/imds/token" bash "$HERE/gen7-backup.sh" > "$work/run-mi-down.log" 2>&1
code=$?
set -e
[[ "$code" -ne 0 ]] || fail "a run succeeded with the identity endpoint unreachable"
expect "$(find "$work/blob/container-mi/gen7-vm/hourly" -name MANIFEST.json | wc -l)" "$before_mi" "a run without a token uploaded something"
expect "$(ls -1 "$GEN7_BACKUP_ROOT" | grep -c partial || true)" 0 "partial run kept after a token failure"
python3 -c 'import json,sys;s=json.load(open(sys.argv[1]));assert "last_failure" in s' "$GEN7_BACKUP_STATE/status.json" || fail "token failure not recorded"
pass "without a working identity the run fails, uploads nothing and records the failure"

# --- 2. file sink, retention classes and pruning ---------------------------------------------
sleep 1
export BACKUP_BLOB_BASE_URL="file://$work/sink"
GEN7_BACKUP_FORCE_CLASSES="hourly daily monthly" GEN7_BACKUP_KEEP_LOCAL=2 bash "$HERE/gen7-backup.sh" >/dev/null 2>&1 || fail "second run failed"
sleep 1
GEN7_BACKUP_KEEP_LOCAL=2 bash "$HERE/gen7-backup.sh" >/dev/null 2>&1 || fail "third run failed"
expect "$(ls -1 "$work/sink/gen7-vm" | sort | tr '\n' ' ')" "daily hourly monthly " "retention classes"
expect "$(ls -1 "$GEN7_BACKUP_ROOT" | grep -cE '^[0-9]{8}T[0-9]{6}Z$')" 2 "local runs after pruning"
expect "$(ls -1 "$GEN7_BACKUP_ROOT" | grep -c partial || true)" 0 "partial runs left behind"
pass "hourly, daily and monthly prefixes are written; local copies are pruned to the newest 2"

# --- 3. failure leaves nothing that looks complete -------------------------------------------
before=$(ls -1 "$work/sink/gen7-vm/hourly" | wc -l)
docker stop "$rd" >/dev/null
if bash "$HERE/gen7-backup.sh" >"$work/fail.log" 2>&1; then fail "run succeeded with Redis stopped"; fi
expect "$(ls -1 "$work/sink/gen7-vm/hourly" | wc -l)" "$before" "a failed run uploaded something"
expect "$(ls -1 "$GEN7_BACKUP_ROOT" | grep -c partial || true)" 0 "partial run kept after failure"
python3 -c 'import json,sys;s=json.load(open(sys.argv[1]));assert "last_failure" in s' "$GEN7_BACKUP_STATE/status.json" || fail "failure not recorded"
docker start "$rd" >/dev/null; until_ok docker exec "$rd" redis-cli ping
pass "a run with Redis down fails, uploads nothing, leaves no partial run and records the failure"

# --- 4. overlapping runs are skipped -----------------------------------------------------------
( exec 9>"$GEN7_BACKUP_STATE/lock"; flock 9; sleep 6 ) &
holder=$!
sleep 1
set +e; bash "$HERE/gen7-backup.sh" >/dev/null 2>&1; code=$?; set -e
wait "$holder"
expect "$code" 75 "overlap exit status"
pass "an overlapping run exits 75 and does nothing"

# --- 5. restore ------------------------------------------------------------------------------
sleep 1
bash "$HERE/gen7-backup.sh" >/dev/null 2>&1 || fail "run before restore failed"
latest=$(ls -1 "$GEN7_BACKUP_ROOT" | grep -E '^[0-9]{8}T[0-9]{6}Z$' | tail -1)
docker exec "$hm" mongosh --quiet --eval 'db.getSiblingDB("main").dropDatabase()' >/dev/null
docker exec "$dm" mongosh --quiet --eval 'db.getSiblingDB("desk").dropDatabase()' >/dev/null
docker exec "$pg" psql -U fixture -d hubsql -q -c 'drop table cash'
bash "$HERE/gen7-restore.sh" "$GEN7_BACKUP_ROOT/$latest" >/dev/null || fail "verify-only restore failed"
set +e; bash "$HERE/gen7-restore.sh" "$GEN7_BACKUP_ROOT/$latest" --apply >/dev/null 2>&1; code=$?; set -e
expect "$code" 2 "restore without --writers-fenced"
pass "restore verifies by default and refuses to overwrite unless writers are declared fenced"

bash "$HERE/gen7-restore.sh" "$GEN7_BACKUP_ROOT/$latest" --apply --writers-fenced --with-globals >"$work/restore.log" 2>&1 || { cat "$work/restore.log"; fail "restore failed"; }
expect "$(docker exec "$hm" mongosh --quiet --eval 'db.getSiblingDB("main").shifts.countDocuments()' | tr -d '\r')" 3 "Hub Mongo documents restored"
expect "$(docker exec "$dm" mongosh --quiet --eval 'db.getSiblingDB("desk").assets.countDocuments()' | tr -d '\r')" 2 "Desk Mongo documents restored"
expect "$(docker exec "$pg" psql -U fixture -d hubsql -Atc 'select count(*) from cash' | tr -d '\r')" 3 "PostgreSQL rows restored"
pass "after dropping all three databases, restore brings back every document and row"

# --- 6. a damaged backup is refused ----------------------------------------------------------
cp -r "$GEN7_BACKUP_ROOT/$latest" "$work/damaged"
printf 'x' >> "$work/damaged/hub-postgres.dump"
if bash "$HERE/gen7-restore.sh" "$work/damaged" >/dev/null 2>&1; then fail "a modified backup was accepted"; fi
pass "a backup whose file no longer matches its checksum is refused"

# --- 7. a wrong or missing project must say so on the console, not fail silently -------------
set +e
GEN7_HUB_PROJECT=no-such-project bash "$HERE/gen7-backup.sh" > "$work/lookup.log" 2>&1
code=$?
GEN7_HUB_PROJECT=no-such-project bash "$HERE/gen7-restore.sh" "$GEN7_BACKUP_ROOT/$latest" --apply --writers-fenced > "$work/lookup-restore.log" 2>&1
code_restore=$?
set -e
[[ "$code" -ne 0 && "$code_restore" -ne 0 ]] || fail "a run against a missing project succeeded"
grep -q 'expected exactly one running no-such-project/mongo container' "$work/lookup.log" || fail "the backup job did not say which container it could not find"
grep -q 'expected exactly one running no-such-project/mongo container' "$work/lookup-restore.log" || fail "the restore script did not say which container it could not find"
pass "a missing container is named in the error, for both the backup and the restore script"

echo "ALL $checks CHECKS PASSED"
