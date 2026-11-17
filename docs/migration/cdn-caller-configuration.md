# Hub CDN caller configuration

Preparation only: no production environment, routing, deployment or writer state
has changed. Deploy the caller changes before attempting a CDN cutover.

Set `CDN_SERVICE_URL` in the **backend container environment** to the service base
URL, without `/cdn`. Hub callers that previously addressed the internal CDN, including
invoice/BOL workers, automation screenshots, report attachments and the manual
invoice-image migration use this setting. A trailing slash is accepted.

| State | Backend setting |
| --- | --- |
| Existing VPS | Unset (defaults to `http://cdn:5001`) |
| Azure after final delta/cutover | `https://gen7erp-cdn-prod-29b24248.azurewebsites.net` |
| Same-storage VPS rollback | `http://cdn-rollback-vps:5001` |

Production deployment reads the GitHub repository secret `CDN_SERVICE_URL` in
`.github/workflows/main.yml` and exports it for Compose. `compose.yaml` passes
that value into the backend, defaulting to empty when the secret is absent.
Leave the secret absent until the coordinated cutover; the migration operator
must explicitly tell the user when to set it. Changing the secret alone does not
update a running container. Development uses the backend's
existing `env_file`. Set it there or use a reviewed deployment override.
Recreate the backend to apply
environment changes; its workers and cron jobs share that environment. Coordinate
that restart with admitted jobs before cutover. The existing
`UPLOAD_SERVICE_URL` Compose variable is unchanged and is not an alias for this
new setting.

Public links returned by upload helpers, stored filenames, and paths stay
unchanged. `CDN_BASE_URL` / `PUBLIC_CDN_BASE_URL` retain their legacy report-fetch
behavior when `CDN_SERVICE_URL` is unset; the new setting takes precedence for
those internal fetches when configured. Public routing still needs its own
cutover so browser downloads continue to resolve existing links.

There is no automatic fallback for failed uploads: never write to the original
storage account after new-account writes begin. Follow the writer fencing and
same-storage standby procedure in
[the rollback runbook](../../infra/azure/rollback-vps/README.md). Changing the
caller URL does not activate a paused writer or switch public routing. Shared
Azure credentials, backup sources and Desk callers are unchanged.

Validation: `cd backend; npx vitest run __tests__/cdnService.test.js` exercises
default/override resolution, legacy report precedence, invalid settings, real
localhost multipart upload/download with synthetic bytes, stable public links,
and 503 handling without fallback. It does not run live automation or write
production media.

The full backend suite passed: 55 files, 883 tests (17 November 2026). Existing
Redis-dependent tests emitted connection-refused warnings with no local Redis;
all tests completed successfully.
