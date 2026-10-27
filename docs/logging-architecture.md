# Application logging architecture

The application uses separate collections for high-volume request access records
and durable business changes.

## Current collections

- `accesslogs` records HTTP access outcomes, including reads, status codes, source,
  path, user, and a human-readable purpose. Frontends should provide action headers
  when they know the business purpose. The backend middleware supplies safe defaults
  for clients that do not provide those headers.
- `changelogs` records meaningful creates, updates, deletes, approvals, and
  rejections. Route-level logging owns resource IDs and bounded before/after diffs.
- `actionlogs` is a legacy compatibility collection still used by Safesheets and
  Payables. It must remain until those writers have been migrated and verified.

## Planned ActionLog retirement

1. Move remaining Safesheet and Payables access records to `AccessLog`.
2. Move their durable mutation records to `ChangeLog`.
3. Verify that no route, queue, worker, report, or reader still imports `ActionLog`.
4. Stop the legacy `actionLogQueue` worker.
5. Preserve or archive the existing `actionlogs` collection.
6. Remove the legacy middleware, queue, model, and collection only after production
   verification.

## Azure Blob archival

The scheduled job runs at 08:00 UTC and checks `accesslogs` and `changelogs`
independently. A collection is processed only when its document count exceeds
`LOG_ARCHIVE_DOCUMENT_THRESHOLD` (default `50000`). The UTC cutoff is controlled by
`LOG_ARCHIVE_SAFE_DAYS` (default `2`). For example, a run on October 27 with two
safe days keeps October 25 onward in MongoDB and archives October 24 and earlier.

Each complete UTC day is streamed to a gzip-compressed JSON Lines blob under:

- `hub/logs/access/YYYY/MM/DD/`
- `hub/logs/change/YYYY/MM/DD/`

Each data blob has a corresponding JSON manifest containing its UTC range, record
count, byte count, SHA-256 checksum, schema version, and batch ID. Blobs are uploaded
to `LOG_ARCHIVE_TIER` (default `Cold`). The job verifies the uploaded data blob before
writing the manifest and deleting only the exact MongoDB IDs included in that file.
A failed upload or verification leaves MongoDB records untouched.

The scheduled job always checks both collections. The manual runner allows a
temporary safety-day override and collection selection without changing production
configuration:

```bash
node manual/logArchive.js --type access --safe-days 2
node manual/logArchive.js --type change --safe-days 3
node manual/logArchive.js --type both --safe-days 2
```
