// Read-only validation of copied historical media through the actual Azure API.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const python = 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe';
const runId = process.argv[2];
const base = 'https://gen7erp-cdn-prod-29b24248.azurewebsites.net';
async function main() {
  assert.match(runId || '', /^\d+$/);
  const record = path.resolve(__dirname, '../diagnostics/copied-api-' + runId + '.json');
  assert.ok(!fs.existsSync(record), 'API verification already recorded');
  const extracted = spawnSync(python, ['-c',
    'import zipfile,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n print(json.dumps({n:json.loads(z.read(n)) for n in ["summary.json","source-inventory.json"]}))',
    path.join(os.tmpdir(), 'cdn-media-copy-' + runId + '.zip')], { encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(extracted.status, 0);
  const { 'summary.json': summary, 'source-inventory.json': inventory } = JSON.parse(extracted.stdout);
  assert.equal(summary.phase, 'online-baseline-verified');
  const credentials = spawnSync(python, ['-IBm', 'azure.cli', 'keyvault', 'secret', 'show', '--vault-name',
    'gen7erp-cdn-29b24248', '--name', 'cdn-admin-token', '--query', 'value', '--output', 'json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(credentials.status, 0);
  const token = JSON.parse(credentials.stdout);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cdn-copy-api-'));
  const bodyPath = path.join(temp, 'response.bin'); const headersPath = path.join(temp, 'headers.txt');
  function http(endpoint, admin = false, range) {
    assert.ok(endpoint.startsWith('/cdn/'));
    let config = `silent\nshow-error\nfail\nmax-time = 60\nurl = ${JSON.stringify(base + endpoint)}\noutput = ${JSON.stringify(bodyPath)}\ndump-header = ${JSON.stringify(headersPath)}\n`;
    if (admin) config += `header = ${JSON.stringify('Authorization: Bearer ' + token)}\n`;
    if (range) config += `header = ${JSON.stringify('Range: ' + range)}\n`;
    const response = spawnSync('curl.exe', ['--config', '-'], { input: config, encoding: 'utf8', timeout: 65000 });
    assert.equal(response.status, 0, 'Preview HTTP request failed');
    const headerText = fs.readFileSync(headersPath, 'utf8');
    const status = Number([...headerText.matchAll(/HTTP\/\S+\s+(\d+)/g)].at(-1)[1]);
    const headers = Object.fromEntries(headerText.split(/\r?\n/).filter(line => line.includes(':')).map(line => {
      const at = line.indexOf(':'); return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()];
    }));
    return { status, headers, body: fs.readFileSync(bodyPath) };
  }
  const report = { runId, started: new Date().toISOString(), samples: [] };
  try {
    const health = JSON.parse(http('/cdn/health').body);
    assert.equal(health.status, 'ok'); assert.equal(health.storage, 'azure');
    assert.equal(health.paused, true); assert.equal(health.drained, true);
    const expected = new Map(inventory.map(file => [file.name.slice(4), file])); const seen = new Set();
    const months = {}; let bytes = 0;
    for (let page = 1; page <= Math.ceil(summary.files / 100); page++) {
      const result = JSON.parse(http('/cdn/files?page=' + page, true).body);
      assert.equal(result.totalFiles, summary.files); assert.equal(result.currentPage, page);
      assert.equal(result.totalPages, Math.ceil(summary.files / 100));
      for (const file of result.files) {
        const original = expected.get(file.filename); assert.ok(original); assert.ok(!seen.has(file.filename));
        assert.equal(file.size, original.size); assert.equal(Date.parse(file.lastModified), Date.parse(original.originalmtime));
        seen.add(file.filename); bytes += file.size;
        const month = file.lastModified.slice(0, 7); months[month] = (months[month] || 0) + 1;
      }
    }
    assert.equal(seen.size, summary.files); assert.equal(bytes, summary.sourceBytes);
    report.listing = { files: seen.size, bytes, months, allNamesSizesDatesMatch: true };
    console.log('All API pages, filenames, sizes and original dates match the verified source snapshot');
    const selected = [
      inventory.find(file => file.name.endsWith('.pdf') && file.originalmtime.startsWith('2026-09')),
      inventory.find(file => /\.(png|jpg|jpeg)$/i.test(file.name)),
      inventory.find(file => file.originalmtime.startsWith('2026-11')),
    ].filter((file, index, all) => file && all.indexOf(file) === index);
    assert.ok(selected.length >= 2);
    for (const file of selected) {
      const response = http('/cdn/download/' + file.name.slice(4));
      assert.equal(response.status, 200); assert.equal(response.body.length, file.size);
      const checksum = crypto.createHash('sha256').update(response.body).digest('hex'); assert.equal(checksum, file.sha256);
      assert.equal(response.headers['content-type'].split(';')[0], file.contentType.split(';')[0]);
      assert.equal(Date.parse(response.headers['last-modified']), Math.floor(Date.parse(file.originalmtime) / 1000) * 1000);
      const end = Math.min(file.size - 1, 4095);
      if (end > 0) {
        const partial = http('/cdn/download/' + file.name.slice(4), false, `bytes=0-${end}`);
        assert.equal(partial.status, 206); assert.deepEqual(partial.body, response.body.subarray(0, end + 1));
      }
      report.samples.push({ name: file.name, bytes: file.size, sha256: checksum, originalmtime: file.originalmtime,
        contentType: response.headers['content-type'], rangeVerified: end > 0 });
    }
    report.finalHealth = JSON.parse(http('/cdn/health').body);
    assert.equal(report.finalHealth.paused, true); assert.equal(report.finalHealth.drained, true);
    report.success = true; report.finished = new Date().toISOString();
    fs.writeFileSync(record, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    for (const file of [bodyPath, headersPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(temp);
  }
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
