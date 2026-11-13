const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { migrate } = require('../migrate');
const { fakeContainer } = require('./helpers');
const { createStorage } = require('../storage');
async function setup(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-cdn-migrate-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const container = fakeContainer();
  const run = mode => migrate({ mode, dir, container, log() {} });
  const pause = () => fs.writeFile(path.join(dir, '.cdn-maintenance.json'), '{"paused":true,"drained":true}');
  return { dir, container, run, pause };
}
test('resumable copy, final delta, original dates, stale reconciliation and full verification', async t => {
  const { dir, container, run, pause } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.pdf'), 'receipt');
  await fs.utimes(path.join(dir, 'a.pdf'), new Date('2024-01-03'), new Date('2024-01-03'));
  await fs.writeFile(path.join(dir, 'deleted.txt'), 'stale');
  await container.getBlockBlobClient('cdn/.keep').uploadData(Buffer.alloc(0));
  await container.getBlockBlobClient('cdn/test-directory').uploadData(Buffer.alloc(0), { metadata: { hdi_isfolder: 'true' } });
  await container.getBlockBlobClient('cdn_backup/archive.tar').uploadData(Buffer.from('backup'));
  assert.equal((await run('copy')).copied, 2);
  assert.equal((await run('copy')).unchanged, 2);
  await fs.unlink(path.join(dir, 'deleted.txt'));
  await fs.writeFile(path.join(dir, 'new.txt'), 'new');
  await assert.rejects(run('finalize'));
  await pause();
  const final = await run('finalize');
  assert.equal(final.copied, 1); assert.equal(final.removed, 1); assert.equal(final.verified, 2);
  const verify = await run('verify');
  assert.equal(verify.manifestSha256, final.manifestSha256); assert.equal(verify.verified, 2);
  assert.ok(container.blobs.has('cdn_backup/archive.tar')); assert.ok(container.blobs.has('cdn/.keep'));
  const storage = createStorage({ env: { CDN_STORAGE: 'azure', CDN_UPLOADS_DIR: dir }, container });
  assert.equal((await storage.list()).find(file => file.filename === 'a.pdf').lastModified, '2024-01-03T00:00:00.000Z');
});
test('final verification detects corrupt content even when stored size and checksum metadata match', async t => {
  const { dir, container, run, pause } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.txt'), 'good'); await run('copy'); await pause();
  container.blobs.get('cdn/a.txt').data = Buffer.from('evil');
  container.blobs.get('cdn/a.txt').etag = '"changed"';
  await assert.rejects(run('finalize'), /checksum/);
});
test('migration refuses unmanaged conflicts and unexpected destination files', async t => {
  const { dir, container, run, pause } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.txt'), 'source');
  await container.getBlockBlobClient('cdn/a.txt').uploadData(Buffer.from('other'));
  await assert.rejects(run('copy'), /Unmanaged/);
  container.blobs.delete('cdn/a.txt'); await run('copy');
  await container.getBlockBlobClient('cdn/unmanaged.txt').uploadData(Buffer.from('other'));
  await pause(); await assert.rejects(run('finalize'), /Unexpected destination/);
  assert.ok(container.blobs.has('cdn/unmanaged.txt'));
});
test('copy updates a migration-owned changed file and preserves conditional writes', async t => {
  const { dir, container, run } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.txt'), 'old'); await run('copy');
  await fs.writeFile(path.join(dir, 'a.txt'), 'new data');
  assert.equal((await run('copy')).copied, 1);
  assert.equal(container.blobs.get('cdn/a.txt').data.toString(), 'new data');
});
test('finalization refuses an empty source and never removes Azure files in that case', async t => {
  const { dir, container, run, pause } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.txt'), 'keep'); await run('copy');
  await fs.unlink(path.join(dir, 'a.txt')); await pause();
  await assert.rejects(run('finalize'), /Source inventory is empty/);
  assert.ok(container.blobs.has('cdn/a.txt'));
});
test('migration lock rejects a second runner without removing the first lock', async t => {
  const { dir, run } = await setup(t);
  await fs.mkdir(path.join(dir, '.cdn-migration-state'));
  const filename = path.join(dir, '.cdn-migration-state', 'migration.lock');
  await fs.writeFile(filename, 'another process');
  await assert.rejects(run('copy'), { code: 'EEXIST' });
  assert.equal(await fs.readFile(filename, 'utf8'), 'another process');
});
test('online copy verifies content and finalization reuses only exact ETag-bound receipts', async t => {
  const { dir, container, run, pause } = await setup(t);
  await fs.writeFile(path.join(dir, 'a.txt'), 'first');
  const initial = await run('copy');
  assert.equal(initial.downloadedForVerification, 1);
  const repeat = await run('copy');
  assert.equal(repeat.downloadedForVerification, 0); assert.equal(repeat.receiptVerified, 1);
  await pause();
  const final = await run('finalize');
  assert.equal(final.downloadedForVerification, 0); assert.equal(final.receiptVerified, 1);
  // A metadata-only change still invalidates the proof and forces a new read-back.
  container.blobs.get('cdn/a.txt').etag = '"metadata-change"';
  assert.equal((await run('verify')).downloadedForVerification, 1);
});
test('concurrent transfers retain a deterministic final manifest across worker counts', async t => {
  const { dir, container, pause } = await setup(t);
  for (let i = 0; i < 9; i++) await fs.writeFile(path.join(dir, `${i}.txt`), `file ${i}`);
  await pause();
  const first = await migrate({ mode: 'finalize', dir, container, concurrency: 4, log() {} });
  const second = await migrate({ mode: 'verify', dir, container, concurrency: 1, log() {} });
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(second.receiptVerified, 9);
});
