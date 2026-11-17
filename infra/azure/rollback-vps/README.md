# VPS CDN standby and rollback rehearsal

Prepared and rehearsed 16 November 2026. **Public traffic is unchanged.**
The existing production container `cdn` still uses the original storage account.
The separate, warm `cdn-rollback-vps` standby uses **the same new media account
as Azure**, so new production files need no reverse copy for a hosting rollback.
Its control state is currently **paused and drained**.

## Provisioned and tested

- This Terraform root grants the existing VPS backend principal Blob Data
  Contributor **only on the new `gen7erpmedia29b24248/hub` container**. No new
  secret, original-account permission or shared application setting was created.
  Remote state: `rollback-vps/production.tfstate`; one resource added.
- Standby image: `ghcr.io/gen7fuel/thehub-cdn-rollback:6e638442b45424b16570294672eb0c4a5e1066c4`.
  [GitHub build](https://github.com/Gen7Fuel/thehub/actions/runs/43963675103)
  passed 32 tests plus audit with zero findings. Package, media-copy and Azure
  deployment jobs were skipped. Future builds use dispatch `mode=rollback-image`.
- `CDN_AZURE_AUTH_MODE=client-secret` explicitly selects CDN-prefixed identity
  settings. App Service rejects this mode and continues using managed identity.
  The installer selects existing credentials in memory and passes only variable
  names to Docker, with values inherited through the child environment. No
  credentials go into argv, temporary env files, Terraform, reports or Git.
- Standby binds **127.0.0.1:15001**; the isolated test proxy binds
  **127.0.0.1:15002**. Both share the existing proxy network. They are separate
  labelled containers with resource limits. Persistent `cdn_rollback_control`
  stores only standby maintenance state, not media contents.
- Test Caddy configurations/report are under
  `/home/gen7fuel/cdn-vps-rollback-20261116/`. They are not the live proxy config.

[Rehearsal evidence](../cdn/diagnostics/vps-rollback-rehearsal-2026-11-16.json)
records **1.095 seconds** for isolated proxy reload, first standby health and
write activation. A VPS-created test file was read through Azure; after routing
the test proxy to VPS, uploads and native Alpine PNG conversion succeeded and
Azure read those bytes. Pause survived a real standby restart. Both temporary
files were deleted, inventory returned to 10,402, both services ended paused,
and production container ID/start time stayed unchanged. The test proxy was
returned to Azure. This is not a measured production recovery time.

## Actual rollback procedure after a future cutover

1. Freeze both deployment paths and wait for active runs. Verify new Blob
   storage and standby authentication are available. **Do not blindly set
   `CDN_DEPLOY_TARGET=vps`: the legacy VPS workflow could recreate the original
   old-storage container until its deployment definition is migrated.**
2. Pause/drain the Azure CDN and confirm zero admitted writes. If its API is
   unavailable, stop the App Service through Azure control plane and verify it
   is stopped before enabling standby writes. If the active writer cannot be
   fenced, stop and resolve that condition; avoid two independent writers.
3. Change the reviewed public Caddy upstream to `cdn-rollback-vps:5001`, validate
   and reload it. Preserve `/cdn/*` paths. Verify the new storage account and
   expected standby release, then enable standby writes via its authenticated
   maintenance API. Keep Azure stopped/paused.
4. Switch any internal callers that bypass public routing to the standby, and
   check reads, one isolated upload/download/delete, queue behavior and backup
   source. Existing URL references must continue to resolve.
5. Record the active writer and freeze state before resuming deployments. To
   move back to Azure, pause/drain standby first, switch routing, then enable
   Azure writes; both use the same new storage.

The **2–5 minute operational target remains conditional** on completed caller /
production-routing preparation and successful writer fencing. The 1.095-second
measurement covers only the localhost proxy path on a warm standby. Large-image
production load and storage/Azure identity outages were not rehearsed. A shared
storage outage affects both hosts. The old container on the original account
still requires data reconciliation if selected after new-account writes.

The helper `../cdn/scripts/vps-rollback.py` is streamed over SSH with Python
actions `install RELEASE`, `rehearse RELEASE`, or `status`. Rehearsal has an
evidence-exists guard. It never changes public routing or the live container.
Keep standby paused while idle. Rebuild/rehearse after application or existing
credential changes; the installer refuses a conflicting image rather than
silently replacing a running fallback. Remove only these labelled standby/test
resources and their scoped role when the rollback window is explicitly retired.
