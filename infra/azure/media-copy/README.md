# Online CDN media baseline

This root owns only the temporary migration identity `gen7erp-media-copy`, its
GitHub `cdn-media-copy-v2` environment federation and Storage Blob Data Contributor grant on the
**new** `gen7erpmedia29b24248/hub` container. No permissions or configuration in
the original account are changed. Its remote state is
`media-copy/production.tfstate`. Initial apply: 3 added, 0 changed, 0 destroyed;
post-apply plan: No changes. Disable workflow dispatches after each authorized
run. Retain the scoped identity until final delta work is complete, then retire
it through this root.

The manual [Azure workflow](../../../.github/workflows/cdn-azure.yml), using
dispatch input `mode=media-copy`, requires main, environment `cdn-media-copy-v2`,
`CDN_DEPLOY_TARGET=vps` and explicit
`CDN_MEDIA_COPY_ENABLED=true`. It tests and audits first, signs into Azure with
OIDC, then runs [copy-media.cjs](../../../cdn/scripts/copy-media.cjs).
Existing GitHub secret `AZURE_STORAGE_CONNECTION_STRING` is supplied only to
the copy step. It must resolve to `gen7fuel`; source container is fixed to `hub`
and prefix fixed to `cdn/`. No credentials, connection strings or SAS values
are written to reports or emitted in errors.

Each source object must have SHA-256 and original-date metadata. A synchronous
Azure server-to-server copy uses a ten-minute, read-only, single-blob source
SAS and pins the source ETag. Writes require an absent destination, or the
matching ETag of an existing migration-owned destination. Metadata and MIME
type are preserved. The whole destination is then streamed and SHA-256 hashed,
with both source and destination ETags rechecked. Copied objects are tagged in
metadata with ownership and source ETag, enabling safe retry; every retry still
independently reads all destination bytes. Four workers run concurrently.

Source is never written or deleted. `academy/`, `cdn_backup/`, other prefixes,
signed URLs and shared application settings are untouched. Only new-container
progress JSON is written outside `cdn/`, at
`_migration/cdn/online-copy-status.json`. Full inventory, receipts, summary and
ZIP are retained and read-back verified in private Azure storage under
`_migration/cdn/evidence/RUNID/`. This repository is public: GitHub artifacts
contain **only** `public-summary.json`, with no media identifiers. The first
full artifact was removed after verified private retention. The operator helper
downloads full evidence from private Azure storage, not GitHub artifacts.

The original standalone workflow/run 43949954335 became jobless/queued and
both cancellation APIs returned 409. That workflow is disabled. Its old
`cdn-production` environment lost the migration client-ID variable and its OIDC
subject is no longer trusted by the migration identity, so the orphan cannot
authenticate if GitHub later schedules it. No support message was submitted.
Replacement run 43953172968 completed using the established Azure workflow;
deploy/package jobs were skipped. Federation was later narrowed again to
`cdn-media-copy-v2` so earlier full-artifact source cannot authenticate on rerun.
Both prior environments lost their migration client-ID variables. Further
dispatches are disabled. No GitHub support request was submitted.

Final baseline: 10,402 files / 34,253,603,616 bytes, copied and full SHA-256
read-back verified in 15 minutes 12 seconds. Source inventory/ETags stayed
unchanged. Manifest:
`8bfb7970709760b94bab783ecf160835605e43ef6fc5e130fd3f9fbb123d0c4a`.
All 105 native API listing pages/names/sizes/dates and historical JPEG
hashes/MIME/ranges matched. Azure remains paused/drained; source remains live.

This is an **online baseline**, not a final cutover snapshot. Source writers
remain active and the Azure app stays paused. The summary records whether the
source inventory/ETags changed during the run and always requires a final delta.
It refuses stale/unmanaged destination objects rather than deleting them.
Unexpected state requires review before rerunning. No final reconciliation,
production write switch, routing update or VPS retirement is implemented here.

Before cutover, coordinate a fresh backup and producers, pause/drain the source,
copy/verify additions and changes, review deletions using ownership and ETag
conditions, and compare final counts, bytes and manifests. Backup workers must
read the new live source once new writes are enabled; their current shared
storage settings must not be redirected wholesale. Hub's hardcoded internal
CDN callers and Caddy routing need a separate reviewed change.

[Azure copy API](https://learn.microsoft.com/en-us/rest/api/storageservices/copy-blob-from-url)
documents the conditional copy and 256 MiB source-size limit. The live inventory
maximum observed here was 17,712,756 bytes; larger unexpected files are refused.
