const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { runtimeOptions } = require('../runtime');
const { createApp } = require('../app');
const { createStorage, azureContainer, CONTROL_FILE } = require('../storage');
const { fakeContainer } = require('./helpers');
const { startServer } = require('../index');
const { verifyDeployment } = require('../scripts/verify-deployment.cjs');

async function fixture(t, extra = {}, container = fakeContainer()) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdn-app-service-'));
  const env = { CDN_STORAGE: 'azure', CDN_UPLOADS_DIR: dir, CDN_ADMIN_TOKEN: 'test-token', ...extra };
  const storage = createStorage({ env, container });
  const listener = createApp({ env, storage }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(async () => {
    await new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); });
    await fs.rm(dir, { recursive: true, force: true });
  });
  return { dir, env, container, listener, base: `http://127.0.0.1:${listener.address().port}` };
}

test('App Service rejects unresolved secrets and ephemeral control storage', () => {
  const env = { WEBSITE_INSTANCE_ID: 'azure', CDN_STORAGE: 'azure', CDN_ADMIN_TOKEN: 'token', CDN_UPLOADS_DIR: '/home/cdn-control' };
  assert.equal(runtimeOptions(env).port, 5001);
  assert.equal(runtimeOptions({ ...env, PORT: '8080' }).port, 8080);
  for (const token of ['', '@Microsoft.KeyVault(SecretUri=https://vault/secrets/token/)', '  @microsoft.keyvault(SecretUri=x)']) {
    assert.throws(() => runtimeOptions({ ...env, CDN_ADMIN_TOKEN: token }), /resolved/);
  }
  assert.throws(() => runtimeOptions({ ...env, CDN_STORAGE: 'local' }), /CDN_STORAGE/);
  assert.throws(() => runtimeOptions({ ...env, CDN_UPLOADS_DIR: '/tmp/control' }), /persistent/);
  assert.throws(() => runtimeOptions({ ...env, CDN_UPLOADS_DIR: 'home/control' }), /persistent/);
  for (const port of ['no', '-1', '65536']) assert.throws(() => runtimeOptions({ PORT: port }), /PORT/);
});

