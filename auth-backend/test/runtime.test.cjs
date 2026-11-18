const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, getPort } = require('../app');
test('health reflects database readiness and shutdown; URL and body stay compatible', async () => {
  const connection = { readyState: 0 }, state = { stopping: false };
  const routes = require('express').Router();
  routes.get('/fixture', (req, res) => res.json({ ok: true }));
  const app = createApp({ connection, state, routes, authAccessLogger: () => (req, res, next) => next() });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/login-auth/health')).status, 503);
    connection.readyState = 1;
    const healthy = await fetch(base + '/login-auth/health');
    assert.equal(healthy.status, 200); assert.equal(await healthy.text(), 'OK');
    assert.ok(healthy.headers.get('x-request-id'));
    assert.equal((await fetch(base + '/login-auth/fixture')).status, 200);
    state.stopping = true;
    assert.equal((await fetch(base + '/login-auth/health')).status, 503);
    state.stopping = false; connection.readyState = 0;
    assert.equal((await fetch(base + '/login-auth/health')).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('hosted PORT is validated and VPS default remains 5005', () => {
  assert.equal(getPort({}), 5005); assert.equal(getPort({ PORT: '8080' }), 8080);
  for (const PORT of ['abc', '-1', '0', '65536', '80.5']) assert.throws(() => getPort({ PORT }));
});
test('portable package includes exact shared models and excludes local secrets', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-package-test-'));
  const { packageRuntime, models } = require('../scripts/package-runtime.cjs');
  try {
    const destination = packageRuntime(path.join(temporary, 'runtime'));
    assert.deepEqual(fs.readdirSync(path.join(destination, 'models')).sort(), models.map(m => m + '.js').sort());
    assert.ok(fs.existsSync(path.join(destination, 'utils/attachSiteAlias.js')));
    assert.equal(fs.existsSync(path.join(destination, '.env')), false);
    assert.equal(fs.existsSync(path.join(destination, 'node_modules')), false);
    assert.throws(() => packageRuntime(destination));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
