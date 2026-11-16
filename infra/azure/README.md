# Gen7ERP Azure infrastructure: CDN review

**Completed online baseline:** 10,402 files / 34,253,603,616 bytes were copied
and independently SHA-256 verified in the new account. All three manifests
match, and source ETags were stable during the run. All API pages, sizes,
original dates and historical download samples passed. Full receipts remain
private in Azure; only aggregate evidence belongs in this public repository.
The patched preview is healthy, paused and drained. Production stays on the
VPS/original account; final delta, producer/backup coordination and routing
changes remain before cutover. See the [current CDN record](cdn/README.md).

**Follow-up:** CDN dependency advisories are resolved (saved npm audit: zero).
The patched preview is deployed and its pause state was verified across two
observed new worker processes. The credential-free source, backends and provider
locks for all five Terraform roots are now published. A dedicated migration
identity is scoped only to the new container. The online media baseline run
43949954335 is queued at this update; production source/routing remain unchanged.
See [copy design](media-copy/README.md) and [current CDN record](cdn/README.md).

**Current result, 16 November 2026:** all nine CDN resources are provisioned and
the paused native Node 24 preview in Canada East is deployed through GitHub OIDC.
Post-apply Terraform plan: No changes. Vault resolution and live managed-identity
storage writes/reads/deletion passed. Controlled testing created and removed
101 temporary files, verified listings/ranges/conversion, and verified persisted
maintenance state over actual restarts. The new media inventory is empty again;
no production files have been copied. Preview is healthy, paused and drained.
GitHub target stays `vps`; further preview dispatches are disabled. See the
[current deployment record](cdn/README.md). Historical partial-provisioning
sections below are superseded by that record.

**Diagnostic cleanup:** the empty Free Canada East test plan was subsequently
destroyed at the user's request. The real B1 plan remains in the CDN state.

**Latest update, 16 November 2026:** the authorized Linux B1 plan
`gen7erp-cdn-prod` was successfully created in **Canada East**, capacity 1, via
the existing CDN Terraform state. Paid compute billing now applies. The full
follow-up plan has **4 additions, 0 changes, 0 deletions** (app and three grants).
Existing storage, vault and GitHub identity remain in Canada Central. No app,
deployment, media copy, traffic change or VPS shutdown has occurred. The empty
Free Canada East comparison plan remains separately tracked. See the
[current CDN status](cdn/README.md); the Canada Central blocker and pricing
discussion below are historical and must not be treated as east-region pricing.

Prepared 16 November 2026. **Bootstrap and dedicated media storage provisioned;
remote states verified.** CDN provisioning is partial and blocked by B1 quota;
its vault, GitHub identity, trust, and operator role exist. No application
deployment, production routing change, media copy, or VPS shutdown has run.

## Completed bootstrap: 16 November 2026

The approved bootstrap plan created exactly three resources: state account
`gen7erptf29b24248`, private container `tfstate`, and the signed-in operator's
Storage Blob Data Contributor assignment. No resources were changed or deleted.
Initial blob access briefly returned an authorization error while the new role
propagated; the subsequent access check and migration succeeded without changing
the role or enabling storage-account keys.

Bootstrap state now resides at `tfstate/bootstrap/production.tfstate` in the new
account. The state blob was verified at 16:06:50 UTC. Remote and source state
lineage and all three managed resource IDs matched. A fresh remote-backend plan
returned exit code 0 and **No changes**. HTTPS-only access, TLS 1.2 minimum,
disabled public blob access, and disabled shared-key authentication were checked
on the created account.

`bootstrap/backend.tf` is now the canonical, credential-free backend definition
and belongs in Git alongside the provider lock file. Subsequent checkouts should
run `terraform '-chdir=infra/azure/bootstrap' init`; they must not recreate the
initial local bootstrap. Temporary local recovery state copies remain ignored
by Git. No state payloads or application secrets belong in commits.

Dedicated ERP media storage in Gen7ERP is now provisioned. Its
[deployment record](media-storage/README.md) confirms three new resources, an
empty private `hub` container, and a no-change verification plan. Its remote
backend key is `media-storage/production.tfstate`. The current CDN proposal now
targets the new empty media account and initializes paused. Its runtime code and
[deployment workflow](cdn/README.md) are prepared but have not been deployed.
The hosting-plan attempt returned a zero-quota error. A later read-only check
shows B1 and total regional usage 0 / limit 30, matching the portal; the
discrepancy remains unresolved. A direct API retry reproduced the failure while
both counters remained 0/30; Terraform-only behavior, trial-offer status, and
region/SKU mismatch were not found. See the [investigation record](cdn/diagnostics/quota-investigation.md).
The deployment guide records the created resources, secure secret/GitHub setup,
and the quota request required to finish the remaining five resources.
Production traffic must remain on the old service until data migration is verified.

