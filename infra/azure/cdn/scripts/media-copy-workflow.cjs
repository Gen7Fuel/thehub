// Configure/dispatch the one-purpose migration workflow. Credentials stay in memory.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const [action = 'status', argument] = process.argv.slice(2);
  if (!['configure', 'dispatch', 'disable', 'status', 'download'].includes(action)) throw new Error('Invalid action');
  const auth = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8', timeout: 45000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  if (auth.status !== 0) throw new Error('GitHub authentication failed');
  const fields = Object.fromEntries(auth.stdout.trim().split('\n').map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
  if (!fields.password) throw new Error('GitHub credential missing');
  const headers = { Authorization: `Bearer ${fields.password}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'User-Agent': 'Gen7ERP-media-copy' };
  async function api(suffix, method = 'GET', body, optional = false) {
    const response = await fetch('https://api.github.com/repos/Gen7Fuel/thehub' + suffix, {
      method, headers, signal: AbortSignal.timeout(45000), ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 404 && optional) return null;
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}: ${method} ${suffix}`);
    return response.status === 204 ? {} : response.json();
  }
  const target = await api('/actions/variables/CDN_DEPLOY_TARGET');
  if (target.value !== 'vps') throw new Error('Production target must remain vps');
  async function variable(prefix, name, value) {
    const existing = await api(prefix + '/' + name, 'GET', undefined, true);
    await api(prefix + (existing ? '/' + name : ''), existing ? 'PATCH' : 'POST', { name, value });
  }
  if (action === 'configure') {
    const secrets = await api('/actions/secrets?per_page=100');
    if (!secrets.secrets.some(secret => secret.name === 'AZURE_STORAGE_CONNECTION_STRING')) throw new Error('Existing source secret is missing');
    const result = spawnSync('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe', ['-IBm', 'azure.cli',
      'identity', 'show', '--subscription', '29b24248-1990-4592-b25d-e6ee8e9db784', '--resource-group', 'Gen7ERP',
      '--name', 'gen7erp-media-copy', '--query', 'clientId', '--output', 'json'], { encoding: 'utf8', timeout: 45000 });
    if (result.status !== 0) throw new Error('Migration identity lookup failed');
    await variable('/environments/cdn-production/variables', 'AZURE_MEDIA_COPY_CLIENT_ID', JSON.parse(result.stdout));
    await variable('/actions/variables', 'CDN_MEDIA_COPY_ENABLED', 'false');
  }
  if (action === 'dispatch') {
    if (!/^[a-f0-9]{40}$/.test(argument || '')) throw new Error('Expected source commit required');
    const head = await api('/git/ref/heads/main');
    if (head.object.sha !== argument) throw new Error('Main differs from reviewed migration commit');
    const running = await api('/actions/workflows/cdn-media-copy.yml/runs?per_page=10');
    if (running.workflow_runs.some(run => run.status !== 'completed')) throw new Error('Migration workflow already active');
    // Windows fetch occasionally timed out while curl and the VPS both reached
    // this endpoint. Use the platform HTTP client for this read-only guard.
    const health = spawnSync('curl.exe', ['--fail', '--silent', '--show-error', '--max-time', '45',
      'https://gen7erp-cdn-prod-29b24248.azurewebsites.net/cdn/health'], { encoding: 'utf8', timeout: 50000 });
    if (health.status !== 0) throw new Error('Azure preview is not healthy');
    const state = JSON.parse(health.stdout);
    if (state.storage !== 'azure' || !state.paused || !state.drained) throw new Error('Azure preview must be paused and drained');
    await variable('/actions/variables', 'CDN_MEDIA_COPY_ENABLED', 'true');
    await api('/actions/workflows/cdn-media-copy.yml/dispatches', 'POST', { ref: 'main' });
  }
  if (action === 'disable') await variable('/actions/variables', 'CDN_MEDIA_COPY_ENABLED', 'false');
  if (action === 'download') {
    if (!/^\d+$/.test(argument || '')) throw new Error('Run ID required');
    const artifacts = await api(`/actions/runs/${argument}/artifacts`);
    const artifact = artifacts.artifacts.find(item => item.name === 'cdn-media-copy-' + argument);
    if (!artifact || artifact.expired) throw new Error('Evidence artifact unavailable');
    const response = await fetch(artifact.archive_download_url, { headers, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('Evidence download failed');
    const destination = path.join(require('node:os').tmpdir(), 'cdn-media-copy-' + argument + '.zip');
    fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
    console.log(JSON.stringify({ evidenceZip: destination, bytes: fs.statSync(destination).size }));
    return;
  }
  const runs = await api('/actions/workflows/cdn-media-copy.yml/runs?per_page=3', 'GET', undefined, true);
  const output = { action, target: target.value,
    enabled: (await api('/actions/variables/CDN_MEDIA_COPY_ENABLED', 'GET', undefined, true))?.value === 'true', runs: [] };
  for (const run of runs?.workflow_runs || []) {
    const jobs = await api(`/actions/runs/${run.id}/jobs`);
    const pending = await api(`/actions/runs/${run.id}/pending_deployments`, 'GET', undefined, true);
    output.runs.push({ id: run.id, sha: run.head_sha, status: run.status, conclusion: run.conclusion, url: run.html_url,
      createdAt: run.created_at, updatedAt: run.updated_at,
      pendingEnvironments: (pending || []).map(item => item.environment?.name),
      jobs: jobs.jobs.map(job => ({ name: job.name, status: job.status, conclusion: job.conclusion,
        steps: job.steps?.map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) })) });
  }
  console.log(JSON.stringify(output, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
