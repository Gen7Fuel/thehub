"""Stream to VPS with a base64 JSON bundle of prepared Desk source/backup code.

Credentials stay server-side in memory and child environment. Lists/reads live
media only; archive upload/readback is an in-memory test destination. Does not
change worker configuration, status, source media, Azure roles or GitHub secrets.
"""
import base64
import json
import os
import subprocess
import sys


def inspect(name):
    result = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True, timeout=20, check=True)
    return json.loads(result.stdout)[0]


def environment(item):
    return dict(value.split('=', 1) for value in item['Config']['Env'] if '=' in value)


def main():
    bundle = json.loads(base64.b64decode(sys.argv[1], validate=True))
    protected = ['backend', 'cdn', 'webserver', 'desk-cdn-backup']
    before = {name: inspect(name) for name in protected}
    identity = environment(before['backend'])
    assert identity['AZURE_CLIENT_ID'] == '8dec8f37-a249-4fd6-98e6-9643c7f87f5a'
    assert identity['AZURE_TENANT_ID'] == '21634e14-74fa-410a-8886-4c3f808b58cb'
    assert identity['AZURE_CLIENT_SECRET']
    values = {
        'CDN_BACKUP_SOURCE_ACCOUNT': 'gen7erpmedia29b24248',
        'CDN_BACKUP_SOURCE_CONTAINER': 'hub',
        'CDN_BACKUP_SOURCE_TENANT_ID': identity['AZURE_TENANT_ID'],
        'CDN_BACKUP_SOURCE_CLIENT_ID': identity['AZURE_CLIENT_ID'],
        'CDN_BACKUP_SOURCE_CLIENT_SECRET': identity['AZURE_CLIENT_SECRET'],
    }
    code = r"""
process.on('uncaughtException', error => {
  console.error(JSON.stringify({ success: false, errorType: error.name, code: error.code || null }));
  process.exit(1);
});
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { Readable } = require('node:stream');
const Module = require('node:module');
const crypto = require('node:crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const bundle = BUNDLE;
function load(code, name, source) {
  const m = new Module('/app/apps/cdn/' + name, module);
  m.filename = '/app/apps/cdn/' + name;
  m.paths = Module._nodeModulePaths('/app/apps/cdn');
  if (source) {
    const actual = m.require.bind(m);
    m.require = name => name === './cdn.backup-source' ? source : actual(name);
  }
  m._compile(code, m.filename);
  return m.exports;
}
async function main() {
  const helper = load(bundle.source, 'cdn.backup-source.probe.js');
  const backup = load(bundle.backup, 'cdn.backup.probe.js', helper);
  const original = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(process.env.AZURE_CONTAINER);
  const source = helper.sourceContainer(original);
  assert.notEqual(new URL(source.url).hostname, new URL(original.url).hostname);
  const files = await backup.inventory(source);
  assert.ok(files.length > 0);
  const sample = files.find(file => file.size > 0 && file.size <= 1024 * 1024);
  assert.ok(sample, 'No bounded sample available');
  // Actual new-account read, pinned to the inventory ETag.
  const read = await source.getBlobClient(sample.source).download(0, undefined, { conditions: { ifMatch: sample.etag } });
  const chunks = [];
  for await (const chunk of read.readableStreamBody) chunks.push(chunk);
  const expected = Buffer.concat(chunks);
  assert.equal(expected.length, sample.size);
  const sha256 = crypto.createHash('sha256').update(expected).digest('hex');
  if (sample.sourceSha256) assert.equal(sha256, sample.sourceSha256);
  // Exercise the prepared archiver inside the existing Linux Desk image.
  // Both archive "upload" and readback are memory only; no Azure writes occur.
  const blobs = new Map();
  const sink = { url: 'https://in-memory-test.invalid/hub', getBlockBlobClient(name) {
    return {
      async uploadFile(file) { blobs.set(name, await fs.readFile(file)); return { etag: 'probe-etag' }; },
      async uploadData(bytes) { blobs.set(name, Buffer.from(bytes)); },
      async download(_start, _end, options) {
        assert.equal(options.conditions.ifMatch, 'probe-etag');
        return { readableStreamBody: Readable.from([blobs.get(name)]) };
      },
    };
  } };
  const result = await backup.archive(sink, sample.lastModified.slice(0, 7), [sample], () => {},
    'daily', new Date(), async () => {}, source);
  const receipt = JSON.parse(blobs.get(result.manifestName));
  assert.equal(receipt.source, helper.sourceId(source));
  assert.equal(receipt.files[0].sha256, sha256);
  assert.equal(receipt.files[0].lastModified, sample.lastModified);
  assert.equal(result.fileCount, 1);
  // Read existing backup control to confirm original destination remains usable.
  // Never acquire its lease, enqueue requests, tick the worker or overwrite it.
  const status = await backup.status(original);
  console.log(JSON.stringify({ success: true, sourceAccount: 'gen7erpmedia29b24248',
    identityClientId: process.env.CDN_BACKUP_SOURCE_CLIENT_ID,
    sourceFilesListed: files.length, sourceBytesListed: files.reduce((n, f) => n + f.size, 0),
    sampleReadBytes: sample.size, conditionalReadPassed: true, sourceChecksumChecked: Boolean(sample.sourceSha256),
    preparedArchiveAndMemoryReadbackPassed: true, sourceProvenanceAndDatesPassed: true,
    originalBackupStatusReadable: true, existingBackupPhase: status.current?.phase || null,
    azureWrites: 0, workerConfigurationChanged: false }));
}
main().catch(error => {
  console.error(JSON.stringify({ success: false, errorType: error.name, code: error.code || null,
    statusCode: error.statusCode || null }));
  process.exitCode = 1;
});
""".replace('BUNDLE', json.dumps(bundle))
    args = ['docker', 'exec', '-i']
    for name in values:
        args += ['-e', name]
    args += ['desk-cdn-backup', 'node']
    result = subprocess.run(args, input=code, text=True, capture_output=True,
                            env={**os.environ, **values}, timeout=180)
    if result.returncode:
        # Node emits only the allowlisted failure record; never forward raw stderr.
        try:
            failure = json.loads(result.stderr.strip().splitlines()[-1])
            print(json.dumps({key: failure.get(key) for key in ['success', 'errorType', 'code', 'statusCode']}))
        except Exception:
            import re
            codes = re.findall(r"(?:code:|\"code\":)\s*['\"]([A-Z_]+)['\"]", result.stderr)
            print(json.dumps({'success': False, 'errorType': 'ReaderProbeFailed', 'code': codes[-1] if codes else None,
                              'syntaxError': 'SyntaxError' in result.stderr}))
        sys.exit(1)
    report = json.loads(result.stdout)
    for name, original in before.items():
        current = inspect(name)
        assert current['Id'] == original['Id'] and current['State']['StartedAt'] == original['State']['StartedAt']
        assert current['Config']['Env'] == original['Config']['Env']
    report['productionContainersAndEnvironmentsUnchanged'] = True
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'success': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
