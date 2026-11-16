// Online Blob-to-Blob baseline. Never deletes or writes source objects and
// never reconciles destination deletions. Final pause/delta/cutover is separate.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validFilename, isDirectory } = require('../storage');
const OWNER = 'gen7fuel-to-gen7erp-v1';

async function inventory(container) {
  const files = [];
  for await (const blob of container.listBlobsFlat({ prefix: 'cdn/', includeMetadata: true })) {
    if (blob.name === 'cdn/.keep' || isDirectory(blob)) continue;
    assert.ok(blob.name.startsWith('cdn/') && validFilename(blob.name.slice(4)), 'Unexpected CDN blob name');
    assert.match(blob.metadata?.sha256 || '', /^[a-f0-9]{64}$/, 'Source checksum metadata missing');
    assert.ok(Number.isFinite(Date.parse(blob.metadata.originalmtime)), 'Original date metadata missing');
    assert.ok(blob.properties.etag && Number.isSafeInteger(blob.properties.contentLength), 'Source properties missing');
    assert.ok(blob.properties.contentLength <= 256 * 1024 * 1024, 'Source exceeds synchronous copy size limit');
    files.push({ name: blob.name, size: blob.properties.contentLength, etag: blob.properties.etag,
      sha256: blob.metadata.sha256, originalmtime: blob.metadata.originalmtime,
      contentType: blob.properties.contentType, metadata: { ...blob.metadata } });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
function manifest(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(JSON.stringify([file.name, file.size, file.originalmtime, file.sha256]) + '\n');
  return hash.digest('hex');
}
async function properties(blob) {
  try { return await blob.getProperties(); }
  catch (error) { if (error.statusCode === 404) return null; throw error; }
}
function owned(metadata) { return metadata?.erpmediacopy === OWNER; }
function matches(props, file) {
  return props && owned(props.metadata) && props.contentLength === file.size &&
    props.metadata.erpmediasourceetag === Buffer.from(file.etag).toString('base64') &&
    props.metadata.sha256 === file.sha256 && props.metadata.originalmtime === file.originalmtime &&
    props.contentType === file.contentType;
}
async function digest(stream) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}
async function copyAndVerify({ source, destination, sign, concurrency = 4, report = () => {}, receipt = () => {}, beforeWrite = async () => {} }) {
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 8);
  const files = await inventory(source);
  assert.ok(files.length > 0, 'Refusing an empty source');
  const names = new Set(files.map(file => file.name));
  for await (const blob of destination.listBlobsFlat({ prefix: 'cdn/', includeMetadata: true })) {
    assert.ok(owned(blob.metadata), 'Unmanaged destination object; refusing mutation');
    assert.ok(names.has(blob.name), 'Destination has a stale migration object; review before continuing');
  }
  const summary = { started: new Date().toISOString(), phase: 'copy-and-verify', files: files.length,
    sourceBytes: files.reduce((sum, file) => sum + file.size, 0), copied: 0, reused: 0,
    verified: 0, verifiedBytes: 0, manifestSha256: manifest(files) };
  await report(summary, files);
  let cursor = 0;
  let failure;
  async function worker() {
    while (!failure && cursor < files.length) {
      const file = files[cursor++];
      try {
        const from = source.getBlobClient(file.name);
        const to = destination.getBlobClient(file.name);
        let props = await properties(to);
        if (!matches(props, file)) {
          assert.ok(!props || owned(props.metadata), 'Unmanaged destination conflict');
          await beforeWrite();
          // SAS is scoped to this one source blob, read-only and short-lived.
          // It is never persisted in receipts, exceptions or logs.
          await to.syncCopyFromURL(await sign(file), {
            sourceConditions: { ifMatch: file.etag },
            conditions: props ? { ifMatch: props.etag } : { ifNoneMatch: '*' },
            metadata: { ...file.metadata, erpmediacopy: OWNER, erpmediasourceetag: Buffer.from(file.etag).toString('base64') },
          });
          summary.copied++;
          props = await properties(to);
        } else summary.reused++;
        assert.ok(matches(props, file), 'Copied properties differ from source inventory');
        const downloaded = await to.download(0, undefined, { conditions: { ifMatch: props.etag } });
        assert.equal(await digest(downloaded.readableStreamBody), file.sha256, 'Destination byte checksum differs');
        const finalProps = await to.getProperties({ conditions: { ifMatch: props.etag } });
        assert.equal(finalProps.etag, props.etag, 'Destination changed during verification');
        await from.getProperties({ conditions: { ifMatch: file.etag } });
        summary.verified++; summary.verifiedBytes += file.size;
        await receipt({ name: file.name, sourceEtag: file.etag, destinationEtag: props.etag,
          size: file.size, sha256: file.sha256, originalmtime: file.originalmtime, verifiedAt: new Date().toISOString() });
        if (summary.verified % 50 === 0) await report(summary);
      } catch (error) {
        failure ||= Object.assign(new Error('Copy or verification failed'), {
          code: error.code || error.name, file: file.name,
        });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (failure) {
    summary.phase = 'failed'; summary.failedFile = failure.file; summary.errorCode = failure.code;
    await report(summary); throw failure;
  }
  const finalSource = await inventory(source);
  const finalDestination = await inventory(destination);
  summary.snapshotVerified = true;
  summary.sourceManifestAfter = manifest(finalSource);
  summary.destinationManifest = manifest(finalDestination);
  summary.sourceUnchanged = manifest(files) === summary.sourceManifestAfter && files.length === finalSource.length &&
    files.every((file, index) => file.etag === finalSource[index].etag);
  assert.equal(summary.destinationManifest, summary.manifestSha256, 'Final destination inventory differs from verified snapshot');
  assert.equal(finalDestination.length, files.length);
  summary.phase = 'online-baseline-verified'; summary.completed = new Date().toISOString();
  summary.productionCutover = false; summary.finalDeltaRequired = true;
  await report(summary);
  return summary;
}

async function main() {
  const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } = require('@azure/storage-blob');
  const { AzureCliCredential } = require('@azure/identity');
  const sourceService = BlobServiceClient.fromConnectionString(process.env.CDN_COPY_SOURCE_CONNECTION_STRING || '');
  assert.equal(new URL(sourceService.url).hostname, 'gen7fuel.blob.core.windows.net');
  const source = sourceService.getContainerClient('hub');
  const destination = new BlobServiceClient('https://gen7erpmedia29b24248.blob.core.windows.net', new AzureCliCredential()).getContainerClient('hub');
  const reportDir = process.env.CDN_COPY_REPORT_DIR;
  assert.ok(reportDir, 'Separate report directory required');
  fs.mkdirSync(reportDir, { recursive: true });
  const lock = path.join(reportDir, 'running.lock');
  const handle = fs.openSync(lock, 'wx');
  let lastPauseCheck = 0;
  async function beforeWrite() {
    if (Date.now() - lastPauseCheck < 10000) return;
    const response = await fetch('https://gen7erp-cdn-prod-29b24248.azurewebsites.net/cdn/health', { signal: AbortSignal.timeout(30000), cache: 'no-store' });
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.ok(health.status === 'ok' && health.storage === 'azure' && health.paused && health.drained,
      'Azure preview must remain healthy, paused and drained');
    lastPauseCheck = Date.now();
  }
  try {
    await beforeWrite();
    const result = await copyAndVerify({ source, destination, beforeWrite,
      sign: file => {
        const query = generateBlobSASQueryParameters({ containerName: 'hub', blobName: file.name,
          permissions: BlobSASPermissions.parse('r'), protocol: SASProtocol.Https,
          startsOn: new Date(Date.now() - 5 * 60000), expiresOn: new Date(Date.now() + 10 * 60000) }, sourceService.credential);
        return source.getBlobClient(file.name).url + '?' + query.toString();
      },
      receipt: entry => fs.appendFileSync(path.join(reportDir, 'verified.jsonl'), JSON.stringify(entry) + '\n'),
      report: (summary, files) => {
        if (files) fs.writeFileSync(path.join(reportDir, 'source-inventory.json'), JSON.stringify(files.map(({ metadata, ...file }) => file)));
        fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify({ phase: summary.phase, files: summary.files, copied: summary.copied,
          reused: summary.reused, verified: summary.verified, verifiedBytes: summary.verifiedBytes,
          sourceUnchanged: summary.sourceUnchanged, failedFile: summary.failedFile, errorCode: summary.errorCode }));
      },
    });
    assert.equal(result.verified, result.files);
  } finally { fs.closeSync(handle); fs.unlinkSync(lock); }
}
if (require.main === module) main().catch(error => {
  // Raw SDK exceptions can contain signed URLs. Never print them.
  console.error(JSON.stringify({ operation: 'cdn-media-copy', errorCode: error.code || error.name,
    file: error.file, success: false })); process.exitCode = 1;
});
module.exports = { copyAndVerify, inventory, manifest, OWNER };
