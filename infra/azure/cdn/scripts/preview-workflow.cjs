// Operator helper for the authorized paused preview. No credentials are logged.
const { spawnSync } = require('node:child_process');
async function main() {
  const [action = 'status', expectedSha] = process.argv.slice(2);
  if (!['status', 'enable', 'dispatch', 'disable'].includes(action)) throw new Error('Choose status, enable, dispatch, or disable');
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 45000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  });
  if (result.status !== 0) throw new Error('GitHub authentication failed');
  const credentials = Object.fromEntries(result.stdout.trim().split('\n').map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
  if (!credentials.password) throw new Error('GitHub credential unavailable');
  async function api(suffix, method = 'GET', body, optional404 = false) {
    const response = await fetch('https://api.github.com/repos/Gen7Fuel/thehub' + suffix, {
      method, signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${credentials.password}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'User-Agent': 'Gen7ERP-CDN-preview' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 404 && optional404) return null;
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}: ${method} ${suffix}`);
    return response.status === 204 ? {} : response.json();
  }
  const target = await api('/actions/variables/CDN_DEPLOY_TARGET');
  if (target.value !== 'vps') throw new Error('Preview requires deployment target vps');
  if (['enable', 'dispatch'].includes(action)) {
    if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw new Error('Expected full main SHA required');
    const head = await api('/git/ref/heads/main');
    if (head.object.sha !== expectedSha) throw new Error('Main differs from reviewed preview commit');
    await api('/actions/workflows/cdn-azure.yml');
  }
  if (['enable', 'disable'].includes(action)) {
    const existing = await api('/actions/variables/CDN_AZURE_PREVIEW_ENABLED', 'GET', undefined, true);
    const body = { name: 'CDN_AZURE_PREVIEW_ENABLED', value: action === 'enable' ? 'true' : 'false' };
    await api('/actions/variables' + (existing ? '/CDN_AZURE_PREVIEW_ENABLED' : ''), existing ? 'PATCH' : 'POST', body);
  }
  if (action === 'dispatch') {
    const enabled = await api('/actions/variables/CDN_AZURE_PREVIEW_ENABLED');
    if (enabled.value !== 'true') throw new Error('Preview flag is disabled');
    await api('/actions/workflows/cdn-azure.yml/dispatches', 'POST', { ref: 'main' });
  }
  const preview = await api('/actions/variables/CDN_AZURE_PREVIEW_ENABLED', 'GET', undefined, true);
  const runs = await api('/actions/runs?per_page=10');
  const output = { action, deployTarget: target.value, previewEnabled: preview?.value === 'true', runs: [] };
  for (const run of runs.workflow_runs.filter(run => run.name === 'Deploy CDN to Azure').slice(0, 1)) {
    if (run.name !== 'Deploy CDN to Azure') continue;
    const jobs = await api(`/actions/runs/${run.id}/jobs`);
    output.runs.push({ id: run.id, sha: run.head_sha, status: run.status, conclusion: run.conclusion,
      url: run.html_url, jobs: jobs.jobs.map(job => ({ name: job.name, status: job.status,
        conclusion: job.conclusion, steps: job.steps?.filter(step => step.status !== 'completed' || step.conclusion !== 'success').map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) })) });
  }
  console.log(JSON.stringify(output, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
