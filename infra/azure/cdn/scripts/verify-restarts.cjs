// Observe a new app process after each restart; never accept the old worker.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const python = 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe';
const release = process.argv[2];
const base = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net';
function az(args) {
  const result = spawnSync(python, ['-IBm', 'azure.cli', ...args, '--output', 'json'], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error('Azure CLI request failed');
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
function http(endpoint, { token, paused } = {}) {
  let config = `silent\nshow-error\nfail\nmax-time = 20\nurl = ${JSON.stringify(base + endpoint)}\n`;
  if (token) config += `header = ${JSON.stringify('Authorization: Bearer ' + token)}\n`;
  if (paused !== undefined) config += `request = POST\nheader = "Content-Type: application/json"\ndata = ${JSON.stringify(JSON.stringify({ paused }))}\n`;
  const result = spawnSync('curl.exe', ['--config', '-'], { input: config, encoding: 'utf8', timeout: 25000 });
  if (result.status !== 0) throw new Error('Preview HTTP request failed');
  return JSON.parse(result.stdout);
}
async function main() {
  assert.match(release || '', /^[a-f0-9]{40}$/);
  const record = path.resolve(__dirname, '../diagnostics/restart-process-verification-2026-11-16.json');
  assert.ok(!fs.existsSync(record), 'Restart verification already recorded');
  const token = az(['keyvault', 'secret', 'show', '--vault-name', 'gen7erp-cdn-29b24248', '--name', 'cdn-admin-token', '--query', 'value']);
  const report = { started: new Date().toISOString(), release, checks: [] };
  async function ready(paused, previous) {
    for (let attempt = 0; attempt < 36; attempt++) {
      try {
        const health = http('/cdn/health');
        assert.equal(health.release, release); assert.equal(health.status, 'ok'); assert.equal(health.storage, 'azure');
        assert.equal(health.paused, paused); if (paused) assert.equal(health.drained, true);
        assert.ok(Number.isFinite(Date.parse(health.processStartedAt)));
        if (previous) assert.ok(Date.parse(health.processStartedAt) > Date.parse(previous));
        return health;
      } catch (error) { if (attempt === 35) throw error; await delay(5000); }
    }
  }
  const restart = () => az(['webapp', 'restart', '--resource-group', 'Gen7ERP', '--name', 'gen7erp-cdn-prod-29b24248']);
  try {
    await ready(true);
    http('/cdn/maintenance', { token, paused: false });
    const before = await ready(false); restart();
    const after = await ready(false, before.processStartedAt);
    report.checks.push({ state: 'unpaused', before: before.processStartedAt, after: after.processStartedAt });
    console.log('Explicit unpause survived a confirmed new App Service process');
  } catch (error) { report.error = error.message; process.exitCode = 1; }
  finally {
    try {
      http('/cdn/maintenance', { token, paused: true });
      const before = await ready(true); restart();
      report.finalHealth = await ready(true, before.processStartedAt);
      report.checks.push({ state: 'paused-drained', before: before.processStartedAt, after: report.finalHealth.processStartedAt });
      console.log('Final paused/drained state survived a confirmed new App Service process');
    } catch (error) { report.restoreError = error.message; process.exitCode = 1; }
    report.finished = new Date().toISOString(); report.success = !report.error && !report.restoreError;
    fs.writeFileSync(record, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ success: report.success, record }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