## Scope and observed Azure configuration

- Subscription: Gen7Fuel (`29b24248-1990-4592-b25d-e6ee8e9db784`).
- Tenant: `21634e14-74fa-410a-8886-4c3f808b58cb`.
- Existing destination group: `Gen7ERP`, Canada Central. It was empty before bootstrap.
- Existing media: account `gen7fuel`, group `EDW_GEN7FUEL`, private container
  `hub`, live prefix `cdn/`. None of these existing resources are managed here.
- Effective management permissions on Gen7ERP include `*`, with no exclusions.
  The Storage, Web, ManagedIdentity, and KeyVault providers must remain registered;
  Web, ManagedIdentity, and KeyVault were confirmed registered during preparation.
- App Service offers Node `24-lts`. The storage and vault names below passed
  availability checks; availability and capacity are rechecked when provisioning.

The resource group is a Terraform data source, never an owned resource. No
existing media storage account, blob, SQL resource, application, or resource
group is imported. No account keys or connection strings are read from existing
media storage. The provider disables automatic subscription provider registration.

## Proposed resources

| Configuration | Resource | Purpose |
| --- | --- | --- |
| bootstrap | Storage account `gen7erptf29b24248` | Dedicated Terraform state; Standard LRS, TLS 1.2, shared-key authentication disabled |
| bootstrap | Private `tfstate` container | Separate bootstrap and CDN state blobs; versioning and 30-day blob/container soft delete |
| bootstrap | Storage Blob Data Contributor assignment | Signed-in operator can access the new state account using Entra authentication |
| media-storage (created) | Account `gen7erpmedia29b24248`, private `hub` container, and operator role | Empty ERP media destination; RA-GRS, versioning, 30-day soft delete; no file copy or cutover |
| cdn | Linux B1 plan `gen7erp-cdn-prod` | One always-on instance; managed Node runtime, no custom Docker image |
| cdn | App `gen7erp-cdn-prod-29b24248` | CDN hosting, HTTPS only, native startup `node index.js`, system-assigned identity |
| cdn | Vault `gen7erp-cdn-29b24248` | Admin-token reference; RBAC, purge protection, 90-day soft delete |
| cdn | Two vault role assignments | App: Secrets User; current operator: Secrets Officer to populate the token outside Terraform |
| cdn | Runtime media role assignment | App can access the new private media container; no change to EDW storage |
| cdn | Identity `gen7erp-cdn-github-prod` and federated credential | GitHub OIDC, bound to `Gen7Fuel/thehub` environment `cdn-production` |
| cdn | Website Contributor assignment | GitHub can deploy only to the new CDN app |

Bootstrap and media storage are complete, each with **3 added, 0 changed, 0
destroyed**. Of nine CDN resources, four were created before the B1 quota error.
The continuation plan proposes **5 additions; no changes or deletes**.
The current operator's object ID is recorded in each plan; replan if a different
operator will own the state/secret management assignments.

The initial Basic plan is a capacity starting point, not a measured production
sizing result. It has no deployment slots and is not a highly available design.
One app instance is intentional: the current maintenance state and admitted-write
counter do not coordinate across instances. A scale-out design is separate work.
Health checking uses `/cdn/health`, which verifies resolved admin configuration
and container access. Original `/cdn` liveness remains available. Logs retain up
to 35 MB of HTTP logs for seven days. Neither
Application Insights nor Log Analytics is provisioned by this proposal.

## Cost estimate

The Azure Retail Prices API returned **CA$0.0253/hour** for **Azure App Service
Basic Plan - Linux / B1 / Canada Central**, queried 16 November 2026. At 730 hours
this is **CA$18.47/month** for the one compute plan. This is a public retail
estimate, not the subscription's negotiated price or a total bill.

State storage/transactions, Key Vault operations, existing media storage,
network egress, and tax are additional. The CDN streams file content from Azure
to users, so outbound traffic may materially exceed the compute charge.
The CDN compute plan is not provisioned, so its compute charges have not started.
The provisioned Terraform state and empty media accounts incur usage-based
storage and transaction charges; no production media is stored in the new account yet.

Reproduce the price lookup in PowerShell:

```powershell
$filter = "serviceName eq 'Azure App Service' and armRegionName eq 'canadacentral' and skuName eq 'B1'"
$url = 'https://prices.azure.com/api/retail/prices?$filter=' + [uri]::EscapeDataString($filter) + '&currencyCode=CAD'
(Invoke-RestMethod -Uri $url).Items |
  Where-Object { $_.productName -eq 'Azure App Service Basic Plan - Linux' -and $_.type -eq 'Consumption' } |
  Select-Object productName, retailPrice, currencyCode, unitOfMeasure
```

## Local review and remote-state bootstrap

