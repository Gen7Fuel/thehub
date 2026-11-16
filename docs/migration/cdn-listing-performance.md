# Desk CDN month-loading regression

Investigated 13 November 2026. The production service was measured read-only. The patched service was tested in an isolated container. This report records pre-deployment measurements; rollout is verified separately.

## Cause

Desk's `backend/apps/cdn/cdn.routes.js` uses `fetchAllCdnFiles()` to collect every 100-file page before calculating available backup months. Search, archive preparation and month deletion use the same enumeration helper.

The migrated CDN called `storage.list()` for every page, enumerating the entire Azure `cdn/` prefix each time before sorting and slicing. At 10,138 files there are 102 HTTP pages, resulting in roughly 102 full storage enumerations for one month-list request. The previous local-disk implementation also enumerated repeatedly, but Azure storage latency makes this substantially more expensive.

Two production requests from the running Desk API container took 29.726 seconds for page 1 and 20.826 seconds for page 2. No complete slow production month enumeration was initiated by this investigation; extrapolation to the entire enumeration is approximate, not a measured total. This explains why the UI can remain on `Loading months...` for many minutes.

## Fix prepared in Hub

`cdn/app.js` shares one sorted Azure inventory for 30 seconds across paginated requests. Simultaneous requests share one pending refresh. Upload/delete requests invalidate the inventory both before and after processing, including failed writes that may have committed remotely. A refresh started before a mutation cannot replace a newer cached inventory.

Authentication remains enforced for every file-list request, response pagination and original dates remain unchanged, and local mode does not retain the inventory between completed requests. File content is not cached by this change. Direct Azure changes made outside the CDN API can take up to the cache lifetime to appear in listings.

This fixes the repeated Azure enumeration without changing Desk's API contract, connecting Desk directly to storage or adding a persistent metadata database.

## Verification

- Sixteen default tests passed locally, including four new cache regression scenarios plus upload/delete invalidation checks.
- The Postman HTTP outage simulation with the real Azure SDK passed. Two consecutive failed list requests reached the dependency separately, confirming that failed refreshes are not cached.
- An isolated candidate container used the running production registry image with only the patched `app.js` mounted read-only. It had no production volume mounts or published host ports and made only read-only Azure listings.
- Desk's actual month route ran in a separate loopback-only harness within its existing container. Only authentication was stubbed for the harness; the existing pagination helper and month calculation were unchanged. The running Desk server and its configuration were not modified.
- The candidate returned identical month results on both runs: September 4,096 files, October 4,367, November 1,675; total 10,138.

| Candidate measurement | Result |
|---|---:|
| Cold month-list request | 21.559 seconds |
| Warm month-list request | 0.160 seconds |
| Underlying Azure inventory refreshes across both requests | 1 |
| Storage refresh duration | 21.100 seconds |

These are measured results in the candidate environment. A cold Azure scan is still required after expiry or mutation. The change does not make the multi-gigabyte archive creation itself instantaneous or address the separately recorded backup manifest/recovery gaps.

The candidate container was removed after testing. A private benchmark report remains at `/home/gen7fuel/cdn-listcache-check-20261113/benchmark.json`. Production rollout uses the normal build/deployment pipeline and requires live verification after the candidate checks.
