const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { copyAndVerify, publicSummary, OWNER } = require('../scripts/copy-media.cjs');

function fixture() {
  let sequence = 0;
  const sourceMap = new Map();
  const destinationMap = new Map();
  const calls = [];
  const error = statusCode => Object.assign(new Error('storage failure'), { statusCode, code: String(statusCode) });
  function put(map, name, value, metadata) {
    const data = Buffer.from(value);
    map.set(name, { data, etag: 'etag-' + ++sequence, contentType: 'text/plain', metadata: metadata || {
      sha256: crypto.createHash('sha256').update(data).digest('hex'), originalmtime: '2026-10-01T00:00:00.000Z', custom: 'preserved',
    } });
  }
  function container(map, destination) {
    return {
      async *listBlobsFlat() {
        for (const [name, blob] of map) yield { name, metadata: { ...blob.metadata },
          properties: { etag: blob.etag, contentLength: blob.data.length, contentType: blob.contentType } };
      },
      getBlobClient(name) {
        function get(options = {}) {
          const blob = map.get(name); if (!blob) throw error(404);
          if (options.conditions?.ifMatch && options.conditions.ifMatch !== blob.etag) throw error(412);
          return blob;
        }
        return {
          async getProperties(options) { const blob = get(options); return { ...blob, contentLength: blob.data.length, metadata: { ...blob.metadata } }; },
          async download(offset, length, options) { const blob = get(options); return { readableStreamBody: Readable.from([blob.data]) }; },
          async syncCopyFromURL(url, options) {
            assert.equal(destination, true); assert.equal(url, 'signed-source-in-memory');
            calls.push(options);
            const existing = map.get(name); const original = sourceMap.get(name);
            if (!original || original.etag !== options.sourceConditions.ifMatch) throw error(412);
            if (options.conditions.ifNoneMatch === '*' && existing) throw error(412);
            if (options.conditions.ifMatch && options.conditions.ifMatch !== existing?.etag) throw error(412);
            put(map, name, original.data, { ...options.metadata });
          },
        };
      },
    };
  }
  put(sourceMap, 'cdn/a.txt', 'source a'); put(sourceMap, 'cdn/b.txt', 'source b');
  const source = container(sourceMap, false); const destination = container(destinationMap, true);
  const run = extra => copyAndVerify({ source, destination, sign: () => 'signed-source-in-memory', ...extra });
  return { sourceMap, destinationMap, source, destination, calls, put, run };
}

test('Blob copy pins both ETags, preserves metadata and independently hashes every destination byte', async () => {
  const { run, calls, destinationMap } = fixture(); const receipts = [];
  const result = await run({ receipt: receipt => receipts.push(receipt) });
  assert.equal(result.verified, 2); assert.equal(result.copied, 2); assert.equal(result.sourceUnchanged, true);
  assert.equal(result.manifestSha256, result.destinationManifest);
  assert.equal(result.finalDeltaRequired, true); assert.equal(result.productionCutover, false);
  assert.equal(receipts.length, 2); assert.equal(calls[0].conditions.ifNoneMatch, '*');
  assert.ok(calls[0].sourceConditions.ifMatch);
  assert.equal(destinationMap.get('cdn/a.txt').metadata.custom, 'preserved');
  assert.equal(destinationMap.get('cdn/a.txt').metadata.erpmediacopy, OWNER);
  const repeated = await run(); assert.equal(repeated.copied, 0); assert.equal(repeated.reused, 2);
  assert.equal(repeated.verified, 2, 'A rerun still reads and hashes all destination content');
});

test('Blob copy rejects unmanaged destination conflicts before any copy', async () => {
  const { run, destinationMap, put, calls } = fixture(); put(destinationMap, 'cdn/a.txt', 'unmanaged');
  await assert.rejects(run(), /Unmanaged destination/); assert.equal(calls.length, 0);
});

test('Blob copy detects corrupt content despite matching copied checksum metadata', async () => {
  const { run, destinationMap } = fixture(); await run();
  destinationMap.get('cdn/a.txt').data = Buffer.from('corrupt!');
  await assert.rejects(run(), error => error.file === 'cdn/a.txt' && error.code === 'ERR_ASSERTION');
});

test('Blob copy refuses a changed source ETag and leaves its new content untouched', async () => {
  const { run, sourceMap, put } = fixture(); let changed = false;
  await assert.rejects(run({ beforeWrite: async () => {
    if (!changed) { changed = true; put(sourceMap, 'cdn/a.txt', 'new data'); }
  } }), error => error.file === 'cdn/a.txt' && error.code === '412');
  assert.equal(sourceMap.get('cdn/a.txt').data.toString(), 'new data');
});

test('Blob copy records concurrent source additions as requiring a final delta', async () => {
  const { run, sourceMap, put } = fixture(); let added = false;
  const result = await run({ receipt: async () => { if (!added) { added = true; put(sourceMap, 'cdn/new.txt', 'new'); } } });
  assert.equal(result.sourceUnchanged, false); assert.equal(result.snapshotVerified, true);
  assert.equal(result.finalDeltaRequired, true); assert.equal(result.verified, 2);
});

test('Blob copy refuses an empty source and stale destination objects without deleting anything', async () => {
  const first = fixture(); first.sourceMap.clear(); await assert.rejects(first.run(), /empty source/);
  const second = fixture(); await second.run(); second.sourceMap.delete('cdn/a.txt');
  await assert.rejects(second.run(), /stale migration object/);
  assert.equal(second.destinationMap.size, 2);
});

test('Public result omits media identifiers and unexpected private fields, including on failure', () => {
  const result = publicSummary({ phase: 'failed', files: 2, verified: 1, verifiedBytes: 123,
    failedFile: 'cdn/private-financial-image.jpg', sourceInventory: [{ name: 'private-financial-image.jpg' }],
    error: { url: 'https://source/private-financial-image.jpg?sig=private-signature' },
    accessToken: 'private-access-token' });
  assert.equal(result.verified, 1); assert.equal(result.phase, 'failed');
  assert.doesNotMatch(JSON.stringify(result), /financial-image|private-signature|private-access-token|sourceInventory|failedFile/);
});
