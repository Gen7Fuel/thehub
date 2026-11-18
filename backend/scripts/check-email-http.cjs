// Transport-only check against the local Postman stand-in. Queue behavior is
// covered separately by the real-Redis Docker rehearsal.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const filename = require.resolve('../queues/emailQueue');
const base = process.env.EMAIL_SERVICE_URL;
assert.ok(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local stand-in URL required');
const moduleFixture = { exports: {} };
const actualRequire = require('node:module').createRequire(filename);
const wrapped = vm.runInNewContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { console, process, Buffer, fetch });
wrapped(name => name === 'bullmq' ? { Queue: class {} } : name === '../runtime/workers'
  ? { createWorker: () => null } : name === '../utils/redisClient' ? {} : actualRequire(name), moduleFixture, moduleFixture.exports);
(async () => {
  await moduleFixture.exports.processEmailJob({ data: { to: 'fixture@example.invalid', subject: 'fixture-success' } });
  await assert.rejects(() => moduleFixture.exports.processEmailJob({ data: { to: 'fixture@example.invalid', subject: 'fixture-failure' } }), /fixture outage/);
  const requests = await (await fetch(base + '/_fixture/requests')).json();
  assert.ok(requests.some(r => r.subject === 'fixture-success'));
  assert.ok(requests.some(r => r.subject === 'fixture-failure'));
  console.log('PASS: unchanged email HTTP processor handles Postman success and 503 responses');
})().catch(error => { console.error(error); process.exitCode = 1; });
