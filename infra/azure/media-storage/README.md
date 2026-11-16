# Dedicated ERP media storage

Latest follow-up: the verified online CDN baseline now contains 10,402 files /
34,253,603,616 bytes in `hub/cdn/`. Per-file verification evidence is private
under `hub/_migration/cdn/evidence/43953172968/`. Production remains on the old
account and final delta/cutover are pending. Academy and backup prefixes were
not copied. See the [current deployment record](../cdn/README.md).

Historical provisioning status: infrastructure provisioned on 16 November 2026. No file copy,
application-setting change, or storage cutover has run. Existing production
remains on `gen7fuel/hub` in `EDW_GEN7FUEL`.

## Provisioning record

The fresh plan was checked against the three approved resource addresses and
create-only actions before applying. Terraform completed with **3 added, 0
changed, 0 destroyed**. Remote state is saved at
`gen7erptf29b24248/tfstate/media-storage/production.tfstate`; the blob was verified
at 16:21:22 UTC. A subsequent remote-state plan returned exit code 0 and
**No changes**.

Azure read-only verification confirmed Standard_RAGRS, Hot tier, Canada Central,
flat namespace, HTTPS-only, TLS 1.2 minimum, disabled shared-key authentication,
disabled public blob access, enabled versioning, and 30-day blob/container soft
delete. CORS matches the two production origins. The `hub` container is private,
the operator role is scoped to that container, and its blob listing is empty.
No test files were uploaded. Shared state and provider caches remain excluded
from Git; infrastructure configuration and the lock file belong in the repo.

## Design

The applied plan created exactly three resources in the existing `Gen7ERP` group:

1. Account `gen7erpmedia29b24248`, Standard StorageV2, Hot tier, Canada Central,
   RA-GRS redundancy matching the existing account's redundancy class.
2. Private container `hub`, preserving existing prefix/filename conventions.
3. Storage Blob Data Contributor for the current operator at the new container
   scope. App runtime identities will receive separate grants before cutover.

The account uses a flat namespace. The inspected Hub/Desk paths use the Blob SDK;
they do not require Data Lake directory semantics. Flat namespace permits Blob
versioning, which is unavailable on the existing hierarchical-namespace account.
Both blob and container soft delete retain deleted data for 30 days. Versioning
retains overwritten content. No lifecycle rule deletes current blobs or previous
versions in this proposal; retained versions and deleted objects add storage
cost. Retention/cleanup will need review after real usage is measured.

HTTPS and TLS 1.2 are required; public blob access, shared-key authentication,
SFTP, and local users are disabled. The public HTTPS endpoint remains reachable
for browser media access, but blobs require Entra authorization or valid SAS.
CORS allows GET/HEAD/OPTIONS from the production Hub and Desk origins. CORS is
not authorization. No account keys, SAS tokens, or application secrets are output.

RA-GRS includes asynchronous regional replication and secondary read capability;
it does not guarantee zero data loss in a regional failover. Versioning and soft
delete do not replace an independent backup or protect against account deletion.
Terraform prevents destruction of the account/container while their resource
blocks remain configured; this is not a portal deletion lock.

## State and review

State uses the existing remote backend, key `media-storage/production.tfstate`,
separate from bootstrap and CDN. The credential-free backend belongs in Git.
The existing group is a data source. No original storage account, container,
blob, SAS, CORS rule, lifecycle policy, or role assignment is imported or modified.

From the repository root with Terraform and Azure CLI on PATH:

```powershell
terraform '-chdir=infra/azure/media-storage' init -input=false
terraform '-chdir=infra/azure/media-storage' validate
terraform '-chdir=infra/azure/media-storage' plan -input=false '-out=media-storage.tfplan'
```

Review for three additions, zero changes, zero deletions. Do not apply a saved
plan from an earlier operator/session without reviewing current access and state.

## Workload map and migration boundaries

| Workload | Existing behavior | Required migration work |
| --- | --- | --- |
| CDN API | `cdn/<filename>`, reads/writes via SDK; public links use `/cdn/download/:id` | Copy and read-back verify names, content, MIME types and original dates; pause/drain for final reconciliation; switch only CDN storage settings |
| Desk CDN backups | `cdn_backup/`, including automated worker namespace recorded in deployment docs | Inspect deployed worker version; separate source and backup-destination settings, leases/status and schedules; coordinate worker with storage cutover |
| Academy | `academy/`; database/course references and HLS playlists use direct signed Blob URLs | Rebuild playlists with destination URLs and refresh stored references; test playback/seek; keep source available for legacy links |
| Hub exports and log archives | Shared `AZURE_STORAGE_CONNECTION_STRING` / `AZURE_CONTAINER`, with paths including `hub/logs/` | Keep old destination until separately audited and migrated; do not redirect shared settings as a CDN-only change |

The local Desk checkout does not contain the daily backup worker described in
the 16 November deployment record; read the deployed/authoritative version before
changing its settings. Code in the local checkout is not proof of live behavior.

Current CDN and Desk storage clients use connection strings; Desk also generates
account-key-signed SAS URLs, including ten-year academy URLs. They will not work
unchanged with shared keys disabled. Add managed-identity authentication and an
appropriate user-delegation SAS/playback design before using the destination.
Do not copy existing signed HLS playlists unchanged: they point to the old
account, and retaining those references would leave an unnoticed dependency.

For each migrated workload, first inventory and copy online, verify destination
bytes/metadata, pause all its writers, reconcile final changes/deletions, switch
only its consumers, verify, and resume. Keep one authoritative writer location.
Do not delete original data as part of this infrastructure stage. After new writes
occur, a data rollback requires reconciliation rather than simply changing an
endpoint back. Creating this empty account does not migrate any files.

The CDN hosting proposal now references the new media account and initializes
paused. Its runtime and workflow are prepared, but the host has not been created
or deployed. These roots are independent; creating media storage did not redirect
CDN. Production reads must remain on the old service until required files are
copied and verified. See the [CDN deployment guide](../cdn/README.md).

## Pricing

The Azure Retail Prices API returned the following Canada Central / General
Block Blob v2 / Hot RA-GRS / CAD base rates on 16 November 2026:

| Meter | Retail rate |
| --- | --- |
| Hot RA-GRS Data Stored, initial tier | CA$0.0702 per billed GB/month |
| Hot reads | CA$0.0062 per 10,000 operations |
| Hot geo-redundant writes | CA$0.1544 per 10,000 operations |
| List and create-container operations | CA$0.1544 per 10,000 operations |

For illustration, 100 billed GB is CA$7.02/month for stored data alone. Prices
exclude transfer, replication traffic, additional retained versions and deleted
data, tax, and any negotiated subscription discounts. Region/SKU discovery also
confirmed Standard_RAGRS / StorageV2 in Canada Central with no listed restrictions.

Storage is usage-based, not a fixed compute charge. The initial empty account
does not reserve the historical media capacity. Price estimates must include
current blobs, noncurrent versions, soft-deleted content, backups, reads/writes,
geo-replication transfer, and outbound traffic. The actual total depends on
workload, including academy media and backups beyond the CDN files alone.

## References

- [Blob versioning](https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview)
- [Storage redundancy](https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy)
- [Blob soft delete](https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-overview)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
- [Infrastructure review](../README.md)
