const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const { OWNER } = require('../../../../cdn/scripts/copy-media.cjs');
const { planFinalDelta, finalize } = require('../tools/final-delta.cjs');

function fixture() {
  let version = 0;
  const src = new Map(), dst = new Map();
  const writes = [];
  function put(map, name, text, owned = false) {
    const data = Buffer.from(text);
    map.set(name, { data, etag: `v${++version}`, metadata: { sha256: crypto.createHash('sha256').update(data).digest('hex'),
      originalmtime: '2026-10-01T00:00:00.000Z', ...(owned ? { erpmediacopy: OWNER } : {}) } });
  }
  const error = () => Object.assign(new Error('ETag changed'), { statusCode: 412 });
  function client(map, writable) {
    return {
      async *listBlobsFlat() { for (const [name, file] of map) yield { name, metadata: file.metadata,
        properties: { etag: file.etag, contentLength: file.data.length, contentType: 'text/plain' } }; },
      getBlobClient(name) {
        const get = opts => {
          const file = map.get(name);
          if (!file) throw Object.assign(new Error('Missing'), { statusCode: 404 });
          if (opts?.conditions?.ifMatch && opts.conditions.ifMatch !== file.etag) throw error();
          return file;
        };
        return {
          async getProperties(opts) { const f = get(opts); return { etag: f.etag, metadata: f.metadata, contentLength: f.data.length, contentType: 'text/plain' }; },
          async download(_offset, _size, opts) { return { readableStreamBody: Readable.from([get(opts).data]) }; },
          async delete(opts) { assert.ok(writable); get(opts); writes.push('delete'); map.delete(name); },
          async syncCopyFromURL(_url, opts) {
            assert.ok(writable); const f = src.get(name);
            if (f.etag !== opts.sourceConditions.ifMatch) throw error();
            if (opts.conditions.ifMatch) get(opts);
            else if (map.has(name)) throw error();
            put(map, name, f.data, true); map.get(name).metadata = opts.metadata; writes.push('copy');
          },
        };
      },
    };
  }
  put(src, 'cdn/present.txt', 'new content');
  put(dst, 'cdn/deleted.txt', 'stale', true);
  const source = client(src, false), destination = client(dst, true);
  async function run(extra = {}) {
    const plan = await planFinalDelta(source, destination);
    return finalize({ source, destination, sign: () => 'synthetic-signed-source', approvedDigest: plan.digest,
      approvedDeleteCount: 1, checkFence: async () => true,
      retainPlan: async value => ({ verified: true, digest: value.digest }), ...extra });
  }
  return { src, dst, put, writes, source, destination, run };
}

test('frozen delta removes only reviewed owned stale objects and verifies copied bytes', async () => {
  const f = fixture(); const result = await f.run();
  assert.equal(result.deleted, 1); assert.equal(result.verified, 1);
  assert.equal(result.finalDeltaRequired, false); assert.equal(result.productionCutover, false);
  assert.equal(f.src.size, 1); assert.equal(f.dst.size, 1);
  assert.equal(f.dst.get('cdn/present.txt').data.toString(), 'new content');
});
test('unmanaged destination or unreviewed plan cannot authorize any mutation', async () => {
  const a = fixture(); a.put(a.dst, 'cdn/unmanaged.txt', 'keep');
  await assert.rejects(a.run(), /Unmanaged/); assert.equal(a.writes.length, 0);
  const b = fixture(); await assert.rejects(b.run({ approvedDigest: 'wrong' }), /Reviewed plan changed/);
  assert.equal(b.writes.length, 0);
});
test('fence failure or unverified private evidence prevents mutations', async () => {
  for (const extra of [{ checkFence: async () => false }, { retainPlan: async () => ({ verified: false }) }]) {
    const f = fixture(); await assert.rejects(f.run(extra)); assert.equal(f.writes.length, 0);
  }
});
test('source changes after retention and destination ETag races fail closed', async () => {
  const a = fixture(); await assert.rejects(a.run({ retainPlan: async plan => {
    a.put(a.src, 'cdn/late.txt', 'late'); return { verified: true, digest: plan.digest };
  } }), /Storage changed/); assert.equal(a.writes.length, 0);
  const b = fixture(); let checks = 0;
  await assert.rejects(b.run({ checkFence: async () => {
    if (++checks === 2) b.put(b.dst, 'cdn/deleted.txt', 'concurrently changed', true);
    return true;
  } }), error => error.statusCode === 412);
  assert.equal(b.dst.get('cdn/deleted.txt').data.toString(), 'concurrently changed');
});
test('loss of fencing after deletion never admits a destination copy', async () => {
  const f = fixture(); let checks = 0;
  await assert.rejects(f.run({ checkFence: async () => ++checks < 3 }));
  assert.deepEqual(f.writes, ['delete']); assert.equal(f.src.size, 1);
});
