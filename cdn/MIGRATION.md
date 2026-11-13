# CDN migration to Azure

Destination: individual files in `AZURE_CONTAINER/cdn/<existing-filename>`. Monthly archives remain in `cdn_backup/`. The Express CDN stays on the VPS to preserve every stored URL, but durable file content moves to Azure. Azure credentials remain server-side.

## Before maintenance: online preparation

1. Stage and test this version with **`CDN_STORAGE=local`**. The initial copy can run in an isolated container alongside the existing CDN, mounting `thehub_uploads` read-only at `/app/uploads` and `thehub_cdn_migration_state` read/write at `/migration/state`. Set `CDN_MIGRATION_STATE_DIR=/migration/state`. This avoids restarting the existing CDN during online preparation. Keep the same verification-state volume for every subsequent pass and for the replacement CDN. Both Compose files default to local; deploying the code alone does not switch storage. Ensure the CDN/migration container receives the same Azure connection string and container as Desk. The existing GitHub deployment supplies Azure secrets to Compose. Set `CDN_STORAGE` persistently in the VPS repository `.env`, not just an interactive shell; do not push changes to main during the final migration.
2. Keep the uploads volume mounted. Confirm the actual deployment uses one CDN replica and no other process writes directly to `/app/uploads`. Pause any external job that can bypass the CDN. Do not run multiple migration processes.
   The migration defaults to four concurrent file transfers, configurable from 1 to 8 using `CDN_MIGRATION_CONCURRENCY`. Keep resource limits on the isolated container and watch production responsiveness. Each failure waits for admitted transfers to finish before releasing the migration lock.
3. Keep the Azure container private. Check existing lifecycle rules: the live `cdn/` prefix must not inherit archive, expiry or deletion policies intended for backups. Confirm storage versioning/soft-delete settings meet recovery requirements. Do not change container policies as part of the copy.
4. In the running CDN container, check the current mode and run the initial copy:

   ```sh
   docker compose exec -T cdn node -e 'fetch("http://127.0.0.1:5001/cdn/maintenance", {headers:{Authorization:"Bearer "+process.env.CDN_ADMIN_TOKEN}}).then(async r=>{console.log(await r.text());if(!r.ok)process.exitCode=1})'
   docker compose exec -T cdn npm run migrate:copy
   ```

   The commands above assume the new CDN image is already deployed in local mode. For an isolated online migration container, run `node migrate.js copy` in that staged image with the same environment and volume mounts instead. Hub stays online. Existing and new uploads still use local storage. The script uploads missing or changed files with their original names, MIME types, dates and SHA-256 metadata. Each file is downloaded and SHA-256 verified during the online copy. A receipt bound to its Azure URL hash, ETag, content checksum, size and original date is saved in the separate state volume only after the source stability check passes. Conditional writes prevent overwriting concurrent Azure changes. It never deletes local files or modifies `cdn_backup/`. Files deleted during the copy are reconciled later. A concurrent source change may fail a copy; rerun it. Conflicts with non-migration-owned Azure files fail for review rather than overwriting them.
5. Run the copy again near cutover to reduce the final delta. Record counts, total bytes and transfer time. Finalization rehashes all local files and checks Azure ETags and metadata, reusing only exact verification receipts; it downloads files whose receipts are missing or invalidated. Losing the state volume is safe but forces full downloads again. A large dataset or many changed files can exceed the earlier 15–30 minute estimate. Pre-pull/build the tested CDN image before the window. Confirm an operator has the Hub maintenance permission and the CDN admin token is configured, without printing it.

## STOP: notify the user to enable Hub maintenance here

**This is the maintenance boundary. Do not start finalization or change `CDN_STORAGE` until Hub maintenance is active.** Maintenance protects app workflows; the independent CDN pause below blocks direct browser uploads, background uploads and admin deletions. In-flight Hub forms may need users to retry after maintenance; HTTP failures do not automatically queue uploads.

1. Put Hub into maintenance through its existing settings. Pause file-producing jobs/integrations and Desk CDN deletion/backup actions for the window.
2. If the original CDN is still running, replace it with the staged image in local mode now, keeping the same uploads and verification-state volumes. Preserve the old image and configuration for rollback, verify known URLs, then pause CDN writes and drain admitted requests:

   ```sh
   docker compose exec -T cdn node -e 'fetch("http://127.0.0.1:5001/cdn/maintenance", {method:"POST",headers:{Authorization:"Bearer "+process.env.CDN_ADMIN_TOKEN,"Content-Type":"application/json"},body:JSON.stringify({paused:true})}).then(async r=>{console.log(await r.text());if(!r.ok)process.exitCode=1})'
   ```

   Require HTTP success with `paused:true`, `drained:true`, `activeWrites:0`, `storage:"local"`. A timeout leaves writes blocked; retry pause to confirm drainage. Downloads remain available. The pause survives container recreation via the uploads volume. Never edit the control file by hand. A service restart must fully stop the previous single instance before running the final script.
