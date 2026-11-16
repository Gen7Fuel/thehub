// Keep real media identifiers private; publish only aggregate API verification.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BlobServiceClient } = require('../../../../cdn/node_modules/@azure/storage-blob');
async function main() {
  const runId = process.argv[2]; assert.match(runId || '', /^\d+$/);
  const data = fs.readFileSync(path.resolve(__dirname, '../diagnostics/copied-api-' + runId + '.json'));
  const report = JSON.parse(data); assert.equal(report.success, true); assert.equal(report.runId, runId);
  const authResult = spawnSync('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe', ['-IBm', 'azure.cli',
    'account', 'get-access-token', '--subscription', '29b24248-1990-4592-b25d-e6ee8e9db784',
    '--resource', 'https://storage.azure.com/', '--output', 'json'], { encoding: 'utf8', timeout: 45000 });
  assert.equal(authResult.status, 0);
  const auth = JSON.parse(authResult.stdout);
  const container = new BlobServiceClient('https://gen7erpmedia29b24248.blob.core.windows.net', {
    getToken: async () => ({ token: auth.accessToken, expiresOnTimestamp: Number(auth.expires_on) * 1000 }),
  }).getContainerClient('hub');
  const blobName = `_migration/cdn/evidence/${runId}/api-verification.json`;
  const blob = container.getBlockBlobClient(blobName);
  const checksum = crypto.createHash('sha256').update(data).digest('hex');
  let existing;
  try { existing = await blob.getProperties(); } catch (error) { if (error.statusCode !== 404) throw error; }
  if (existing) { assert.equal(existing.metadata?.sha256, checksum); assert.equal(existing.contentLength, data.length); }
  const uploaded = existing || await blob.uploadData(data, { conditions: { ifNoneMatch: '*' },
    metadata: { sha256: checksum }, blobHTTPHeaders: { blobContentType: 'application/json' } });
  const readback = await blob.downloadToBuffer(0, undefined, { conditions: { ifMatch: uploaded.etag } });
  assert.equal(crypto.createHash('sha256').update(readback).digest('hex'), checksum);
  const publicReport = { runId, started: report.started, finished: report.finished, success: true,
    listing: report.listing, sampleCount: report.samples.length,
    samples: report.samples.map(sample => ({ bytes: sample.bytes, contentType: sample.contentType,
      checksumVerified: true, rangeVerified: sample.rangeVerified })),
    finalHealth: report.finalHealth, privateEvidence: { blobName, sha256: checksum, etag: uploaded.etag } };
  fs.writeFileSync(path.resolve(__dirname, '../diagnostics/media-api-summary-' + runId + '.json'), JSON.stringify(publicReport, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(publicReport, null, 2));
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
