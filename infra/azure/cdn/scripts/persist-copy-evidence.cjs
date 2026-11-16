// Validate the completed artifact and retain it in the new private media
// account beyond GitHub's artifact retention. No original-account credentials.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BlobServiceClient } = require('../../../../cdn/node_modules/@azure/storage-blob');
const { manifest } = require('../../../../cdn/scripts/copy-media.cjs');
const python = 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe';
const runId = process.argv[2];
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
async function main() {
  assert.match(runId || '', /^\d+$/);
  const zipPath = path.join(require('node:os').tmpdir(), 'cdn-media-copy-' + runId + '.zip');
  const extraction = spawnSync(python, ['-c',
    'import zipfile,json,base64,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n print(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in ["summary.json","source-inventory.json","verified.jsonl"]}))', zipPath],
    { encoding: 'utf8', timeout: 45000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(extraction.status, 0, 'Could not read expected artifact files');
  const files = Object.fromEntries(Object.entries(JSON.parse(extraction.stdout)).map(([name, data]) => [name, Buffer.from(data, 'base64')]));
  const summary = JSON.parse(files['summary.json']);
  const inventory = JSON.parse(files['source-inventory.json']);
  const receipts = files['verified.jsonl'].toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(summary.phase, 'online-baseline-verified'); assert.equal(summary.snapshotVerified, true);
  assert.equal(summary.files, summary.verified); assert.equal(summary.sourceBytes, summary.verifiedBytes);
  assert.equal(summary.files, inventory.length); assert.equal(summary.files, receipts.length);
  assert.equal(inventory.reduce((sum, file) => sum + file.size, 0), summary.sourceBytes);
  assert.equal(manifest(inventory), summary.manifestSha256);
  assert.equal(summary.manifestSha256, summary.destinationManifest);
  const byName = new Map(receipts.map(receipt => [receipt.name, receipt]));
  assert.equal(byName.size, inventory.length);
  for (const file of inventory) {
    const receipt = byName.get(file.name); assert.ok(receipt);
    assert.equal(receipt.sha256, file.sha256); assert.equal(receipt.size, file.size);
    assert.equal(receipt.originalmtime, file.originalmtime); assert.equal(receipt.sourceEtag, file.etag);
    assert.ok(receipt.destinationEtag && Number.isFinite(Date.parse(receipt.verifiedAt)));
  }
  const authResult = spawnSync(python, ['-IBm', 'azure.cli', 'account', 'get-access-token',
    '--subscription', '29b24248-1990-4592-b25d-e6ee8e9db784', '--resource', 'https://storage.azure.com/', '--output', 'json'],
    { encoding: 'utf8', timeout: 45000 });
  assert.equal(authResult.status, 0, 'Azure authentication failed');
  const auth = JSON.parse(authResult.stdout);
  const container = new BlobServiceClient('https://gen7erpmedia29b24248.blob.core.windows.net', {
    getToken: async () => ({ token: auth.accessToken, expiresOnTimestamp: Number(auth.expires_on) * 1000 }),
  }).getContainerClient('hub');
  const report = { runId, retainedAt: new Date().toISOString(), summary, evidence: [] };
  files['artifact.zip'] = fs.readFileSync(zipPath);
  for (const [name, data] of Object.entries(files)) {
    const blobName = `_migration/cdn/evidence/${runId}/${name}`;
    const blob = container.getBlockBlobClient(blobName);
    const checksum = sha256(data);
    let existing;
    try { existing = await blob.getProperties(); } catch (error) { if (error.statusCode !== 404) throw error; }
    if (existing) {
      assert.equal(existing.metadata?.sha256, checksum); assert.equal(existing.contentLength, data.length);
    }
    const uploaded = existing || await blob.uploadData(data, { conditions: { ifNoneMatch: '*' },
      metadata: { sha256: checksum }, blobHTTPHeaders: { blobContentType: name.endsWith('.zip') ? 'application/zip' : name.endsWith('.jsonl') ? 'application/x-ndjson' : 'application/json' } });
    const verified = await blob.downloadToBuffer(0, undefined, { conditions: { ifMatch: uploaded.etag } });
    assert.equal(sha256(verified), checksum);
    report.evidence.push({ name, blobName, bytes: data.length, sha256: checksum, etag: uploaded.etag });
  }
  const record = path.resolve(__dirname, '../diagnostics/media-copy-baseline-' + runId + '.json');
  fs.writeFileSync(record, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
