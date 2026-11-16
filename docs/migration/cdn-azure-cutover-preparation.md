# CDN hosting/storage cutover: remaining preparation

This is a review checklist for a future maintenance window. It does not
authorize or perform a traffic switch. Production remains on the VPS reading
`gen7fuel/hub/cdn/`; the Azure preview remains paused and uses the new account.

## Current source and backup boundary

The read-only inventory found 10,381 current CDN files / 34,160,428,130 bytes,
all with original-date and SHA-256 metadata. Only `cdn/` is in the online copy.
The existing local upload volume predates production Blob writes and is not a
current migration source or automatic rollback target.

The daily backup worker's first full run completed at 15:29:59 UTC on
16 November. October and November TARs have verified sidecars and unchanged
ETags. November then had 1,800 files, compared with 1,918 at the later source
inventory. Source writes remain enabled; the backup and online baseline must
not be represented as a final frozen recovery point.

## Online copy evidence required

Use the manually gated [media-copy workflow](../../.github/workflows/cdn-media-copy.yml).
Require a successful summary, a verified receipt for every inventory file,
matching source-snapshot and destination manifests, and full destination-byte
SHA-256 readback. Review `sourceUnchanged`; even true only describes that run's
observed interval. New changes after it still require a final delta.
The source account and all non-CDN prefixes remain untouched. Keep the workflow
disabled after the authorized run; preserve the report artifact outside GitHub's
90-day artifact retention before relying on it as a permanent migration record.

## Producers and routing to review before the maintenance window

| Area | Required work before source CDN retirement |
| --- | --- |
| Public `/cdn/*` URLs | Update the Caddy upstream to the Azure HTTPS hostname, including the upstream Host/TLS configuration, preserving existing paths and byte-range behavior. No DNS change has been made. |
| Hub Compose | `UPLOAD_SERVICE_URL` currently points at `http://cdn:5001`. It alone does not control the hardcoded callers below. Remove CDN service/dependency/port recreation only after successful handover. |
| Hub upload queues | `backend/queues/cdnUploadQueue.js` and `invoiceImageUploadQueue.js` use hardcoded internal CDN upload URLs. Make routing explicit and test retry/failure handling. |
| Hub utilities | `uploadToCdn.js`, `csoInvoiceUpload.js`, `cStoreCountScrapper.js`, `cStoreWriteOffAutomation.js` have active internal CDN callers. Check generated/persisted download URLs as well as upload requests. |
| Cash summary | `cashSummaryNewRoutes.js` and `autoSumitCashSummaryReportCron.js` fall back to the internal CDN origin. Preserve external links and coordinate scheduled producers. |
| Desk backup worker | The deployed daily worker reads Blob storage directly using shared Azure settings. Add explicit live-source configuration and keep backup destination/status/lease behavior deliberate before redirecting it. Do not globally repoint Desk or Hub Azure settings. |
| Academy | Existing HLS playlists/reference URLs may use the original account's SAS URLs. This CDN-only copy does not move `academy/` or rewrite those references. |
| Historical internal URLs | Audit stored `http://cdn:5001` references and manual migration utilities before retiring that internal host. Do not bulk-edit database references without an inventory and rollback plan. |

## Final window and rollback boundary

Coordinate Hub/Desk maintenance, uploads, queue workers, scheduled producers,
backup jobs and deletion actions. Pause/drain the old CDN; preserve the verified
source configuration and image. Capture a fresh backup and source inventory,
copy and verify final additions/changes, and reconcile only reviewed,
migration-owned destination deletions using ETag conditions. Require identical
final counts, bytes and manifests. Keep Azure paused until routing and caller
checks pass, then enable its writes and verify real flows before retiring VPS CDN.

The published VPS workflow guard excludes CDN rebuilds/recreation only after
`CDN_DEPLOY_TARGET=azure`. Freeze and drain active workflows before changing it;
an already-running workflow may have captured the previous variable. Retire the
Compose service definition so a later generic startup cannot recreate it.

Before Azure accepts production writes, the original source remains a rollback
option after carefully restoring routing. After any destination production
writes/deletes, rollback requires data reconciliation; switching back blindly
would lose those changes. No production routing, source pause, worker changes,
shared environment changes or VPS shutdown is performed by this preparation.
