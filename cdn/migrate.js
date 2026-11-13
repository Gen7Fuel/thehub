const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { azureContainer, validFilename, contentType, isDirectory, CONTROL_FILE, PREFIX } = require('./storage');

async function digest(stream) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}
function requirePause(dir) {
  const state = JSON.parse(fs.readFileSync(path.join(dir, CONTROL_FILE), 'utf8'));
  if (!state.paused || !state.drained) throw new Error('Pause and drain CDN writes through POST /cdn/maintenance first');
}
async function inventory(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isFile() || !validFilename(entry.name)) throw new Error('Unexpected directory, symlink, or invalid filename in uploads');
    const stat = await fs.promises.stat(path.join(dir, entry.name));
    files.push({ filename: entry.name, size: stat.size, mtime: stat.mtime.toISOString(), mtimeMs: stat.mtimeMs });
  }
  return files.sort((a, b) => a.filename.localeCompare(b.filename));
}
async function migrate(options) {
  const stateDir = options.stateDir || path.join(options.dir, '.cdn-migration-state');
  await fs.promises.mkdir(stateDir, { recursive: true });
  const lockPath = path.join(stateDir, 'migration.lock');
  const lock = await fs.promises.open(lockPath, 'wx');
  try { return await migrateLocked({ ...options, stateDir }); }
  finally { await lock.close(); await fs.promises.unlink(lockPath); }
}
async function migrateLocked({ mode, dir, stateDir, container, concurrency = 4, log = console.log }) {
  if (!['copy', 'finalize', 'verify'].includes(mode)) throw new Error('Mode must be copy, finalize, or verify');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Migration concurrency must be between 1 and 8');
  const final = mode !== 'copy';
  if (final) requirePause(dir);
  const started = Date.now();
  const files = await inventory(dir);
  if (final && !files.length) throw new Error('Source inventory is empty; review the volume mount before finalizing');
  const summary = { mode, files: files.length, bytes: 0, copied: 0, unchanged: 0, removed: 0,
    verified: 0, downloadedForVerification: 0, receiptVerified: 0 };
  const manifest = crypto.createHash('sha256');
  const manifestEntries = new Array(files.length);
  let completed = 0;
  async function processFile(file, index) {
    if (final) requirePause(dir);
    const filename = path.join(dir, file.filename);
    let sha;
    try { sha = await digest(fs.createReadStream(filename)); }
    catch (err) { if (!final && err.code === 'ENOENT') return; throw err; }
    const blob = container.getBlockBlobClient(PREFIX + file.filename);
    // A receipt is written only after a full read-back and source stability check.
    // Azure changes the ETag for content/metadata mutations, so matching receipts
    // let us do the bulk verification online rather than in the maintenance window.
    const receiptPath = blob.url ? path.join(stateDir,
      crypto.createHash('sha256').update(blob.url).digest('hex') + '.json') : null;
    let receipt;
    if (receiptPath) {
      try { receipt = JSON.parse(await fs.promises.readFile(receiptPath, 'utf8')); }
      catch (err) { if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) throw err; }
    }
    let props;
    try { props = await blob.getProperties(); }
    catch (err) { if (err.statusCode !== 404) throw err; }
    const matches = props?.metadata?.sha256 === sha && props.contentLength === file.size &&
      props.metadata.originalmtime === file.mtime;
    if (mode === 'verify' && !matches) throw new Error('Azure file or metadata differs from local source');
    if (!matches) {
      // Never overwrite a file belonging to a live Azure deployment or another uploader.
      if (props && props.metadata?.cdnmigration !== 'v1') throw new Error('Unmanaged destination conflict; refusing to overwrite');
      await blob.uploadFile(filename, {
        conditions: props ? { ifMatch: props.etag } : { ifNoneMatch: '*' },
        metadata: { sha256: sha, originalmtime: file.mtime, cdnmigration: 'v1' },
        blobHTTPHeaders: { blobContentType: contentType(file.filename) },
      });
      props = await blob.getProperties();
      summary.copied++;
    } else summary.unchanged++;
    const expectedReceipt = { etag: props.etag, sha256: sha, size: file.size, originalmtime: file.mtime };
    if (receiptPath && JSON.stringify(receipt) === JSON.stringify(expectedReceipt)) {
      summary.receiptVerified++;
    } else {
      const download = await blob.download(0, undefined, { conditions: { ifMatch: props.etag } });
      if (await digest(download.readableStreamBody) !== sha) throw new Error('Azure content checksum differs from local source');
      summary.downloadedForVerification++;
    }
    summary.verified++;
    let after;
    try { after = await fs.promises.stat(filename); }
    catch (err) { if (!final && err.code === 'ENOENT') return; throw err; }
    if (after.size !== file.size || after.mtimeMs !== file.mtimeMs) {
      throw new Error('Source changed during transfer; rerun migration');
    }
    if (receiptPath) {
      const temporary = receiptPath + '.tmp';
      await fs.promises.writeFile(temporary, JSON.stringify(expectedReceipt));
      await fs.promises.rename(temporary, receiptPath);
    }
    summary.bytes += file.size;
    manifestEntries[index] = JSON.stringify([file.filename, file.size, file.mtime, sha]);
    if (++completed % 100 === 0) log(JSON.stringify(summary));
  }
  let nextIndex = 0;
  let failure;
  const workers = Array.from({ length: concurrency }, async () => {
    while (!failure && nextIndex < files.length) {
      const index = nextIndex++;
      try { await processFile(files[index], index); }
      catch (err) { failure ||= err; }
    }
  });
  // Finish admitted transfers before releasing the lock after any failure.
  await Promise.all(workers);
  if (failure) throw failure;
  // Completion order varies with concurrency; the manifest order must not.
  for (const entry of manifestEntries) if (entry !== undefined) manifest.update(entry);
  if (final) {
    // Reconcile only migration-owned blobs that were deleted locally during the initial copy.
    const names = new Set(files.map(file => PREFIX + file.filename));
    const stale = [];
    for await (const blob of container.listBlobsFlat({ prefix: PREFIX, includeMetadata: true })) {
      if (isDirectory(blob)) continue;
      if (blob.name === 'cdn/.keep' || names.has(blob.name)) continue;
      if (!validFilename(blob.name.slice(PREFIX.length)) || blob.metadata?.cdnmigration !== 'v1') {
        throw new Error('Unexpected destination file; reconciliation requires review');
      }
      if (mode === 'verify') throw new Error('Destination contains a file absent from source');
      stale.push(blob);
    }
    for (const blob of stale) {
      requirePause(dir);
      await container.getBlockBlobClient(blob.name).delete({ conditions: { ifMatch: blob.properties.etag } });
      summary.removed++;
    }
    requirePause(dir);
    if (JSON.stringify(await inventory(dir)) !== JSON.stringify(files)) throw new Error('Source inventory changed during final verification');
    summary.manifestSha256 = manifest.digest('hex');
  }
  summary.seconds = Math.round((Date.now() - started) / 1000);
  log(JSON.stringify(summary));
  return summary;
}
if (require.main === module) {
  const mode = process.argv[2];
  const dir = path.resolve(process.env.CDN_UPLOADS_DIR || path.join(__dirname, 'uploads'));
  Promise.resolve().then(() => {
    if ((process.env.CDN_STORAGE || 'local') !== 'local') throw new Error('Run migration only while CDN_STORAGE=local');
    return migrate({ mode, dir, stateDir: process.env.CDN_MIGRATION_STATE_DIR,
      concurrency: Number(process.env.CDN_MIGRATION_CONCURRENCY || 4), container: azureContainer() });
  }).catch(err => {
    // Azure errors can contain request credentials; print only sanitized diagnostics.
    console.error('Migration failed:', err.statusCode ? `Azure HTTP ${err.statusCode}` : err.code || err.message);
    process.exitCode = 1;
  });
}
module.exports = { migrate, digest, inventory };