3. Run final delta copy and verification:

   ```sh
   docker compose exec -T cdn npm run migrate:finalize
   docker compose exec -T cdn npm run migrate:verify
   ```

   Both commands require the persisted drained pause. Finalization validates each source checksum, destination size/date and ETag against the verified receipt, or downloads and hashes destination content when no matching receipt exists. Azure changes the ETag whenever content or metadata changes. Finalization removes only migration-owned Azure blobs absent locally, using their ETags. Any unexpected destination object or checksum mismatch stops the operation. Verify is a read-only pass against Azure and likewise reuses only exact receipts; budget for both local checksum scans and Azure property checks. Save successful reports securely outside `/app/uploads`; require identical file counts, byte counts and `manifestSha256` values. Keep maintenance active on any failure. An empty source is refused to guard against an incorrect volume mount. A lock in the state directory prevents simultaneous migration runs; after a hard crash, confirm no migration process remains before removing only `/migration/state/migration.lock` and retrying.
4. Persist `CDN_STORAGE=azure` in the VPS `.env`, and ensure the deployment shell has no conflicting `CDN_STORAGE=local` override. Recreate only CDN with the already tested image:

   ```sh
   docker compose up -d --no-deps cdn
   ```

   Verify the admin status endpoint reports `storage:"azure"`, `paused:true`, `drained:true`. Do not unpause yet. Download known PDFs, images and a migrated historical file via their original public URLs; compare checksums. Check admin listing and Desk's month counts against the pre-cutover inventory. Verify missing files return 404. Keep Azure container access private.
5. While Hub remains in maintenance and file-producing jobs remain stopped, unpause CDN using the same admin command with `{paused:false}`. Test all three upload formats through the application/CDN, download the returned filenames, then delete only these test files through the authenticated CDN API. Confirm no test file content appears locally. Resume Hub and integrations only after those checks pass.

## Rollback and cleanup

Before Azure writes are enabled, a rollback is straightforward: keep maintenance active, persist `CDN_STORAGE=local`, recreate CDN, verify local downloads, then unpause and resume Hub. No local source file has been deleted.

**After any Azure writes or deletions, the local volume is stale. Do not simply switch back.** Pause/drain CDN, keep Hub in maintenance, and reconcile Azure additions/deletions back to local storage with checksum verification before reverting. That reverse migration is not automated by this tool. Prefer fixing the Azure connection and resuming on Azure when appropriate.

Retain local files until the rollback retention period is agreed and passed. Do not remove the Docker volume wholesale: the write-pause control state still resides there. Clearing old file contents is a separate reviewed cleanup. Existing backup archives remain independent; this migration does not add a new backup schedule or recovery policy.

## Production deployment record: 2026-11-13

The cutover completed at 19:13 UTC on `app.gen7fuel.com`. Both final passes verified 10,099 files / 33,364,847,695 bytes with matching manifest `271fefac46badfc89d49f73957797fba6149e3e180c0f2ca82efc883505303b6`. The final synchronization copied 36 files added after the initial baseline. All source filename/size/date records and Desk month groupings matched Azure. Historical public PDFs/images, byte ranges, missing-file responses and all three upload formats passed live checks; temporary test files were deleted and no new file content was written locally.

Production CDN is in Azure mode with writes enabled. Hub maintenance was left active for the user to close. Local uploads remain in `thehub_uploads`; verification receipts remain in `thehub_cdn_migration_state`.

The staged deployment is pinned to image `thehub-cdn:azure-migration-20261113` (`sha256:d386d53ca24296208c2b5526a8cc1bf3450c338d5169299ffc80fa75c4d217fc`). The server repository's `compose.override.yaml` links to `/home/gen7fuel/cdn-azure-migration-20261113/cdn.override.yaml`, and its `.env` persists `CDN_STORAGE=azure`. The private Azure/admin configuration remains in that staging directory's `cdn.env`; no credentials were copied into this repository. Effective default Compose configuration was checked to preserve Azure mode and the pinned image on subsequent deployments. Keep this override and image until these source changes are merged, the normal pipeline builds a replacement image, and that replacement is verified.

Detailed reports, source inventory and sample checksums are retained under `/home/gen7fuel/cdn-azure-migration-20261113/reports/`, including `cutover-complete.json`. The `deploy-cdn.py` helper in that private staging directory reconstructs Compose inputs from running service configuration and can explicitly select local/Azure mode; the post-write rollback reconciliation requirement above still applies.

The Azure app identity could not discover the storage account through the management API, so lifecycle policies remain unverified by this agent. The user was asked to confirm that archive/deletion rules do not apply to the live `cdn/` prefix. Container privacy was verified; storage policies were not changed.
