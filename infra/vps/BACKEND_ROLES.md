# Hub backend processes on the VPS

One backend image now runs three Compose services:

| Service | Entry point | Responsibility |
| --- | --- | --- |
| backend | node api.js | HTTP routes and authenticated Socket.IO connections; queue producers |
| worker | node worker.js | The existing 15 BullMQ consumers |
| scheduler | node scheduler.js | The existing 18 active cron registrations |

All three use the existing MongoDB, Redis, PostgreSQL, and integration settings.
Only the API receives browser requests. Worker and scheduler health endpoints
are internal. Existing queue names, schedules, timezones, processor options,
and disabled schedules are preserved. No Azure worker service is provisioned.

Background notification events travel over Redis Pub/Sub to the API's existing
Socket.IO user rooms. Pub/Sub is best effort, as browser notifications were;
persisted notifications remain the source of truth. Email attachment paths are
resolved into base64 contents before enqueueing so separate filesystems work.

## Deployment

Use a feature branch and the normal PR into main. Merging backend, Compose,
or VPS deployment changes triggers the existing deployment workflow. That
workflow builds one image and deploys all three roles under its existing flock.
No new GitHub secret or variable is needed.

The rollout coordinator validates settings against the current backend before
changing applications. Unexpected drift fails before draining. To apply an
approved `SAGE_CLIENT_SECRET` rotation, manually dispatch **Deploy to Server**
on `main` with `service=backend` and `rotate_sage_client_secret=true`. The
candidate must be nonblank and identical across all three roles. Other settings
must pass the usual validation. An automatic push deployment uses strict
validation, including the automatic run that can follow merging a change under
`infra/vps/`. Coordinate that merge as a production deployment. CDN routing is
still checked by the existing migration preflight and remains pointed at Azure.

The coordinator records each queue's original pause flag in
`~/.hub-backend-runtime/<run-id>/state.json`, pauses those 15 queues, and allows
up to ten minutes for active jobs to finish. API requests can continue adding
jobs while queues are paused. It then stops the previous runtime, starts the
API, runs PostgreSQL migrations, starts worker and scheduler, verifies role
health/counts, and restores the original pause flags. Queues already paused
remain paused. No jobs, Redis data, or database volumes are deleted.

There is a brief API interruption while replacing the backend. Ten-minute
graceful stops are bounded: tasks longer than this can still be interrupted.
BullMQ's existing stalled-job recovery and application idempotency still apply.
The initial legacy backend has no new graceful cron handler; perform the first
rollout away from scheduled job times and check for an active report/export.

The scheduler uses a renewable Redis lease and seven-day per-tick claims.
Another scheduler waits for leadership; a lost lease stops new callbacks and
exits the process. This prevents ordinary duplicate registrations/failover
ticks, but does not provide exactly-once external side effects or catch up
missed schedules. Do not run `node app.js` alongside the separated worker.

## Failure and recovery

A failed start or health check stops all three new roles before restoring the
previous image as a combined `node app.js` backend. Only after that backend is
healthy are queues restored. Automatic rollback also restores the previous Sage
client secret for a rotated deployment. PostgreSQL schema changes are not
reversed by an image rollback; keep migrations backward compatible as before.

If containers cannot be stopped or rollback fails, queues stay paused. The
checkpoint survives; a later deployment refuses unfinished checkpoints. Under
the same deployment flock, from `/home/gen7fuel/thehub`, an operator can run:

```sh
python3 infra/vps/deploy-backend-roles.py --recover RUN_ID
```

Recovery validates project/container ownership and image tags, stops all roles,
restores the prior combined backend, verifies health, then restores pause flags
using the new image's queue helper. Credentials are read from the existing
backend container into process memory. If that container has been removed,
recovery refuses; reconstruct the original environment through the deployment
workflow before proceeding. If an interrupted rotation already replaced the
backend, manual recovery will reuse that container's new Sage secret. Confirm
which authorized credential this recovery should use before resuming queues.
Do not delete checkpoints or blindly resume queues.
Never use `docker compose down` for rollback: database volumes are shared.

`python3 infra/vps/deploy-backend-roles.py` without flags is read-only. It
requires the same exported image/integration settings as the deployment workflow.

## Verification

```sh
cd backend && npm ci && npm test
# From repository root:
python infra/vps/test_deploy_backend_roles.py
docker build -t hub-runtime-rehearsal:local backend
python infra/vps/rehearse-runtime.py
```

The last command creates and removes only a uniquely named local Compose
project, with synthetic credentials, no published ports, an internal network,
and fresh MongoDB/PostgreSQL/Redis instances. It exercises an authenticated API
email request, jobs waiting until worker startup, producer-file deletion before
attachment delivery, HTTP failure retention, private authenticated Socket.IO
delivery from a background process, queue pause restoration, scheduler lease
competition, and clean shutdown. CI runs this rehearsal on pull requests.

For the separate transport check, start the local Postman simulation:

```sh
postman simulation run postman/simulations/hub-runtime.sim.yaml --port 4027 --no-history --output ndjson
EMAIL_SERVICE_URL=http://127.0.0.1:4027/email node backend/scripts/check-email-http.cjs
```

After production deployment check API/worker/scheduler health and restart counts,
an ordinary Hub/Desk page and purchase order, one controlled queued job, and
the next scheduled execution. Observe memory, queue failures/stalled jobs, and
scheduler logs through at least one normal daily cycle before moving to Azure.
