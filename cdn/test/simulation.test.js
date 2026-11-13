const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { BlobServiceClient } = require('@azure/storage-blob');
const { createStorage } = require('../storage');
const { createApp } = require('../app');
test('real Azure SDK over HTTP: storage outage returns retryable failure without local writes', { skip: !process.env.CDN_SIMULATION_URL }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-cdn-simulation-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const connectionString = `DefaultEndpointsProtocol=http;AccountName=testaccount;AccountKey=${Buffer.alloc(32).toString('base64')};BlobEndpoint=${process.env.CDN_SIMULATION_URL}/azure/testaccount;`;
  const container = BlobServiceClient.fromConnectionString(connectionString, { retryOptions: { maxTries: 1 } }).getContainerClient('files');
  const env = { CDN_STORAGE: 'azure', CDN_UPLOADS_DIR: dir, CDN_ADMIN_TOKEN: 'test' };
  const storage = createStorage({ env, container });
  const app = createApp({ env, storage });
  const listener = app.listen(0, '127.0.0.1'); await once(listener, 'listening');
  t.after(() => new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); }));
  const base = `http://127.0.0.1:${listener.address().port}`;
  for (const [endpoint, options] of [
    ['/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"base64Data":"aGk=","fileName":"test.txt"}' }],
    ['/cdn/download/test.txt', {}],
    ['/cdn/files', { headers: { Authorization: 'Bearer test' } }],
    ['/cdn/delete/test.txt', { method: 'DELETE', headers: { Authorization: 'Bearer test' } }],
  ]) {
    const response = await fetch(base + endpoint, options);
    assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '60');
    assert.match((await response.json()).error, /temporarily unavailable/);
  }
  assert.deepEqual(await fs.readdir(dir), []);
});
