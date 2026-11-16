// Controlled live checks on the new, empty Azure destination only.
// Token values remain in memory; only UUIDs returned by our own uploads are deleted.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('../../../../cdn/node_modules/sharp');
const python = 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe';
const subscription = '29b24248-1990-4592-b25d-e6ee8e9db784';
const app = 'gen7erp-cdn-prod-29b24248';
const base = `https://${app}.azurewebsites.net`;
const expectedRelease = process.argv[2];
const runLabel = process.argv[3];
function az(args) {
  const result = spawnSync(python, ['-IBm', 'azure.cli', ...args, '--output', 'json'], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('Azure CLI operation failed');
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
async function main() {
  assert.match(expectedRelease || '', /^[a-f0-9]{40}$/);
  if (runLabel && !/^[a-z0-9-]+$/.test(runLabel)) throw new Error('Invalid diagnostic run label');
  const destination = path.resolve(__dirname, `../diagnostics/preview-verification-2026-11-16${runLabel ? '-' + runLabel : ''}.json`);
  if (fs.existsSync(destination)) throw new Error('Live preview verification already recorded; refusing repeat');
  const accessToken = az(['account', 'get-access-token', '--subscription', subscription,
    '--resource', 'https://vault.azure.net']).accessToken;
  const secretResponse = await fetch('https://gen7erp-cdn-29b24248.vault.azure.net/secrets/cdn-admin-token?api-version=7.4', {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000),
  });
  assert.equal(secretResponse.status, 200);
  const secret = await secretResponse.json();
  const adminHeaders = { Authorization: `Bearer ${secret.value}` };
  const created = new Set();
  const deleted = new Set();
  const evidence = { started: new Date().toISOString(), app, base, expectedRelease, checks: [], createdFiles: [], deletedFiles: [] };
  async function request(endpoint, options = {}, status = 200) {
    const response = await fetch(base + endpoint, { ...options, signal: AbortSignal.timeout(45000), cache: 'no-store' });
    assert.equal(response.status, status, `${options.method || 'GET'} ${endpoint}`);
    return response;
  }
  const list = async (page = 1) => (await request('/cdn/files?page=' + page, { headers: adminHeaders })).json();
  const pause = async paused => (await request('/cdn/maintenance', { method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ paused }) })).json();
  async function ready(paused, previousStart) {
    for (let attempt = 0; attempt < 48; attempt++) {
      try {
        const health = await (await request('/cdn/health')).json();
        assert.equal(health.status, 'ok'); assert.equal(health.storage, 'azure');
        assert.equal(health.release, expectedRelease); assert.equal(health.paused, paused);
        assert.ok(Number.isFinite(Date.parse(health.processStartedAt)), 'Process start timestamp required');
        if (previousStart) assert.ok(Date.parse(health.processStartedAt) > Date.parse(previousStart), 'Waiting for a new process after restart');
        if (paused) assert.equal(health.drained, true);
        return health;
      } catch (error) { if (attempt === 47) throw error; await delay(5000); }
    }
  }
  async function upload(endpoint, body, headers) {
    const data = await (await request(endpoint, { method: 'POST', body, headers })).json();
    assert.match(data.filename, /^[a-f0-9-]{36}\.[a-z]+$/);
    created.add(data.filename);
    return data.filename;
  }
  function form(buffer, name) { const data = new FormData(); data.append('file', new Blob([buffer]), name); return data; }
  function check(name) { evidence.checks.push(name); console.log(name); }
  let exercising = false;
  try {
    await ready(true);
    assert.equal((await list()).totalFiles, 0, 'Preview must start with an empty media inventory');
    await request('/cdn/files', {}, 401);
    await request('/cdn/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"paused":false}' }, 401);
    await request('/cdn/upload', { method: 'POST' }, 503);
    check('Initial release, managed-identity readiness, pause and admin authorization verified');
    exercising = true;
    await pause(false);
    const text = await upload('/cdn/upload', form('azure-preview-check', 'preview.txt'));
    const download = await request('/cdn/download/' + text);
    assert.equal(await download.text(), 'azure-preview-check');
    const etag = download.headers.get('etag');
    assert.ok(etag);
    assert.equal(await (await request('/cdn/download/' + text, { headers: { Range: 'bytes=0-4' } }, 206)).text(), 'azure');
    await request('/cdn/download/' + text, { headers: { Range: 'bytes=999-1000' } }, 416);
    // fetch(cache=no-store) otherwise supplies Cache-Control: no-cache, which
    // deliberately makes Express req.fresh false even for a matching ETag.
    await request('/cdn/download/' + text, { headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' } }, 304);
    const head = await request('/cdn/download/' + text, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), String(Buffer.byteLength('azure-preview-check')));
    check('Multipart upload, exact download, HEAD, byte ranges and conditional reads verified');
    const base64 = await upload('/cdn/upload-base64', JSON.stringify({ base64Data: 'aGVsbG8=', fileName: 'preview.txt' }), { 'Content-Type': 'application/json' });
    assert.equal(await (await request('/cdn/download/' + base64)).text(), 'hello');
    const jpg = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
    const png = await upload('/cdn/upload-png', form(jpg, 'preview.jpg'));
    const image = Buffer.from(await (await request('/cdn/download/' + png)).arrayBuffer());
    assert.equal((await sharp(image).metadata()).format, 'png');
    check('Base64 upload and native Linux sharp PNG conversion verified');
    // Fill two API pages using tiny, separately tracked temporary files.
    for (let offset = 0; offset < 98; offset += 4) {
      const batch = await Promise.allSettled(Array.from({ length: Math.min(4, 98 - offset) }, () => upload('/cdn/upload-base64',
        '{"base64Data":"eA==","fileName":"pagination.txt"}', { 'Content-Type': 'application/json' })));
      const failed = batch.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
    const pages = await Promise.all([list(1), list(2)]);
    assert.equal(pages[0].totalFiles, 101); assert.equal(pages[0].totalPages, 2);
    assert.equal(pages[0].files.length, 100); assert.equal(pages[1].files.length, 1);
    assert.deepEqual(new Set(pages.flatMap(page => page.files.map(file => file.filename))), created);
    check('Real Azure inventory pagination verified across 101 isolated files');
    const activeBeforeRestart = await ready(false);
    az(['webapp', 'restart', '--subscription', subscription, '--resource-group', 'Gen7ERP', '--name', app]);
    await ready(false, activeBeforeRestart.processStartedAt);
    assert.equal(await (await request('/cdn/download/' + text)).text(), 'azure-preview-check');
    check('Explicit unpause and media reads survive actual App Service restart');
  } catch (error) {
    evidence.failure = error.message;
    process.exitCode = 1;
  } finally {
    if (exercising) {
      try {
        await pause(false);
        for (const filename of created) {
          await request('/cdn/delete/' + filename, { method: 'DELETE', headers: adminHeaders });
          deleted.add(filename);
        }
        assert.equal((await list()).totalFiles, 0);
        check(`All ${created.size} temporary files deleted; destination inventory empty`);
      } catch (error) { evidence.cleanupFailure = error.message; process.exitCode = 1; }
      finally {
        try {
          const state = await pause(true); assert.equal(state.drained, true);
          const pausedBeforeRestart = await ready(true);
          az(['webapp', 'restart', '--subscription', subscription, '--resource-group', 'Gen7ERP', '--name', app]);
          evidence.finalHealth = await ready(true, pausedBeforeRestart.processStartedAt);
          await request('/cdn/upload-base64', { method: 'POST' }, 503);
          check('Persistent pause survives actual restart; preview ends paused and drained');
        } catch (error) { evidence.pauseFailure = error.message; process.exitCode = 1; }
      }
    }
    evidence.finished = new Date().toISOString();
    evidence.createdFiles = [...created]; evidence.deletedFiles = [...deleted];
    evidence.success = !evidence.failure && !evidence.cleanupFailure && !evidence.pauseFailure;
    fs.writeFileSync(destination, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ success: evidence.success, created: created.size, deleted: deleted.size, evidence: destination }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
