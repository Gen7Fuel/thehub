// Stream into the existing Desk worker: node - MANIFEST_SHA256 SINCE_ISO.
// Read-only; full receipts remain private and only aggregate proof is printed.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const backup = require('./apps/cdn/cdn.backup');
async function main() {
  const [expected, since] = process.argv.slice(2);
  assert.match(expected || '', /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(since)));
  async function fenced() {
    const r = await fetch('https://app.gen7fuel.com/cdn/maintenance', {
      headers: { Authorization: 'Bearer ' + process.env.CDN_ADMIN_TOKEN }, signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, 200);
    const s = await r.json(); assert.ok(s.paused && s.drained && s.activeWrites === 0);
  }
  await fenced();
  const c = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(process.env.AZURE_CONTAINER);
  assert.equal(new URL(c.url).hostname, 'gen7fuel.blob.core.windows.net');
  const files = await backup.inventory(c);
  assert.ok(files.length);
  const manifest = list => {
    const h = crypto.createHash('sha256');
    for (const f of list) h.update(JSON.stringify([f.source, f.size, f.lastModified, f.sourceSha256]) + '\n');
    return h.digest('hex');
  };
  assert.equal(manifest(files), expected, 'Frozen source differs from final-copy manifest');
  const months = [...new Set(files.map(f => f.lastModified.slice(0, 7)))].sort();
  const verified = new Set();
  for await (const blob of c.listBlobsFlat({ prefix: 'cdn_backup/automated/monthly/' })) {
    if (!blob.name.endsWith('.json')) continue;
    const receiptBlob = c.getBlobClient(blob.name);
    const props = await receiptBlob.getProperties();
    const receipt = JSON.parse((await receiptBlob.downloadToBuffer(0, undefined, { conditions: { ifMatch: props.etag } })).toString());
    if (!months.includes(receipt.month) || Date.parse(receipt.verifiedAt) < Date.parse(since) || !Number.isFinite(Date.parse(receipt.verifiedAt))) continue;
    const selected = files.filter(f => f.lastModified.startsWith(receipt.month));
    if (receipt.fileCount !== selected.length || !Array.isArray(receipt.files) || receipt.blobName !== blob.name.replace(/\.json$/, '.tar')) continue;
    const canonical = list => list.map(f => [f.name, f.size, f.etag, f.lastModified, f.sha256 || f.sourceSha256]).sort((a, b) => a[0].localeCompare(b[0]));
    if (JSON.stringify(canonical(receipt.files)) !== JSON.stringify(canonical(selected))) continue;
    const archive = await c.getBlobClient(receipt.blobName).getProperties();
    if (archive.etag !== receipt.etag || archive.contentLength !== receipt.size || archive.metadata.sha256 !== receipt.sha256) continue;
    verified.add(receipt.month);
  }
  assert.deepEqual([...verified].sort(), months, 'A verified frozen month archive is still missing');
  const after = await backup.inventory(c);
  assert.equal(manifest(after), expected);
  assert.deepEqual(after.map(f => f.etag), files.map(f => f.etag));
  await fenced();
  console.log(JSON.stringify({ fullBackupVerified: true, manifestSha256: expected, files: files.length,
    sourceBytes: files.reduce((n, f) => n + f.size, 0), months, since, verifiedAt: new Date().toISOString(),
    archiveReadbackEstablishedByWorker: true, verificationMode: 'receipt-and-current-etag', productionCutover: false }, null, 2));
}
main().catch(error => {
  console.error(JSON.stringify({ fullBackupVerified: false, errorType: error.name, code: error.code || null }));
  process.exitCode = 1;
});
