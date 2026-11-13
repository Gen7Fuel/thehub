const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const sharp = require('sharp');
const { createApp } = require('../app');
const { createStorage } = require('../storage');
const { fakeContainer } = require('./helpers');

async function server(t, mode = 'local', container = fakeContainer()) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-cdn-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const env = { CDN_STORAGE: mode, CDN_UPLOADS_DIR: dir, CDN_ADMIN_TOKEN: 'test-token' };
  const storage = createStorage({ env, container });
  const app = createApp({ env, storage });
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); }));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const headers = { Authorization: 'Bearer test-token' };
  const pause = paused => fetch(base + '/cdn/maintenance', { method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ paused }) });
  return { base, headers, pause, storage, dir, container, env };
}
for (const mode of ['local', 'azure']) test(`${mode}: upload formats, downloads, listing, deletion, and persistent pause`, async t => {
  const { base, headers, pause, storage, dir, container, env } = await server(t, mode);
  const upload = async (endpoint, data, name) => {
    const form = new FormData(); form.append('file', new Blob([data]), name);
    const res = await fetch(base + endpoint, { method: 'POST', body: form });
    assert.equal(res.status, 200); return (await res.json()).filename;
  };
  const filename = await upload('/cdn/upload', 'hello pdf', 'receipt.pdf');
  let response = await fetch(base + '/cdn/download/' + filename);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.equal(await response.text(), 'hello pdf');
  const etag = response.headers.get('etag');
  response = await fetch(base + '/cdn/download/' + filename, { headers: { Range: 'bytes=1-3' } });
  assert.equal(response.status, 206); assert.equal(await response.text(), 'ell');
  response = await fetch(base + '/cdn/download/' + filename, { headers: { Range: 'bytes=999-1000' } });
  assert.equal(response.status, 416);
  response = await fetch(base + '/cdn/download/' + filename, { headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' } });
  assert.equal(response.status, 304);
  response = await fetch(base + '/cdn/download/' + filename, { method: 'HEAD' });
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-length'), '9');
  response = await fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'data:text/plain;base64,aGVsbG8=', fileName: 'note.txt' }) });
  assert.equal(response.status, 200);
  const base64Name = (await response.json()).filename;
  assert.equal(await (await fetch(base + '/cdn/download/' + base64Name)).text(), 'hello');
  const jpg = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const pngName = await upload('/cdn/upload-png', jpg, 'image.jpg');
  response = await fetch(base + '/cdn/download/' + pngName);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'png');
  if (mode === 'azure') {
    await container.getBlockBlobClient('cdn/.keep').uploadData(Buffer.alloc(0));
    await container.getBlockBlobClient('cdn/test-directory').uploadData(Buffer.alloc(0), { metadata: { hdi_isfolder: 'true' } });
    await container.getBlockBlobClient('cdn_backup/month.tar').uploadData(Buffer.from('backup'));
  }
  assert.equal((await fetch(base + '/cdn/files')).status, 401);
  const list = await (await fetch(base + '/cdn/files', { headers })).json();
  assert.equal(list.totalFiles, 3); assert.equal(list.currentPage, 1);
  assert.equal((await fetch(base + '/cdn/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"paused":true}' })).status, 401);
  response = await pause(true); assert.equal(response.status, 200);
  assert.equal((await response.json()).drained, true);
  for (const endpoint of ['/cdn/upload', '/cdn/upload-base64', '/cdn/upload-png']) {
    response = await fetch(base + endpoint, { method: 'POST' });
    assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '60');
  }
  assert.equal((await fetch(base + '/cdn/delete/' + filename, { method: 'DELETE', headers })).status, 503);
  assert.equal((await fetch(base + '/cdn/download/' + filename)).status, 200);
  // A new process using the same volume retains the pause.
  const restarted = createApp({ env, storage });
  assert.ok(restarted); assert.equal(JSON.parse(await fs.readFile(path.join(dir, '.cdn-maintenance.json'))).paused, true);
  await pause(false);
  assert.equal((await fetch(base + '/cdn/delete/' + filename, { method: 'DELETE', headers })).status, 200);
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 2);
  assert.equal((await fetch(base + '/cdn/download/' + filename)).status, 404);
  assert.equal((await fetch(base + '/cdn/download/.cdn-maintenance.json')).status, 400);
  if (mode === 'azure') assert.ok(container.blobs.has('cdn_backup/month.tar'));
});

