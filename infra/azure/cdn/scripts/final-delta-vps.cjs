// Stream public code over stdin (not Windows argv); credentials stay on VPS.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const [mode = 'plan', digest, count] = process.argv.slice(2);
if (!['plan', 'execute'].includes(mode)) throw new Error('Use plan or execute DIGEST DELETE_COUNT');
if (mode === 'execute' && (!/^[a-f0-9]{64}$/.test(digest || '') || !/^\d+$/.test(count || ''))) throw new Error('Reviewed digest and deletion count required');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const bundle = Buffer.from(JSON.stringify({ storage: read('cdn/storage.js'), copy: read('cdn/scripts/copy-media.cjs'),
  delta: read('infra/azure/cdn/tools/final-delta.cjs'), runner: read('infra/azure/cdn/tools/final-delta-runner.cjs') })).toString('base64');
const args = [bundle, ...(mode === 'execute' ? ['--execute-production', '--approved-digest', digest, '--approved-delete-count', count] : [])];
const script = 'import sys\nsys.argv += ' + JSON.stringify(args) + '\n' + read('infra/azure/cdn/scripts/run-final-delta.py');
const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'gen7fuel@app.gen7fuel.com', 'python3 -'], {
  input: script, encoding: 'utf8', timeout: 10800000, maxBuffer: 1024 * 1024,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.status === 0 ? 0 : 1;
