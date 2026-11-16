// One controlled B1 retry or explicitly selected empty Free F1 probe. Captures only
// non-secret ARM request settings, error details, and request identifiers.
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const mode = process.argv[2] || 'b1';
  if (!['b1', 'f1', 'f1-east'].includes(mode)) throw new Error('Choose b1, f1, or f1-east');
  const freeProbe = mode !== 'b1';
  const eastProbe = mode === 'f1-east';
  const region = eastProbe ? 'canadaeast' : 'canadacentral';
  const recordName = eastProbe ? 'f1-east-probe-2026-11-16.json' :
    freeProbe ? 'f1-probe-2026-11-16.json' : 'plan-retry-2026-11-16.json';
  const destination = path.resolve(__dirname, '../diagnostics/', recordName);
  if (fs.existsSync(destination)) throw new Error('Diagnostic already recorded; refusing another creation attempt or evidence overwrite');
  const subscription = '29b24248-1990-4592-b25d-e6ee8e9db784';
  const planName = eastProbe ? 'gen7erp-cdn-f1-east-probe' : freeProbe ? 'gen7erp-cdn-f1-probe' : 'gen7erp-cdn-prod';
  const scope = `/subscriptions/${subscription}/resourceGroups/Gen7ERP/providers/Microsoft.Web/serverfarms/${planName}`;
  const base = 'https://management.azure.com';
  const apiVersion = '2025-03-01';
  const authentication = spawnSync('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe',
    ['-IBm', 'azure.cli', 'account', 'get-access-token', '--subscription', subscription,
      '--resource', 'https://management.azure.com/', '--output', 'json'],
    { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 });
  if (authentication.status !== 0) throw new Error('Azure CLI authentication failed');
  const token = JSON.parse(authentication.stdout).accessToken;
  const clientRequestId = randomUUID();
  async function call(endpoint, method = 'GET', body) {
    const response = await fetch(base + endpoint, {
      method, signal: AbortSignal.timeout(120000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'x-ms-client-request-id': clientRequestId, 'x-ms-return-client-request-id': 'true' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: Object.fromEntries(
      ['date', 'x-ms-request-id', 'x-ms-correlation-request-id', 'x-ms-routing-request-id',
        'azure-asyncoperation', 'location'].map(name => [name, response.headers.get(name)])),
      body: text ? JSON.parse(text) : null };
  }
  const quotaEndpoint = `/subscriptions/${subscription}/providers/Microsoft.Web/locations/${region}/usages?api-version=${apiVersion}`;
  async function quota() {
    const result = await call(quotaEndpoint);
    if (result.status !== 200) throw new Error('Quota lookup failed');
    return result.body.value.filter(row => (freeProbe ? ['F1', 'B1', '*'] : ['B1', '*']).includes(row.name.value))
      .map(row => ({ name: row.name.localizedValue, used: row.currentValue, limit: row.limit }));
  }
  const before = await quota();
  const existing = await call(`${scope}?api-version=${apiVersion}`);
  if (existing.status !== 404) throw new Error('Plan is not confirmed absent; refusing to overwrite it');
  const request = {
    location: region, kind: 'linux',
    sku: freeProbe ? { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 } :
      { name: 'B1', tier: 'Basic', size: 'B1', family: 'B', capacity: 1 },
    properties: { reserved: true, zoneRedundant: false, perSiteScaling: false },
    tags: freeProbe ? { application: 'Gen7ERP', component: 'cdn-f1-probe', environment: 'diagnostic', managed_by: 'Terraform' } :
      { application: 'Gen7ERP', component: 'cdn', environment: 'production', managed_by: 'Terraform' },
  };
  const started = new Date().toISOString();
  const result = await call(`${scope}?api-version=${apiVersion}`, 'PUT', request);
  const after = await quota();
  const record = {
    started, finished: new Date().toISOString(), subscription, scope, clientRequestId,
    apiVersion, request, quotaBefore: before, quotaAfter: after,
    response: { status: result.status, headers: result.headers,
      ...(result.status >= 400 ? { error: result.body } : {
        resource: { id: result.body?.id, kind: result.body?.kind, location: result.body?.location,
          sku: result.body?.sku, provisioningState: result.body?.properties?.provisioningState },
      }),
    },
    nextAction: result.status < 300 ? (freeProbe ? 'Verify the empty Free plan and record it in its own Terraform state; do not create an app' :
      'Import plan into Terraform and verify before applying remaining resources') :
      'Investigate denial using captured IDs; no further creation or quota change attempted',
  };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, quotaBefore: before, quotaAfter: after,
    requestId: result.headers['x-ms-request-id'], correlationId: result.headers['x-ms-correlation-request-id'],
    evidence: 'infra/azure/cdn/diagnostics/' + recordName, nextAction: record.nextAction }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
