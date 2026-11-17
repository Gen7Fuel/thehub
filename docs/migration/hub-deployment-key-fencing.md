# Hub deployment-key fencing

Prepared 17 November 2026. Audit and code preparation only. No key, secret,
environment, authorized-key entry or deployment setting has changed yet.

## Audit result

The VPS authentication log correlates the successful Hub deployment at 15:14 UTC
with key `SHA256:7w8AVaiYcjTXsl/LYcIaO0a2wNSS0hyxCSfmpbc8+PY`. The authorized
entry is labelled for Hub GitHub deployment. The successful Desk deployment at
15:02 UTC and the current personal/operator connection use a different key:
`SHA256:sNUPGZ5sUEiFRdqkLwRSxuFXwoBAeOBYXGwpKBDWN7s`. Preserve that shared
Desk/personal key, plus all other authorized entries.

The queued Hub run was created 11 November 2026. Its immutable workflow uses
`SERVER_SSH_KEY` for both transfers and SSH and declares no environment. That
repository secret was last changed 8 October 2025, before the queued run. The
server uses the audited authorized-keys files, no AuthorizedKeysCommand or user
CA, and the alternate authorized_keys2 file is absent at observation.

## Replacement design

New environment `hub-vps-production-v2`, restricted to branch `main`, stores only
the new `HUB_DEPLOY_SSH_KEY_V2` secret. Current deployment and probe jobs reference
that environment and unique secret name. Older immutable workflows cannot obtain
it through a repository-secret fallback. The workflow accepts production jobs
only from `main`; infrastructure-only pushes select no application and skip VPS
deployment. Normal reviewed application changes still deploy through the usual
PR-to-main path.

[GitHub documents separate repository and environment secret read times](https://docs.github.com/en/actions/reference/security/secrets#when-github-actions-reads-secrets).
Do not assume snapshot timing for the abnormal queued run. Retirement handles
both possibilities: remove the old authorized public key and replace the legacy
repository secret with a non-empty inert marker, preventing organization fallback.
The stale run may remain visible but must no longer have a usable SSH credential.

The operator tool uses existing installed Python libraries; no dependency is
added to any app. RSA private keys are generated in memory, tested with pinned
host keys and agent fallback disabled, then encrypted using GitHub's public key
and PyNaCl sealed boxes. Tokens/private keys are never printed or written to key
files, env files or command arguments. Authorized-key edits use temporary files
containing **public keys only**, retain all other lines and replace atomically.

The new public key has `restrict` options, preserving noninteractive deployment
commands while disabling forwarding and PTY access. The main-only probe tests
the actual SSH and SCP actions, remote Git access, Docker access and existing
passwordless sudo. It transfers only a public nonce under a run-specific `/tmp`
directory and removes it. Its artifact contains fingerprints and commit/run
metadata only. No application is restarted by that probe.

## Reviewed execution sequence

**Do not retire the legacy key before the PR is merged and the new probe succeeds.**
Use the installed Azure CLI Python on this machine:

```powershell
$keyPython = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe'
& $keyPython infra/azure/cdn/scripts/deployment-key-fence.py audit
```

1. Set repository variable `CDN_MIGRATION_FREEZE=true` before the credential
   transition; this freezes deployment jobs, not application traffic or CDN
   uploads. Drain active deployment runs, then review/merge this credential PR
   through the normal process. The known queued run is allowed only while it has zero jobs.
   The infrastructure-only merge skips application deployment.
2. Stage the replacement after the merged workflow contract is present:

   ```powershell
   & $keyPython infra/azure/cdn/scripts/deployment-key-fence.py stage --execute
   ```

   This creates the main-only environment, adds the new restricted public key,
   verifies direct login using only the new in-memory private key, and stores
   the encrypted environment secret and public fingerprint variables. It retains
   the old Hub key and the Desk/personal key. Re-running against an existing
   replacement environment refuses to overwrite it; inspect partial state before
   recovery. A failed stage attempts to remove only its new public entry while
   preserving legacy access. The unused environment may require reviewed cleanup
   before a fresh stage if setup fails partway through.
3. Run the main-only no-deployment probe:

   ```powershell
   & $keyPython infra/azure/cdn/scripts/deployment-key-fence.py probe --execute
   ```

   Wait for **Verify Hub VPS deployment access** to succeed at the current main
   SHA. The new key/host fingerprints must match its public proof artifact.
   Host negotiation can differ between clients: if a pinned-host check fails,
   choose only one of the trusted host fingerprints returned by `audit`, update
   it while deployments remain frozen, and rerun the probe:

   ```powershell
   & $keyPython infra/azure/cdn/scripts/deployment-key-fence.py set-host-pin --fingerprint <TRUSTED_HOST_FINGERPRINT> --execute
   ```

   Never disable host verification to make a probe pass. A failed probe leaves
   the old key intact. If SCP and SSH negotiate different host algorithms, stop
   and give each transport its separately pinned verified fingerprint through a
   reviewed workflow change; do not retire with an untested transport.
4. Retire only after the new probe succeeds:

   ```powershell
   & $keyPython infra/azure/cdn/scripts/deployment-key-fence.py retire --probe-run <SUCCESSFUL_CURRENT_MAIN_RUN_ID> --execute
   ```

   The gate verifies the merged workflow contract, deployment freeze, main-only
   environment policy, exact successful probe/artifact/current SHA, trusted host
   pin, server authentication with the new key since the probe, and no active
   matching legacy SSH session. It refuses a legacy secret changed since the
   audit. The old repository secret becomes inert; only the old Hub public entry
   is removed. Personal access is retested, and active legacy sessions are checked
   again. Unexpected sessions are not killed automatically or declared fenced.
   Keep the freeze and investigate any partial failure; do not blindly restore
   the retired public key and re-enable the stuck workflow.
5. Verify both app health endpoints, original CDN image/start time, old writer
   availability and paused Azure/standby. Run the probe again if needed. Clear
   `CDN_MIGRATION_FREEZE` only after the current workflow uses the tested new
   environment and the old key is confirmed absent. No CDN/source routing secret
   is changed by this procedure.

## Validation and limits

Eleven data/crypto tests cover public-key/comment preservation, refusal to remove
working access, safe pre-retirement rollback, real sealed-box encryption,
credential stripping on artifact redirects, generated remote-script syntax,
rejection of legacy/unscoped workflow credentials and optimized-Python bypasses.
The operator's read-only audit ran against the actual server/GitHub metadata.
Real stage/probe/retirement are deliberately pending PR review/merge. Passing
unit tests does not establish that the encrypted key has been exercised by the
actual GitHub SSH/SCP clients; the mandatory probe establishes that later.
