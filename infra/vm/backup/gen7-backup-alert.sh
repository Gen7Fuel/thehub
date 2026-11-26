#!/bin/bash
# Mail an alert about the VM backup job through the private email relay (docker exec into the relay container,
# so the API key never leaves it and no port is published).
#   gen7-backup-alert failure <run> <stage>   a run failed (called by gen7-backup.sh)
#   gen7-backup-alert check                   mail if the newest successful backup is older than the threshold
# Needs BACKUP_ALERT_EMAIL; without it this does nothing and exits 0. Duplicate mail is prevented by the relay's
# Idempotency-Key: one per failed run, and at most one stale-backup mail per hour.
set -euo pipefail
umask 077

TO=${BACKUP_ALERT_EMAIL:-}
STATE=${GEN7_BACKUP_STATE:-/var/lib/gen7-backup}
HUB_PROJECT=${GEN7_HUB_PROJECT:-gen7-hub}
STALE_MINUTES=${BACKUP_ALERT_STALE_MINUTES:-170}
MODE=${1:?usage: gen7-backup-alert failure <run> <stage> | check}

log() { printf '%s [gen7-backup-alert] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
[[ -n "$TO" ]] || { log 'BACKUP_ALERT_EMAIL is not set; no alert sent'; exit 0; }

relay=$(docker ps -q --filter "label=com.docker.compose.project=$HUB_PROJECT" --filter 'label=com.docker.compose.service=email-service')
if [[ $(printf '%s\n' "$relay" | grep -c .) -ne 1 ]]; then
    log "cannot send: expected exactly one running $HUB_PROJECT/email-service container"
    exit 1
fi

send() { # idempotency-key subject body
    python3 - "$TO" "$2" "$3" <<'PY' | docker exec -i "$relay" sh -c \
        'curl -fsS --max-time 30 -X POST http://127.0.0.1:2525/send -H "X-API-Key: $EMAIL_SERVICE_API_KEY" -H "Content-Type: application/json" -H "Idempotency-Key: '"$1"'" --data-binary @- -o /dev/null'
import json, sys
to, subject, body = sys.argv[1:4]
print(json.dumps({'to': to, 'subject': subject, 'text': body}))
PY
}

host=$(hostname -s)
case "$MODE" in
failure)
    run=${2:?run} stage=${3:?stage}
    send "backup-failure:$run" "[Gen7] Backup FAILED on $host (during $stage)" \
"The hourly backup run $run failed during: $stage.
Host: $host

Nothing from this run was uploaded. The previous successful backup, if any, is still in storage.
Check: journalctl -u gen7-backup -n 50, and /var/lib/gen7-backup/status.json.
A 403 during upload usually means the SAS expired (2027-11-25) or the signing key was rotated; see infra/vm/backup/README.md.
Restore and recovery targets: docs/migration-prep/recovery-objectives.md."
    log "failure alert sent for run $run"
    ;;
check)
    verdict=$(python3 - "$STATE/status.json" "$STALE_MINUTES" <<'PY'
import json, sys, time, calendar
path, limit = sys.argv[1], int(sys.argv[2])
try:
    last = json.load(open(path)).get('last_success', {})
    age = (time.time() - calendar.timegm(time.strptime(last['at_utc'], '%Y-%m-%dT%H:%M:%SZ'))) / 60
    print('stale' if age > limit else 'fresh', int(age), last.get('run', '?'))
except Exception:
    print('stale', -1, 'none')
PY
)
    read -r state age run <<< "$verdict"
    if [[ "$state" == fresh ]]; then
        log "backup is fresh (last success $age minutes ago, run $run)"
        exit 0
    fi
    detail="the last successful backup was $age minutes ago (run $run)"
    [[ "$age" == -1 ]] && detail='no successful backup has been recorded on this host'
    bucket=$(date -u +%Y%m%d%H)
    send "backup-stale:$bucket" "[Gen7] No fresh backup on $host" \
"$detail. The alert threshold is $STALE_MINUTES minutes (the job runs hourly).
Host: $host

Possible causes: the timer is not running, runs are failing (look for a separate failure mail), the SAS expired
or the signing key was rotated, or the containers are down.
Check: systemctl status gen7-backup.timer, journalctl -u gen7-backup -n 50, /var/lib/gen7-backup/status.json.
This mail repeats at most once an hour until a backup succeeds."
    log "stale-backup alert sent ($detail)"
    ;;
*)
    echo "unknown mode $MODE" >&2
    exit 2
    ;;
esac
