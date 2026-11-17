const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const code = fs.readFileSync(path.join(__dirname, '../scripts/verify-frozen-backups.cjs'), 'utf8');

async function verify({ omitMonth, changedArchive, activeWriter = false } = {}) {
  const files = ['09', '10', '11'].map(month => ({ source: `cdn/synthetic-${month}.txt`, name: `synthetic-${month}.txt`,
    size: 1, etag: 'source-etag-' + month, lastModified: `2026-${month}-01T00:00:00.000Z`, sourceSha256: 'a'.repeat(64) }));
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(JSON.stringify([f.source, f.size, f.lastModified, f.sourceSha256]) + '\n');
  const expected = hash.digest('hex');
  const receipts = files.filter(f => f.lastModified.slice(0, 7) !== omitMonth).map(f => ({
    month: f.lastModified.slice(0, 7), verifiedAt: '2026-11-17T12:00:00.000Z', fileCount: 1,
    blobName: `cdn_backup/automated/monthly/date/id/cdn-${f.lastModified.slice(0, 7)}.tar`,
    files: [{ ...f, sha256: f.sourceSha256 }], etag: 'archive-etag', size: 2048, sha256: 'b'.repeat(64),
  }));
  const c = { url: 'https://gen7fuel.blob.core.windows.net/hub',
    async *listBlobsFlat() { for (const r of receipts) yield { name: r.blobName.replace(/\.tar$/, '.json') }; },
    getBlobClient(name) {
      return {
        async getProperties() { return name.endsWith('.json') ? { etag: 'receipt-etag' } : {
          etag: changedArchive ? 'changed' : 'archive-etag', contentLength: 2048, metadata: { sha256: 'b'.repeat(64) } }; },
        async downloadToBuffer(_start, _end, options) {
          assert.equal(options.conditions.ifMatch, 'receipt-etag');
          return Buffer.from(JSON.stringify(receipts.find(r => r.blobName.replace(/\.tar$/, '.json') === name)));
        },
      };
    },
  };
  const output = [], errors = [];
  const fakeProcess = { argv: ['node', '-', expected, '2026-11-17T11:00:00.000Z'], env: {}, exitCode: 0 };
  let context;
  context = vm.createContext({ process: fakeProcess, URL, console: { log: value => output.push(JSON.parse(value)), error: value => errors.push(JSON.parse(value)) },
    fetch: async () => ({ status: 200, json: async () => ({ paused: !activeWriter, drained: true, activeWrites: 0 }) }),
    AbortSignal,
    require(name) {
      if (name === '@azure/storage-blob') return { BlobServiceClient: { fromConnectionString: () => ({ getContainerClient: () => c }) } };
      if (name === './apps/cdn/cdn.backup') return { inventory: async () => vm.runInContext('JSON.parse(' + JSON.stringify(JSON.stringify(files)) + ')', context) };
      return require(name);
    },
  });
  vm.runInContext(code, context);
  await new Promise(resolve => setImmediate(resolve));
  return { output, errors, exitCode: fakeProcess.exitCode };
}

test('frozen backup proof covers every inventory month using current archive ETags', async () => {
  const result = await verify(); assert.equal(result.exitCode, 0);
  assert.equal(result.output[0].fullBackupVerified, true);
  assert.deepEqual(result.output[0].months, ['2026-09', '2026-10', '2026-11']);
  assert.doesNotMatch(JSON.stringify(result.output), /synthetic-|source-etag|archive-etag/);
});
test('missing September archive cannot be hidden by successful October and November archives', async () => {
  assert.equal((await verify({ omitMonth: '2026-09' })).exitCode, 1);
});
test('changed archive ETag or an active writer prevents a frozen-backup proof', async () => {
  for (const options of [{ changedArchive: true }, { activeWriter: true }]) {
    const result = await verify(options); assert.equal(result.exitCode, 1); assert.equal(result.output.length, 0);
  }
});
