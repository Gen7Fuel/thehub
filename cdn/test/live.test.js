const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const sharp = require('sharp');
const { createStorage, azureContainer } = require('../storage');
const { createApp } = require('../app');
const { randomUUID } = require('node:crypto');
const { migrate } = require('../migrate');
test('live Azure: isolated UUID upload, download, original dates, listing and deletion', { skip: process.env.CDN_LIVE_TEST !== '1' }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-cdn-live-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const container = azureContainer();
  const storage = createStorage({ env: { CDN_STORAGE: 'azure', CDN_UPLOADS_DIR: dir }, container });
  const names = [];
  t.after(async () => { for (const name of names) await container.getBlockBlobClient('cdn/' + name).deleteIfExists(); });
  // Capture generated names before sending to Azure so even a response failure can be cleaned up.
  const put = storage.put;
  storage.put = async (name, buffer) => { names.push(name); await put(name, buffer); };
  const listener = createApp({ env: { CDN_ADMIN_TOKEN: 'local-live-test' }, storage }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); }));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).jpeg().toBuffer();
  for (const endpoint of ['/cdn/upload', '/cdn/upload-base64', '/cdn/upload-png']) {
    let options;
    if (endpoint.endsWith('base64')) options = { headers: { 'Content-Type': 'application/json' }, body: '{"base64Data":"aGVsbG8=","fileName":"test.txt"}' };
    else { const form = new FormData(); form.append('file', new Blob([image]), 'test.jpg'); options = { body: form }; }
    const response = await fetch(base + endpoint, { method: 'POST', ...options });
    assert.equal(response.status, 200);
    const { filename } = await response.json();
    const download = await fetch(base + '/cdn/download/' + filename);
    assert.equal(download.status, 200);
    const buffer = Buffer.from(await download.arrayBuffer());
    if (endpoint.endsWith('base64')) assert.equal(buffer.toString(), 'hello');
    else if (endpoint.endsWith('png')) assert.equal((await sharp(buffer).metadata()).format, 'png');
    else assert.deepEqual(buffer, image);
    const range = await fetch(base + '/cdn/download/' + filename, { headers: { Range: 'bytes=0-1' } });
    assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), buffer.subarray(0, 2));
  }
  const list = await storage.list();
  for (const filename of names) {
    const row = list.find(file => file.filename === filename); assert.ok(row);
    assert.ok(Number.isFinite(Date.parse(row.lastModified)));
    assert.equal((await fetch(base + '/cdn/delete/' + filename, { method: 'DELETE', headers: { Authorization: 'Bearer local-live-test' } })).status, 200);
    assert.equal((await fetch(base + '/cdn/download/' + filename)).status, 404);
  }
  assert.deepEqual(await fs.readdir(dir), []);
});

test('live Azure: migration copy, delta, checksums, stale reconciliation and independent verification', { skip: process.env.CDN_LIVE_TEST !== '1' }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-cdn-live-migration-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const real = azureContainer();
  // All operations are isolated beneath this unique test prefix, including list/prune.
  // Production CDN listing excludes nested names and never returns these objects.
  const root = `cdn/.migration-test-${randomUUID()}/`;
  const container = {
    getBlockBlobClient: name => real.getBlockBlobClient(root + name),
    async *listBlobsFlat(options) {
      for await (const blob of real.listBlobsFlat({ ...options, prefix: root + options.prefix })) {
        yield { ...blob, name: blob.name.slice(root.length) };
      }
    },
  };
  t.after(async () => {
    const names = [];
    for await (const blob of real.listBlobsFlat({ prefix: root })) names.push(blob.name);
    // HNS accounts return actual directories: delete children before their parents.
    names.sort((a, b) => b.length - a.length);
    for (const name of names) await real.getBlockBlobClient(name).deleteIfExists();
    await real.getBlockBlobClient(root.slice(0, -1)).deleteIfExists();
  });
  const run = mode => migrate({ mode, dir, container, log() {} });
  await fs.writeFile(path.join(dir, 'historical.txt'), 'historical file');
  await fs.utimes(path.join(dir, 'historical.txt'), new Date('2024-03-01'), new Date('2024-03-01'));
  await fs.writeFile(path.join(dir, 'deleted.txt'), 'will be deleted');
  assert.equal((await run('copy')).copied, 2);
  assert.equal((await run('copy')).unchanged, 2);
  await fs.unlink(path.join(dir, 'deleted.txt'));
  await fs.writeFile(path.join(dir, 'new.txt'), 'arrived during online copy');
  await fs.writeFile(path.join(dir, '.cdn-maintenance.json'), '{"paused":true,"drained":true}');
  const final = await run('finalize');
  assert.equal(final.verified, 2); assert.equal(final.copied, 1); assert.equal(final.removed, 1);
  const verified = await run('verify');
  assert.equal(verified.manifestSha256, final.manifestSha256);
  assert.equal((await container.getBlockBlobClient('cdn/historical.txt').getProperties()).metadata.originalmtime, '2024-03-01T00:00:00.000Z');
});
