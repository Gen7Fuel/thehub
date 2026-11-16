// Operator-only setup. Credentials stay in memory and are never logged or
// passed in command arguments. Does not deploy code or change routing.
const { spawnSync } = require('node:child_process');

const azurePython = 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe';
const subscription = '29b24248-1990-4592-b25d-e6ee8e9db784';
const appScope = `/subscriptions/${subscription}/resourceGroups/Gen7ERP/providers/Microsoft.Web/sites/gen7erp-cdn-prod-29b24248`;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function run(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: 'utf8', timeout: 45000,
    maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  if (result.status !== 0) fail('LOCAL_AUTH_OR_COMMAND_FAILED');
  return result.stdout;
}
function az(args) { return JSON.parse(run(azurePython, ['-IBm', 'azure.cli', ...args, '--output', 'json'])); }
function azureToken(resource) {
  return az(['account', 'get-access-token', '--subscription', subscription, '--resource', resource]).accessToken;
}
async function request(url, token, method = 'GET', body, optional404 = false, github = false) {
  const response = await fetch(url, { method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(github ? { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Gen7ERP-CDN-setup' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (response.status === 404 && optional404) return null;
  if (!response.ok) fail(`${github ? 'GITHUB' : 'AZURE'}_HTTP_${response.status}`);
  if (response.status === 204) return {};
  const content = await response.text();
  return content ? JSON.parse(content) : {};
}

async function githubSetup() {
  const credential = run('git', ['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
  const fields = Object.fromEntries(credential.trim().split('\n').map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
  }));
  if (!fields.password) fail('GITHUB_CREDENTIAL_UNAVAILABLE');
  const base = 'https://api.github.com/repos/Gen7Fuel/thehub';
  const api = (suffix, method, body, optional404) => request(base + suffix, fields.password, method, body, optional404, true);
  const repo = await api('');
  if (!repo.permissions?.admin) fail('GITHUB_REPOSITORY_ADMIN_REQUIRED');
  const target = await api('/actions/variables/CDN_DEPLOY_TARGET', 'GET', undefined, true);
  if (target && target.value !== 'vps') fail('EXISTING_DEPLOY_TARGET_REQUIRES_REVIEW');
  const identity = az(['identity', 'show', '--subscription', subscription, '--resource-group', 'Gen7ERP', '--name', 'gen7erp-cdn-github-prod']);
  const envPath = '/environments/cdn-production';
  let environment = await api(envPath, 'GET', undefined, true);
  const created = !environment;
  if (created) {
    environment = await api(envPath, 'PUT', { deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } });
    await api(envPath + '/deployment-branch-policies', 'POST', { name: 'main', type: 'branch' });
  }
  const variablePath = envPath + '/variables/AZURE_CDN_CLIENT_ID';
  const existing = await api(variablePath, 'GET', undefined, true);
  if (existing && existing.value !== identity.clientId) fail('EXISTING_GITHUB_CLIENT_ID_REQUIRES_REVIEW');
  if (!existing) await api(envPath + '/variables', 'POST', { name: 'AZURE_CDN_CLIENT_ID', value: identity.clientId });
  if (!target) await api('/actions/variables', 'POST', { name: 'CDN_DEPLOY_TARGET', value: 'vps' });
  const verifyVariable = await api(variablePath);
  const verifyTarget = await api('/actions/variables/CDN_DEPLOY_TARGET');
  if (verifyVariable.value !== identity.clientId || verifyTarget.value !== 'vps') fail('GITHUB_CONFIGURATION_VERIFICATION_FAILED');
  if (created) {
    const policies = await api(envPath + '/deployment-branch-policies');
    if (!policies.branch_policies?.some(policy => policy.name === 'main' && policy.type === 'branch')) fail('GITHUB_BRANCH_POLICY_VERIFICATION_FAILED');
  }
  const preview = await api('/actions/variables/CDN_AZURE_PREVIEW_ENABLED', 'GET', undefined, true);
  console.log(JSON.stringify({ environment: 'cdn-production', created, clientIdConfigured: true,
    deployTarget: 'vps', previewEnabled: preview?.value === 'true', workflowsDispatched: false }));
}

async function vaultSetup() {
  const remote = 'docker exec cdn node -e \'process.stdout.write(process.env.CDN_ADMIN_TOKEN || "")\'';
  const adminToken = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'gen7fuel@app.gen7fuel.com', remote]);
  if (!adminToken.trim() || /^\s*@Microsoft\.KeyVault/i.test(adminToken)) fail('VPS_ADMIN_TOKEN_NOT_READY');
  const endpoint = 'https://gen7erp-cdn-29b24248.vault.azure.net/secrets/cdn-admin-token?api-version=7.4';
  const vaultToken = azureToken('https://vault.azure.net');
  const existing = await request(endpoint, vaultToken, 'GET', undefined, true);
  if (existing && existing.value !== adminToken) fail('EXISTING_VAULT_SECRET_REQUIRES_REVIEW');
  if (!existing) await request(endpoint, vaultToken, 'PUT', { value: adminToken, contentType: 'text/plain', attributes: { enabled: true } });
  const verified = await request(endpoint, vaultToken);
  if (verified.value !== adminToken || !verified.attributes?.enabled) fail('VAULT_SECRET_VERIFICATION_FAILED');
  console.log(JSON.stringify({ vault: 'gen7erp-cdn-29b24248', secret: 'cdn-admin-token',
    created: !existing, matchesVps: true, enabled: true }));

  const managementToken = azureToken('https://management.azure.com/');
  const app = await request(`https://management.azure.com${appScope}?api-version=2022-03-01`, managementToken, 'GET', undefined, true);
  if (!app) {
    console.log(JSON.stringify({ appProvisioned: false, keyVaultReferenceStatus: 'pending-app-creation' }));
    return;
  }
  const configBase = `https://management.azure.com${appScope}/config/configreferences/appsettings`;
  await request(configBase + '/refresh?api-version=2022-03-01', managementToken, 'POST');
  const references = await request(configBase + '?api-version=2022-03-01', managementToken);
  const status = references.value?.find(reference => reference.name === 'CDN_ADMIN_TOKEN')?.properties?.status ||
    references.properties?.CDN_ADMIN_TOKEN?.status;
  console.log(JSON.stringify({ keyVaultReferenceStatus: status || 'not-reported' }));
  if (status !== 'Resolved') fail('APP_SECRET_REFERENCE_NOT_RESOLVED');
}

const action = process.argv[2];
const task = action === 'github' ? githubSetup : action === 'vault' ? vaultSetup : null;
if (!task) {
  console.error('Usage: node configure-access.cjs github|vault'); process.exitCode = 1;
} else {
  task().catch(error => {
    // Never emit HTTP response bodies, subprocess output, or raw exceptions.
    console.error(error.code && /^[A-Z_0-9]+$/.test(error.code) ? error.code : 'SETUP_FAILED');
    process.exitCode = 1;
  });
}