All three roots use checked-in Azure backend configurations with separate state
keys. Bootstrap and media storage are complete; CDN records its four created
resources plus a five-resource continuation plan.
`.gitignore` excludes provider caches, state, temporary backend activation files,
and saved plans; the canonical bootstrap backend and provider lock files belong
in Git. Do not publish raw state or
plan JSON: Terraform state can include provider-computed sensitive attributes.
Application secret values are never supplied to Terraform.

From the repository root in a new PowerShell session with Azure CLI and Terraform
on PATH:

```powershell
az account set --subscription 29b24248-1990-4592-b25d-e6ee8e9db784
terraform '-chdir=infra/azure/bootstrap' init -input=false
terraform '-chdir=infra/azure/bootstrap' validate
terraform '-chdir=infra/azure/bootstrap' plan -input=false '-out=bootstrap.tfplan'
terraform '-chdir=infra/azure/cdn' init -input=false
terraform '-chdir=infra/azure/cdn' validate
terraform '-chdir=infra/azure/cdn' plan -input=false '-out=cdn.tfplan'
```

The provisioning sequence below records the original bootstrap process; steps
1 and 2 are complete. Continue at step 3 only when the CDN proposal is approved:

1. Recheck the bootstrap plan and apply only bootstrap. Its initial state must
   be local because the remote backend does not exist yet. Retain that local
   state securely until migration is confirmed. Azure RBAC propagation can delay
   container access; if necessary wait and replan the partially completed root.
2. Copy `bootstrap/backend.tf.example` to `bootstrap/backend.tf`, then run
   `terraform '-chdir=infra/azure/bootstrap' init -migrate-state`. Confirm the
   remote `bootstrap/production.tfstate` exists and `terraform state list` shows
   all three owned resources before removing any temporary local recovery copy.
3. CDN remote backend initialization is also complete. Replan and review before
   applying. **Do not apply a historical plan generated against the temporary
   local backend.** Its remote state key is `cdn/production.tfstate`.
4. Apply the reviewed CDN infrastructure plan. Keep application deployment and
   production routing unchanged. The app is an empty host at this point.

The GitHub identity in this proposal is for application deployments only. It is
not granted access to Terraform state or permission to create infrastructure.
Infrastructure automation, if added, needs a separately scoped identity.

## Application prerequisites before deployment or cutover

The runtime and workflows are now prepared; no application code or infrastructure
has been deployed by that preparation. Unrelated working-tree changes and VPS
Compose configuration were preserved. Remaining steps are documented in the
[CDN deployment guide](cdn/README.md):

1. Resolve the B1 quota block and provision the five remaining CDN resources.
   Runtime code now supports
   `PORT`, managed identity and persistent startup pause; legacy VPS mode remains.
2. Validate managed-identity storage access on the actual App Service. Local
   tests establish client configuration and error handling, not Azure IAM.
3. The matching `cdn-admin-token` is now populated outside Terraform. After app
   creation, confirm App Service resolves its Key Vault reference before
   exposing admin endpoints. An unresolved reference must never be accepted as
   an admin token. Do not deploy code while this is unresolved.
4. Verify the proposed runtime role assignment at the NEW `hub` container scope
   after provisioning and RBAC propagation. No access grant on old EDW storage
   is needed for this preview. The role includes all prefixes in the new container.
5. Initialize persistent maintenance state under `/home/cdn-control` in a paused
   state before production handover. Confirm `/home` persistence on the target.
   Keep exactly one production writer; deployment restarts must drain correctly.
6. GitHub environment `cdn-production`, main-only branch policy, public client ID,
   and VPS deployment target are configured. The new workflow remains unpublished
   and preview remains disabled. Follow its
   preview/cutover variable controls before publishing or dispatching it.
7. Validate downloads, byte ranges, list pagination, every upload format,
   conversion memory usage, token resolution, and error behavior. Any live
   writes use isolated temporary test files and remove only those files.
8. Verify the current automated backup, pause/drain the source CDN and active
   callers, update public routing and hardcoded `http://cdn:5001` consumers,
   verify the new endpoint, then activate Azure writes and retire the VPS CDN
   deployment. Preserve existing `/cdn/download/:id` URLs.

The planned Azure CDN uses a DIFFERENT storage account. Copy and verify the
needed files before moving production reads. After switching writes, rollback
needs reconciliation; the old Blob account and retained VPS uploads are not
automatically updated. No public DNS, reverse-proxy, Compose, or database setting
has changed. GitHub controls explicitly retain VPS as target and disable preview.
Code and workflow edits remain uncommitted.

## References

- [Terraform Azure backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
- [App Service GitHub Actions deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Existing CDN migration record](../../cdn/MIGRATION.md)
- [Recent CDN backup deployment record](../../docs/migration/cdn-daily-backup-deployment.md)
