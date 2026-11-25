# Azure releases for Hub and Desk

## Build an immutable release

Run each Azure VM workflow manually from `main` with **build_only** selected to
publish Linux amd64 app images and download its `gen7-hub-release` or
`gen7-desk-release` manifest. This works before setting the deployment target and
does not contact the VM. Desk needs the reviewed VM Compose overlay on `main`.
Hub's VM auth image includes the shared models and helper at the same revision.

After activation, a main push affecting app source or VM Compose files builds the
full desired release. The VM promotes only components whose source fingerprints
changed. The active manifest records the actual digests retained for unchanged
components. The workflow checks `main` before dispatch. The host rejects requests
older than the active release so an old rerun cannot roll it back.

## Stage the host with production approval

1. Verify the managed disk and install its [Docker mount guard](README.md). Use
   project names `gen7-hub` and `gen7-desk`. Put Hub's `compose.yaml`,
   `compose.vm.yaml` and `infra/vm/Caddyfile` under `/etc/gen7-deploy/hub`. Put
   Desk's `compose.yaml`, `compose.vm.yaml` and `Caddyfile` under
   `/etc/gen7-deploy/desk`. Their hashes must match the approved release. Stage
   and verify infrastructure changes separately from app image updates.
2. Store each Compose environment at `/etc/gen7-deploy/<app>/runtime.env` with
   root-only permissions. Set `DESK_VM_ENV_FILE` to the protected Desk API
   environment path. Preserve approved data locations, CDN and mail settings.
   Give the host Docker client pull access to the exact GHCR packages. Keep app
   and registry credentials on the host.
3. Run `sudo install -o root -g root -m 0755 infra/vm/deploy-compose.py /usr/local/libexec/gen7-deploy-compose`.
   Create root-owned mode `0700` directories `/var/lib/gen7-deploy`,
   `/var/lib/gen7-deploy/hub` and `/var/lib/gen7-deploy/desk`.
4. Start authorized runtimes using the build-only manifest and the cutover
   procedure. Confirm every service runs once at its recorded digest with the
   expected data ownership. Copy the matching manifest to
   `/var/lib/gen7-deploy/<app>/active.json` with mode `0600`. Afterward use the
   active manifest's image values with `runtime.env` for manual Compose recovery.

## Email relay

The relay is pinned by digest in `compose.vm.yaml`, so it is not a release role and
the dispatcher neither promotes nor restarts it (it uses `--no-deps`). Changing the
relay image or its settings changes the reviewed configuration hash. Stage the new
`compose.yaml`, `compose.vm.yaml` and Caddyfile, publish a fresh release whose
`config` matches, and start or replace `email-service` as part of the cutover or a
maintenance window. Drain the `emailQueue` first, then reconcile any job that was
in flight before replaying it, because a send that the SMTP server accepted but that
was not acknowledged is delivered again on a repeat request.

## Enable automatic deployment after writer handover

Create `hub-azure-production` and `desk-azure-production` GitHub environments
with protected `main` restrictions and the approved review policy. Configure one
Entra federated identity per environment. Verify each repository's current OIDC
subject. Set `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and
`AZURE_VM_ID` as environment variables. Scope VM read and Action Run Command
permissions to the selected VM. Run Command executes as guest root across the
shared VM, so grant it only to trusted deployment environments.
[Azure OIDC](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect) ·
[Azure Compute permissions](https://learn.microsoft.com/en-us/azure/role-based-access-control/permissions/compute)

Merge the VPS guards and fence old runs before setting repository-level
`HUB_RUNTIME_TARGET` or `DESK_RUNTIME_TARGET` to `azure`. Once the authorized
Azure writers are active, create root-owned `/etc/gen7-deploy/<app>/enabled`.
Remove that marker before a handover and wait for the shared
`/var/lib/gen7-deploy/deploy.lock` to clear before stopping writers. Azure allows
one Action Run Command at a time on the VM. If deployments conflict, verify
which release is active before rerunning a current main release.

## Release failure and recovery

Hub backend updates pause queues, drain active jobs and stop the existing split
roles. The dispatcher brings up the API, worker and scheduler, verifies health,
then restores the original queue pause flags. Changes to queue inventory or
migration files require a coordinated release. Desk updates only `api` and
`caddy`. The existing VPS owns the CDN backup during migration. The dispatcher
uses `--no-deps` for application deploys.

On a candidate health failure the dispatcher attempts to restore the previous
digests and original pause flags. If recovery is inconclusive, retain
`pending.json` and the Hub queue checkpoint in the app state directory. Hold
automation while checking running services and recorded queue state. Check for
the exact `gen7-hub-queues-<generation>-<attempt>-<phase>` helper on the VM.
Verify that it has stopped before manually resuming queues. Clear
the journal only after reconciling and verifying `active.json`. If GitHub times
out or the success marker is missing, inspect the VM before rerunning. Azure
cannot cancel an Action Run Command already executing in the VM.
[Azure Action Run Command](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/run-command)
