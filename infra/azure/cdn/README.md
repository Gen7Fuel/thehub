# Native CDN App Service deployment

## Completed online baseline: 16 November 2026, 21:01 UTC

[Run 43953172968](https://github.com/Gen7Fuel/thehub/actions/runs/43953172968)
copied and independently SHA-256 read-back verified **10,402 files /
34,253,603,616 bytes** in 15 minutes 12 seconds. Source-snapshot, final-source
and destination manifests match:
`8bfb7970709760b94bab783ecf160835605e43ef6fc5e130fd3f9fbb123d0c4a`.
Source ETags/inventory were unchanged during this interval. Source remains live;
a final delta is still required before cutover.

[Baseline/retention summary](diagnostics/media-copy-baseline-43953172968.json)
records validation of all per-file receipts and private retention of inventory,
receipts, summary and ZIP under the new container's
`_migration/cdn/evidence/43953172968/` prefix. Their uploaded bytes were read back
and hashed. [API validation](diagnostics/media-api-summary-43953172968.json)
checked **all 105 listing pages**, every filename/size/original date, month totals,
and historical JPEG download hashes/MIME types/ranges. Final health is Azure
storage, release `e5172022`, paused and drained. No production switch occurred.

The repository is public. Full inventories and real-file API reports stay in
private Azure storage; GitHub gets only an allowlisted aggregate summary.
Detailed local API records are Git-ignored. Private evidence download uses
`media-copy-workflow.cjs download RUNID` with the operator's Azure sign-in.
The former full GitHub artifact was removed after verified private retention.
The migration identity now trusts only `cdn-media-copy-v2`, so older workflow
source cannot authenticate and republish a full artifact. Both prior
environments lost their migration client-ID variables.

The original jobless run remains isolated and its standalone workflow disabled.
Both enable flags are false; target stays `vps`. The patched **Azure preview /
source lock** audits clean; the live VPS image was preserved. Current tests:
31 passed, three gated skips. Infrastructure, helpers and aggregate records are
published; original working-tree changes remain intact. See
[remaining cutover preparation](../../../docs/migration/cdn-azure-cutover-preparation.md).

## Current follow-up: patched preview and online baseline

Runtime dependencies were patched within their existing compatibility lines:
Express 4.22.3, sharp 0.35.5, uuid 11.1.1, proxy-addr 2.0.8, qs 6.16.2,
body-parser 1.20.9 and path-to-regexp 0.1.13. The
[saved audit](diagnostics/dependency-audit-2026-11-16.json) reports **zero
vulnerabilities**. The suite now has 30 passing tests and three gated skips,
including six safety/integrity cases for the new Blob-to-Blob runner.

Current app release is `e517202260ca383bfe573dd46496d326c980ec5d`, deployed by
[successful run 43946052876](https://github.com/Gen7Fuel/thehub/actions/runs/43946052876).
The dependency-only release also passed the full 101-file live suite. Health
now includes `processStartedAt`. CLI restart returns before worker replacement;
the earlier live checks could return the old worker's health. A stricter
[follow-up](diagnostics/restart-process-verification-2026-11-16.json) waited for
a different, later process timestamp after both restarts and confirmed unpause
and pause persistence. The preview ends healthy, paused and drained.

Source inventory is 10,381 files / 34,160,428,130 bytes with checksum/date
metadata. The backup worker completed October/November archives, whose current
ETags and completion sidecars still match. November's later live inventory
exceeds that earlier backup by 118 files, so fresh delta/backup coordination
remains required before cutover. See [backup evidence](diagnostics/backup-verification-2026-11-16.json).

The first standalone run became orphaned. The completed replacement and final
evidence policy are recorded above.
See [copy design](../media-copy/README.md) and
[cutover preparation](../../../docs/migration/cdn-azure-cutover-preparation.md).
Both the current CDN Terraform definitions and the VPS workflow cutover guard
are now published. Production target remains `vps`; preview dispatch is disabled.
No production routing, source writer pause, shared storage setting or VPS
service has changed. Historical advisory/unpublished-source statements below
are superseded by this follow-up.

## Latest status: paused Azure preview deployed and verified

The [first GitHub deployment](https://github.com/Gen7Fuel/thehub/actions/runs/43941995145)
completed successfully for release `3c23d057d40a6e41ada44caf7e9d62bd4504001c`.
Oryx built native Linux dependencies on Node 24; OIDC deployment, runtime
managed-identity issuance, storage access and resolved vault configuration work.

[Controlled live verification](diagnostics/preview-verification-2026-11-16-conditional-header.json)
passed: multipart/base64 uploads, native PNG conversion, exact downloads, HEAD,
valid/invalid ranges, conditional 304 responses, authenticated admin routes,
real listings across 101 tiny temporary files, deletion, and two actual App
Service restarts. Explicit unpause survived one restart; final pause/drain
survived another. All 101 test files were deleted and current destination
inventory is empty. Soft-deleted versions may remain under the retention policy.
Final health: Azure storage, expected release, **paused=true, drained=true**.
The new account contains no copied production media.

The first live attempt stopped at a test-client cache-header mismatch (200
instead of 304), removed its one uploaded file and restored pause. Its evidence
is retained separately; the corrected request passed without runtime changes.
The guard accepts an explicit safe run label so retests never overwrite records.

`CDN_DEPLOY_TARGET=vps` is unchanged and `CDN_AZURE_PREVIEW_ENABLED=false` again.
No VPS deployment/restart, routing change, media migration or cutover occurred.
Production activation still requires dependency remediation, verified source
backup, a source-to-new-account copy/delta/verification plan, producer coordination,
and review of hardcoded callers/routing. Current preview tests do not establish
production-load sizing or conversion memory limits for large images.

The provisioned Terraform source, operational helpers and evidence remain local
uncommitted work. Only the ten runtime/test/Azure-workflow files were published;
the original branch and unrelated changes were preserved. The prepared VPS
workflow cutover guard is still local and must be published before cutover.

On 16 November 2026 Terraform created the remaining four resources: the Canada
East Linux web app, its runtime vault/media grants, and GitHub's app-scoped
deployment grant. The post-apply full plan reports **No changes**. Runtime
principal: `99b1876a-1cae-4369-ac2b-655df97195ce`. Azure confirms the enabled
admin token matches the VPS token and its app reference is **Resolved**.
The setup helper was corrected to read the reference collection returned by ARM.

Only ten reviewed CDN runtime/test/workflow files were published from an
isolated checkout as `3c23d057d40a6e41ada44caf7e9d62bd4504001c`. The commit
uses `[skip ci]` to prevent an automatic VPS deployment; the Azure workflow was
manually dispatched. GitHub Linux tests and OIDC login passed. Deployment run:
https://github.com/Gen7Fuel/thehub/actions/runs/43941995145.
Repository target remains `vps`; the preview flag was enabled for this run and
disabled again after dispatch.
No production media, routing, workers or VPS services have changed. The existing
seven dependency advisories still require remediation before production activation.

`scripts/preview-workflow.cjs` manages guarded preview dispatch/status and the
preview flag. `scripts/verify-preview.cjs` is a one-run controlled live check:
it requires the expected release and an empty destination inventory, tracks
every returned upload UUID, tests the API plus actual App Service restarts,
deletes only its own files, and restores paused/drained state. Credentials stay
in memory and sanitized evidence is saved under diagnostics.

## Latest status: Canada East B1 created, 16 November 2026

The empty Free Canada East diagnostic plan was subsequently removed through
its separate Terraform state at the user's request. The B1 plan remains intact.

Following the successful Free Linux comparison, the user authorized B1 creation
in Canada East. Terraform created `gen7erp-cdn-prod`, Linux Basic B1, capacity 1,
directly in the existing CDN remote state. **Paid compute billing now applies.**
Only the hosting plan was applied: 1 addition, no changes or deletions. A full
follow-up plan reports **4 additions, 0 changes, 0 deletions**: web app and three
role grants. CLI confirms B1 / Basic / Canada East / capacity 1; no web apps exist.

Hosting now explicitly uses Canada East; the future app inherits its plan's
location. Existing vault, identity and storage stay in Canada Central. This
creates a cross-region app/storage arrangement to validate during preview.
No media, production routing, application deployment, or VPS service was changed.
The empty Free diagnostic plan remains separately tracked. Historical Canada
Central failures below remain valid evidence, but no longer block east hosting.
Replan before continuing the remaining four resources; never apply old saved
plans targeting Canada Central. The old Canada Central price estimate must be
rechecked for Canada East before treating it as a current regional estimate.

Status: partially provisioned on 16 November 2026; App Service creation is blocked
by a quota-enforcement discrepancy. Public B1 and regional quotas show 0/30,
while creation returns limit 0. No application code or GitHub workflow was deployed, and
no production routing or storage configuration was switched. State storage and
the empty media destination remain in place.

## Provisioning record and quota prerequisite

The approved nine-addition plan was checked for exact create-only resource
addresses before applying. Four resources were created successfully:

- User-assigned identity `gen7erp-cdn-github-prod`.
- Its `github-cdn-production` federated credential, issuer GitHub Actions,
  audience `api://AzureADTokenExchange`, subject
  `repo:Gen7Fuel/thehub:environment:cdn-production`.
- Vault `gen7erp-cdn-29b24248`, RBAC enabled, purge protection enabled,
  90-day soft-delete retention.
- The operator's Key Vault Secrets Officer assignment at that vault.

Azure rejected the B1 App Service plan with HTTP 401 and extended error 70007:
current **B1 VMs limit 0**, usage 0, required instances 1, minimum new limit 1.
The requested region is Canada Central. No alternate region or SKU was selected,
and no quota/support request was submitted. No App Service compute plan exists,
so the proposed B1 compute charge has not started.

Partial state is recorded at `tfstate/cdn/production.tfstate` in
`gen7erptf29b24248`, verified with metadata timestamp 16:45:19 UTC. After provider
schema cleanup, validation passed and a fresh continuation plan contains exactly
**5 additions, 0 changes, 0 deletions**: the service plan, app, runtime vault grant,
runtime media grant, and GitHub app deployment grant. Resume through a reviewed
fresh plan after quota is approved; do not rerun the original create-nine plan.

The admin token was transferred from the running VPS CDN directly into the vault
as enabled secret `cdn-admin-token`. The value was compared in memory and matched.
It was not printed, passed in command arguments, written to a temporary file,
or supplied to Terraform. The existing vault reference in the app proposal cannot
resolve until the app and runtime vault grant exist; that verification remains
pending. The source token and VPS configuration were not changed.

GitHub setup was completed and rechecked idempotently:

- Environment `cdn-production` exists and permits only the `main` branch.
- Environment variable `AZURE_CDN_CLIENT_ID` matches the new Azure identity.
- Repository variable `CDN_DEPLOY_TARGET=vps` explicitly preserves VPS deployment.
- `CDN_AZURE_PREVIEW_ENABLED` remains unset/disabled; no workflow was dispatched.
- The future identity's Website Contributor grant is still pending app creation.

The repository includes `scripts/configure-access.cjs github|vault` as the
operator-only repeatable setup helper. It uses the existing Git credential helper
and Azure CLI sign-in, rejects conflicting existing values, and keeps credential
values in memory. Its Azure CLI Python executable path is Windows-specific.
Running `vault` after successful app provisioning also refreshes and verifies the
app's Key Vault reference. Provisioning remains exclusively Terraform's job.

The original quota-increase suggestion below is superseded by the investigation:
visible limits are 30, not 0. See the [diagnostic record](diagnostics/quota-investigation.md)
and its unsubmitted Microsoft investigation draft before requesting any increase.

A subscription-level Quota Request Operator or equivalent can inspect
Azure Portal **Quotas > App Service (Public Preview)** for subscription
**Gen7Fuel**, region **Canada Central**, SKU **B1**. The current total limit is
30; do not request 1 based on the historical error. The next useful action is
investigating the conflicting enforcement response with Microsoft. Group-level
administration alone does not provide subscription quota-request permissions. See Microsoft's
[App Service quota guidance](https://learn.microsoft.com/en-us/troubleshoot/azure/app-service/troubleshoot-non-zone-redundant-quota-requests).

## Infrastructure proposal

### Quota discrepancy follow-up: 16 November 2026

A later read-only check of the same Gen7Fuel subscription's Microsoft.Web
Canada Central usages endpoint returned **B1 VMs: usage 0, limit 30** and
**Total Regional VMs: usage 0, limit 30**, matching the user's portal view.
Terraform still targets Linux B1, capacity 1, Canada Central in Gen7ERP.
This conflicts with the earlier creation response reporting limit 0. We have
not established whether quota changed after that attempt or the provisioning
backend is enforcing a different restriction. Do not treat current visible
quota as zero, or request a total limit of 1 based on the historical error.
No provisioning retry or quota request was made during this follow-up.
The resource-group failed-activity query returned no matching entries, so it
did not provide additional correlation evidence. A controlled creation retry
or Microsoft investigation is needed to establish whether the denial persists
and which restriction is responsible. The historical creation error above
remains evidence of that failed attempt, not proof of the current quota.

A controlled direct ARM retry at 17:25 UTC subsequently reproduced the denial
with the exact region/SKU and explicitly disabled zone redundancy. Quotas read
before and after remained 0/30, and another API version agreed. Subscription
metadata confirms Enabled / PayAsYouGo / spending limit Off, and Linux B1 location
discovery includes Canada Central. The retry created no hosting plan. This rules
out Terraform-only behavior but does not expose the internal enforcement reason.
The exact payload, error and request identifiers are retained in the linked
diagnostic record. No Microsoft support case or quota request has been submitted.

At the user's request, a subsequent empty Free F1 Linux plan probe in Canada
Central also returned HTTP 401, reporting F1 limit 0 while F1, B1, and total
regional counters each showed 0/30 before and after. No plan or app was created.
This narrows the problem beyond a B1-only paid-tier restriction; the internal
cause remains unresolved. Its request/response and identifiers are in the
linked diagnostic record. Production Terraform remains B1 and unchanged.

The full design contains **9 resources**; four are created and five remain. The ninth resource
is the runtime's Storage Blob Data Contributor assignment, scoped to the new
`gen7erpmedia29b24248/hub` container in Gen7ERP. There is no role assignment or
other change to the old EDW account. The app targets the new, empty media account.
It must not receive historical production traffic until the required files are
copied, verified, and reconciled. The existing `/cdn/download/:id` URLs remain
served by the old service until that handover.

This root uses the existing Azure backend at `cdn/production.tfstate`; its
credential-free `backend.tf` belongs in Git. Apply remains a separate operation.
The compute estimate in the root README is unchanged: one Basic Linux B1 plan.

## Runtime behavior

- Deploy Node.js source directly, not a custom Docker image. App Service/Oryx
  installs native Linux dependencies using the package lock. The ZIP contains
  only runtime source, manifests, and a generated `release.json`; no credentials,
  local uploads, migration state, Windows node_modules, or test artifacts.
- `PORT` controls the listening port; the VPS default remains 5001.
- `AZURE_STORAGE_ACCOUNT_URL` plus `AZURE_CONTAINER` selects managed identity.
  The default is the system-assigned identity; `CDN_AZURE_CLIENT_ID` explicitly
  selects a user-assigned identity if needed later. The legacy connection-string
  mode remains available for VPS. Setting both authentication modes is rejected.
- App Service startup requires Azure storage, a resolved admin token, and a
  persistent absolute control directory beneath `/home`. Unresolved Key Vault
  reference strings are never accepted as admin tokens, including outside Azure.
- `CDN_START_PAUSED=true` initializes a missing maintenance file as paused and
  drained. The persisted state then takes precedence, including an explicit
  operator unpause. Keep one instance; this file and admitted-write counter
  do not coordinate across instances. `CDN_UPLOADS_DIR=/home/cdn-control` stores
  control state, not file contents. Verify /home persistence on the actual host.
- `/cdn` retains its original liveness behavior. `GET /cdn/health` is a new,
  noncached readiness endpoint: it requires a resolved admin token and checks
  container properties through the configured SDK before returning status,
  storage mode, pause/drain status, and release SHA. It performs no blob writes.
  It proves container access, not successful uploads or deletion permission.

## GitHub deployment controls

Both workflows remain unpublished code changes. The existing VPS workflow
remains active; the configured repository variable explicitly selects `vps`.
Only the public client-ID and VPS-target variables were set. Preview is disabled.

| Setting | Scope | Meaning |
| --- | --- | --- |
| `CDN_DEPLOY_TARGET` | Repository variable | Unset or `vps`: existing VPS path; `azure`: CDN changes deploy to Azure and are excluded from VPS CDN rebuild/recreation |
| `CDN_AZURE_PREVIEW_ENABLED` | Repository variable | `true` permits manual Azure preview deployment while the VPS remains authoritative; unset disables it |
| `AZURE_CDN_CLIENT_ID` | `cdn-production` environment variable | Client ID output from the proposed GitHub user-assigned identity |

The new workflow is `.github/workflows/cdn-azure.yml`. It is limited to `main`,
uses a serial deployment concurrency group, runs CDN tests on Linux Node 24,
packages source, authenticates with OIDC, and deploys with `azure/webapps-deploy`.
It resolves the app's actual hostname rather than assuming an Azure DNS format.
It polls readiness until the exact commit is served with Azure storage available.
Manual previews while target is VPS additionally require paused and drained
state. A failed verification fails the workflow; it does not change routing,
enable writes, delete files, or automatically roll back application code.

Before the first preview deployment:

1. Obtain quota, then provision the remaining reviewed CDN infrastructure and
   wait for role propagation.
2. The matching admin token is already populated. After the app exists, refresh
   and confirm its vault reference resolves. Do not print or commit the token.
3. The GitHub environment and client ID are configured, restricted to main.
   The proposed identity grant is scoped to the app and grants no direct access
   to the resource group, Terraform state, or vault secrets.
4. Publish reviewed code/workflows and explicitly enable preview. Dispatch the
   Azure workflow on main. VPS remains the production deployment destination.
5. Validate the actual managed identity, persistent pause controls, uploads,
   conversion, range reads, listings, deletion, and restart behavior with
   isolated temporary files in the new account. Resume writes only for those
   controlled tests; re-pause afterward. This has not been done yet.

Production handover remains separate. Freeze both deployment paths and wait for
in-flight runs before changing `CDN_DEPLOY_TARGET`, since a previously started
VPS run may already have captured the old setting. Inventory/copy/verify the
CDN prefix, pause/drain every producer, reconcile the final delta, update public
routing and internal hardcoded callers, and retire the VPS CDN Compose definition
so a generic Compose startup cannot recreate it. Switch automated deployments
only after the target has passed live checks. No automatic DNS or Compose change
is implemented here.

## Verification evidence and limitations

- Local CDN tests cover legacy behavior plus managed-identity client construction,
  native port handling, persistent startup pause, unresolved secret rejection,
  storage-readiness failures, and rejection of stale releases/active previews.
- The existing Postman outage simulation exercised actual SDK HTTP requests for
  container readiness, upload, download, pagination, and deletion. Every storage
  operation returned retryable 503 without local media fallback. The request log
  confirmed GET container properties, PUT, HEAD, two list GETs, and DELETE.
- Workflow YAML parsing and Terraform validation/planning passed. Linux GitHub
  execution, App Service/Oryx build, and managed-identity token issuance still
  require the first real deployment. Constructor tests do not prove Azure IAM.
- `npm audit` on 16 November 2026 reports seven advisories: one critical, four
  high, two moderate, across the pre-existing Express/transitive packages,
  sharp, and uuid. Their versions are unchanged from the original lock file;
  no advisory was reported for the added Azure Identity packages. Remediation
  should precede production activation; no broad dependency fix was applied
  during this hosting preparation.
- Postman CLI 1.75.0 has no `status` command. The repository's local outage mock
  was reused; no owner-mock cloud search or workspace publishing was performed.

See [infrastructure review](../README.md), [media destination](../media-storage/README.md),
and [CDN service](../../../cdn/README.md).
