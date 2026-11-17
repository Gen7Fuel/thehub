// Executed only by the VPS wrapper, with credentials inherited in memory.
// Default mode is read-only plan; execute never enables a CDN writer.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } = require('@azure/storage-blob');
const { ClientSecretCredential } = require('@azure/identity');

async function runFinalDelta({ mode, approvedDigest, approvedDeleteCount, finalize, planFinalDelta }) {
  assert.ok(['plan', 'execute'].includes(mode));
  const sourceService = BlobServiceClient.fromConnectionString(process.env.CDN_COPY_SOURCE_CONNECTION_STRING);
  assert.equal(new URL(sourceService.url).hostname, 'gen7fuel.blob.core.windows.net');
  const source = sourceService.getContainerClient('hub');
  const credential = new ClientSecretCredential(process.env.CDN_COPY_TENANT_ID, process.env.CDN_COPY_CLIENT_ID, process.env.CDN_COPY_CLIENT_SECRET);
  const destination = new BlobServiceClient('https://gen7erpmedia29b24248.blob.core.windows.net', credential).getContainerClient('hub');
  async function checkFence() {
    for (const url of ['http://cdn:5001', 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net', 'http://cdn-rollback-vps:5001']) {
      const response = await fetch(url + '/cdn/maintenance', { headers: { Authorization: 'Bearer ' + process.env.CDN_COPY_ADMIN_TOKEN }, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, 'Maintenance status unavailable');
      const state = await response.json();
      if (!state.paused || !state.drained || state.activeWrites !== 0) return false;
    }
    return true;
  }
  const plan = await planFinalDelta(source, destination);
  if (mode === 'plan') return { mode, files: plan.source.length, sourceBytes: plan.source.reduce((n, f) => n + f.size, 0),
    reviewedPlanDigest: plan.digest, proposedDeletions: plan.deletions.length, writersFenced: await checkFence(),
    manifestSha256: plan.sourceManifest,
    sourceMonths: [...new Set(plan.source.map(f => f.originalmtime.slice(0, 7)))].sort(), productionCutover: false };
  assert.equal(process.env.CDN_COPY_HOST_FREEZE_VERIFIED, 'true');
  assert.match(approvedDigest, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(approvedDeleteCount) && approvedDeleteCount >= 0);
  const prefix = '_migration/cdn/final/' + crypto.randomUUID() + '/';
  async function retain(name, value) {
    const data = Buffer.from(JSON.stringify(value));
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const blob = destination.getBlockBlobClient(prefix + name);
    const uploaded = await blob.uploadData(data, { conditions: { ifNoneMatch: '*' }, metadata: { sha256 },
      blobHTTPHeaders: { blobContentType: 'application/json' } });
    const readback = await blob.downloadToBuffer(0, undefined, { conditions: { ifMatch: uploaded.etag } });
    assert.equal(crypto.createHash('sha256').update(readback).digest('hex'), sha256);
    return sha256;
  }
  const receipts = [];
  const result = await finalize({ source, destination, approvedDigest, approvedDeleteCount, checkFence,
    retainPlan: async value => { await retain('reviewed-plan.json', value); return { verified: true, digest: value.digest }; },
    receipt: value => receipts.push(value),
    sign: file => source.getBlobClient(file.name).url + '?' + generateBlobSASQueryParameters({
      containerName: 'hub', blobName: file.name, permissions: BlobSASPermissions.parse('r'), protocol: SASProtocol.Https,
      startsOn: new Date(Date.now() - 300000), expiresOn: new Date(Date.now() + 600000),
    }, sourceService.credential).toString(),
  });
  await retain('verified-receipts.json', receipts);
  const summarySha256 = await retain('verified-summary.json', result);
  return { phase: result.phase, files: result.files, sourceBytes: result.sourceBytes, deleted: result.deleted,
    manifestSha256: result.manifestSha256, sourceUnchanged: result.sourceUnchanged,
    evidencePrefix: prefix, summarySha256, finalDeltaVerified: true, fullBackupStillRequired: true, productionCutover: false };
}
module.exports = { runFinalDelta };
