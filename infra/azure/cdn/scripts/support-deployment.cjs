// Deploy only reviewed support code with legacy settings. No setting mutations.
const { spawnSync } = require('node:child_process');
async function main() {
  const [action = 'inspect', repo = 'thehub', value] = process.argv.slice(2);
  if (!['inspect', 'dispatch', 'run'].includes(action) || !['thehub', 'desk'].includes(repo)) throw new Error('Invalid action/repository');
  const auth = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 45000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  });
  if (auth.status !== 0) throw new Error('GitHub authentication failed');
  const token = auth.stdout.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!token) throw new Error('GitHub credential unavailable');
  async function api(path, method = 'GET', body, optional = false) {
    const r = await fetch(`https://api.github.com/repos/Gen7Fuel/${repo}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (optional && r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${method} ${path}`);
    return r.status === 204 ? {} : r.json();
  }
  if (action === 'run') {
    if (!/^\d+$/.test(value || '')) throw new Error('Run ID required');
    const run = await api(`/actions/runs/${value}`);
    const jobs = await api(`/actions/runs/${value}/jobs`);
    console.log(JSON.stringify({ id: run.id, sha: run.head_sha, status: run.status, conclusion: run.conclusion,
      url: run.html_url, jobs: jobs.jobs.map(j => ({ name: j.name, status: j.status, conclusion: j.conclusion,
        failedSteps: j.steps?.filter(s => s.conclusion === 'failure').map(s => s.name) })) }, null, 2));
    return;
  }
  const head = (await api('/git/ref/heads/main')).object.sha;
  const secrets = (await api('/actions/secrets?per_page=100')).secrets.map(s => s.name);
  const vars = Object.fromEntries((await api('/actions/variables?per_page=100')).variables.map(v => [v.name, v.value]));
  const forbidden = repo === 'thehub' ? ['CDN_SERVICE_URL'] : ['ACCOUNT', 'CONTAINER', 'TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET'].map(n => `CDN_BACKUP_SOURCE_${n}`);
  if (forbidden.some(name => secrets.includes(name))) throw new Error('New CDN settings already exist; verify legacy configuration before deployment');
  if (vars.CDN_MIGRATION_FREEZE === 'true') throw new Error('Deployment is frozen');
  if (repo === 'thehub' && (vars.CDN_DEPLOY_TARGET !== 'vps' || vars.CDN_AZURE_PREVIEW_ENABLED === 'true' || vars.CDN_MEDIA_COPY_ENABLED === 'true')) throw new Error('Hub is not in the reviewed legacy deployment mode');
  const runs = (await api('/actions/workflows/main.yml/runs?per_page=12')).workflow_runs;
  if (action === 'dispatch') {
    if (!/^[a-f0-9]{40}$/.test(value || '') || value !== head) throw new Error('Reviewed SHA differs from main');
    if (runs.some(r => ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(r.status))) throw new Error('Another deployment is active');
    await api('/actions/workflows/main.yml/dispatches', 'POST', { ref: 'main', inputs: { service: 'backend' } });
  }
  console.log(JSON.stringify({ action, repo, head, newCdnSecretsAbsent: true, legacySettingsChecked: true,
    deployTarget: repo === 'thehub' ? vars.CDN_DEPLOY_TARGET : undefined,
    runs: runs.slice(0, 4).map(r => ({ id: r.id, sha: r.head_sha, status: r.status, conclusion: r.conclusion, url: r.html_url })) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