test('pause waits for an admitted write before reporting drained', async t => {
  const { base, storage, pause } = await server(t);
  let release;
  let admitted;
  const started = new Promise(resolve => { admitted = resolve; });
  const originalPut = storage.put;
  storage.put = async (...args) => { admitted(); await new Promise(resolve => { release = resolve; }); await originalPut(...args); };
  const request = fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'aGk=', fileName: 'file.txt' }) });
  await started;
  let drained = false;
  const pausing = pause(true).then(response => { drained = true; return response; });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(drained, false);
  assert.equal((await fetch(base + '/cdn/upload', { method: 'POST' })).status, 503);
  release(); assert.equal((await request).status, 200);
  assert.equal((await (await pausing).json()).drained, true);
});

test('Azure failures never report upload success or fall back to local files', async t => {
  const { base, storage, dir } = await server(t, 'azure');
  storage.put = async () => { throw Object.assign(new Error('unavailable'), { statusCode: 503 }); };
  const response = await fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'aGk=', fileName: 'file.txt' }) });
  assert.equal(response.status, 503); assert.deepEqual(await fs.readdir(dir), []);
});

test('Azure pagination and overlapping list requests share one inventory refresh', async t => {
  const { base, headers, storage, container } = await server(t, 'azure');
  for (let i = 0; i < 205; i++) {
    await container.getBlockBlobClient(`cdn/${String(i).padStart(3, '0')}.txt`).uploadData(Buffer.from('x'));
  }
  let scans = 0;
  const original = storage.list;
  storage.list = async () => {
    scans++;
    await new Promise(resolve => setTimeout(resolve, 50));
    return original();
  };
  const pages = await Promise.all([1, 2, 3, 1].map(async page => {
    const response = await fetch(base + '/cdn/files?page=' + page, { headers });
    assert.equal(response.status, 200);
    return response.json();
  }));
  assert.equal(scans, 1);
  assert.deepEqual(pages.map(page => page.files.length), [100, 100, 5, 100]);
  assert.equal(new Set(pages.slice(0, 3).flatMap(page => page.files.map(file => file.filename))).size, 205);
  const upload = await fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'aGk=', fileName: 'new.txt' }) });
  assert.equal(upload.status, 200);
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 206);
  assert.equal(scans, 2);
});

test('expired inventories refresh and listing errors are not cached', async t => {
  const { base, headers, storage } = await server(t, 'azure');
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let scans = 0;
  storage.list = async () => {
    if (++scans === 1) throw new Error('Temporary list failure');
    return [];
  };
  assert.equal((await fetch(base + '/cdn/files', { headers })).status, 503);
  assert.equal((await fetch(base + '/cdn/files', { headers })).status, 200);
  assert.equal((await fetch(base + '/cdn/files', { headers })).status, 200);
  assert.equal(scans, 2);
  now += 30001;
  assert.equal((await fetch(base + '/cdn/files', { headers })).status, 200);
  assert.equal(scans, 3);
});

test('a refresh started before an upload cannot overwrite the newer cached inventory', async t => {
  const { base, headers, storage } = await server(t, 'azure');
  const original = storage.list;
  let release;
  let started;
  const firstStarted = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  let scans = 0;
  storage.list = async () => {
    const scan = ++scans;
    const inventory = await original();
    if (scan === 1) { started(); await barrier; }
    return inventory;
  };
  const first = fetch(base + '/cdn/files', { headers });
  await firstStarted;
  const uploaded = await fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'aGk=', fileName: 'new.txt' }) });
  assert.equal(uploaded.status, 200);
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 1);
  release();
  assert.equal((await (await first).json()).totalFiles, 0);
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 1);
  assert.equal(scans, 2);
});

test('failed writes invalidate listings even when the remote write committed', async t => {
  const { base, headers, storage } = await server(t, 'azure');
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 0);
  const original = storage.put;
  storage.put = async (...args) => { await original(...args); throw new Error('Response lost after write'); };
  const uploaded = await fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: 'aGk=', fileName: 'new.txt' }) });
  assert.equal(uploaded.status, 503);
  assert.equal((await (await fetch(base + '/cdn/files', { headers })).json()).totalFiles, 1);
});