test('native entrypoint honors PORT and serves the original VPS liveness route', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdn-port-'));
  const { server } = startServer({ PORT: '0', CDN_UPLOADS_DIR: dir });
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await fs.rm(dir, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/cdn`);
  assert.equal(response.status, 200);
});

test('managed identity account URL configuration is separate from legacy connection strings', () => {
  const root = 'https://gen7erpmedia29b24248.blob.core.windows.net';
  assert.equal(azureContainer({ AZURE_CONTAINER: 'hub', AZURE_STORAGE_ACCOUNT_URL: root }).url, root + '/hub');
  const connection = `DefaultEndpointsProtocol=https;AccountName=legacy;AccountKey=${Buffer.alloc(32).toString('base64')};EndpointSuffix=core.windows.net`;
  assert.equal(azureContainer({ AZURE_CONTAINER: 'hub', AZURE_STORAGE_CONNECTION_STRING: connection }).url, 'https://legacy.blob.core.windows.net/hub');
  assert.throws(() => azureContainer({ AZURE_CONTAINER: 'hub', AZURE_STORAGE_ACCOUNT_URL: root, AZURE_STORAGE_CONNECTION_STRING: connection }), /only one/);
  for (const url of ['http://example.com', root + '/hub', root + '?sig=secret', 'https://user:secret@example.com']) {
    assert.throws(() => azureContainer({ AZURE_CONTAINER: 'hub', AZURE_STORAGE_ACCOUNT_URL: url }), /HTTPS account root/);
  }
});

test('preview starts paused, persists the pause, and blocks writes until explicitly enabled', async t => {
  const { base, dir } = await fixture(t, { CDN_START_PAUSED: 'true' });
  const health = await fetch(base + '/cdn/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const initialHealth = await health.json();
  assert.equal(initialHealth.paused, true);
  assert.ok(Number.isFinite(Date.parse(initialHealth.processStartedAt)));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, CONTROL_FILE), 'utf8')), { paused: true, drained: true });
  const upload = () => fetch(base + '/cdn/upload-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"base64Data":"aGk=","fileName":"test.txt"}' });
  assert.equal((await upload()).status, 503);
  const response = await fetch(base + '/cdn/maintenance', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: '{"paused":false}' });
  assert.equal(response.status, 200);
  assert.equal((await upload()).status, 200);
});

test('VPS fallback requires explicit complete client-secret configuration and keeps App Service on managed identity', () => {
  const env = { AZURE_CONTAINER: 'hub', AZURE_STORAGE_ACCOUNT_URL: 'https://gen7erpmedia29b24248.blob.core.windows.net',
    CDN_AZURE_AUTH_MODE: 'client-secret', CDN_AZURE_TENANT_ID: '00000000-0000-0000-0000-000000000001',
    CDN_AZURE_CLIENT_ID: '00000000-0000-0000-0000-000000000002', CDN_AZURE_CLIENT_SECRET: 'test-secret' };
  assert.equal(azureContainer(env).url, env.AZURE_STORAGE_ACCOUNT_URL + '/hub');
  for (const key of ['CDN_AZURE_TENANT_ID', 'CDN_AZURE_CLIENT_ID', 'CDN_AZURE_CLIENT_SECRET']) {
    assert.throws(() => azureContainer({ ...env, [key]: '' }), /requires CDN-scoped/);
  }
  assert.throws(() => azureContainer({ ...env, WEBSITE_INSTANCE_ID: 'azure' }), /requires managed identity/);
  assert.throws(() => azureContainer({ ...env, CDN_AZURE_AUTH_MODE: 'managed-identity' }), /cannot be combined/);
  assert.throws(() => azureContainer({ ...env, CDN_AZURE_AUTH_MODE: 'typo' }), /Unsupported/);
});

test('unresolved Key Vault references cannot authorize admin endpoints or pass readiness', async t => {
  const token = '@Microsoft.KeyVault(SecretUri=https://vault/secrets/token/)';
  const { base } = await fixture(t, { CDN_ADMIN_TOKEN: token });
  assert.equal((await fetch(base + '/cdn/files', { headers: { Authorization: `Bearer ${token}` } })).status, 503);
  assert.equal((await fetch(base + '/cdn/health')).status, 503);
});

test('explicit unpause survives restarting with the initial-pause setting still enabled', async t => {
  const { base, dir, env, container, listener } = await fixture(t, { CDN_START_PAUSED: 'true' });
  assert.equal((await fetch(base + '/cdn/maintenance', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: '{"paused":false}' })).status, 200);
  await new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); });
  const replacement = createApp({ env, storage: createStorage({ env, container }) }).listen(0, '127.0.0.1');
  await once(replacement, 'listening');
  t.after(() => new Promise(resolve => { replacement.close(resolve); replacement.closeAllConnections(); }));
  const health = await fetch(`http://127.0.0.1:${replacement.address().port}/cdn/health`);
  assert.equal((await health.json()).paused, false);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, CONTROL_FILE), 'utf8')).paused, false);
});

test('storage authorization failures fail readiness without exposing details', async t => {
  const container = fakeContainer();
  container.getProperties = async () => { throw Object.assign(new Error('private credential detail'), { statusCode: 403 }); };
  const { base } = await fixture(t, {}, container);
  const response = await fetch(base + '/cdn/health');
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private credential detail/);
});

test('deployment verification rejects an old release and an active preview', async t => {
  const { createServer } = require('node:http');
  const release = 'a'.repeat(40);
  let health = { status: 'ok', storage: 'azure', release, paused: true, drained: true };
  const listener = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(health)); }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => { listener.close(resolve); listener.closeAllConnections(); }));
  const options = { url: `http://127.0.0.1:${listener.address().port}`, release, requirePaused: true, attempts: 1 };
  await verifyDeployment(options);
  health = { ...health, release: 'b'.repeat(40) };
  await assert.rejects(verifyDeployment(options), /release/);
  health = { ...health, release, paused: false };
  await assert.rejects(verifyDeployment(options), /paused/);
});
