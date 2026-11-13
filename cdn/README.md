# CDN Service

Express file service with local disk or private Azure Blob Storage. Existing upload responses and `/cdn/download/:id` URLs remain the same.

Admin endpoints (`GET /cdn/files`, `DELETE /cdn/delete/:id`) require `Authorization: Bearer <CDN_ADMIN_TOKEN>`, set via the `CDN_ADMIN_TOKEN` environment variable on the container.

`CDN_STORAGE=local` is the default. Set `CDN_STORAGE=azure` with `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_CONTAINER` to store individual files under `cdn/<filename>` in the existing container. No public container access or browser credentials are needed. There is no local fallback on Azure failure. Uploads are limited to 50 MB; base64 requests retain the existing 50 MB JSON limit. PNG conversion uses memory and should be included in capacity testing.

Listing preserves original modification dates from blob metadata, so Desk's monthly backup grouping remains unchanged. `cdn/.keep`, Azure directory entries, other prefixes, and internal control files are excluded. Both flat and hierarchical Azure accounts are supported. Desk continues writing monthly archives to `cdn_backup/` using the existing CDN APIs.

See [MIGRATION.md](MIGRATION.md) for the staged migration, maintenance boundary, cutover and rollback. Keep the uploads volume mounted during rollout: it holds the persistent write-pause state as well as rollback data. Azure file content is not written into this volume.

Migration copies perform content read-back verification while Hub is online. ETag-bound receipts are retained in the separate `cdn_migration_state` volume so cutover can revalidate unchanged files without downloading them again. `CDN_MIGRATION_CONCURRENCY` defaults to four file transfers (allowed range 1–8). The source uploads volume can be mounted read-only for an isolated initial copy.

Run `npm test` for local HTTP and migration tests. To exercise the real Azure SDK against an HTTP outage:

```sh
postman simulation run postman/simulations/cdn-storage.sim.yaml --port 4019 --no-history --output ndjson
# In another terminal, from cdn/:
CDN_SIMULATION_URL=http://127.0.0.1:4019 node --test test/simulation.test.js
```

The Postman command runs from the repository root. It models Azure outages only, not successful Azure storage behavior. The optional live tests write UUID-named temporary files and a unique nested migration-test prefix under the configured Azure `cdn/` prefix, then remove only those test objects: `CDN_LIVE_TEST=1 node --test test/live.test.js`. Supply Azure configuration through environment variables, never command-line credentials.
