const { setTimeout: delay } = require('node:timers/promises');

async function verifyDeployment({ url, release, requirePaused = false, attempts = 24, intervalMs = 10000 }) {
  if (!url || !/^[a-f0-9]{40}$/.test(release || '')) throw new Error('Health URL and full release SHA are required');
  let failure = 'No successful readiness response';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!response.ok) throw new Error(`Health returned HTTP ${response.status}`);
      const health = await response.json();
      if (health.status !== 'ok' || health.storage !== 'azure' || health.release !== release) {
        throw new Error('Expected Azure storage and release are not ready');
      }
      if (requirePaused && (!health.paused || !health.drained)) throw new Error('Preview must remain paused and drained');
      return health;
    } catch (err) {
      failure = err.message;
      if (attempt < attempts) await delay(intervalMs);
    }
  }
  throw new Error(`CDN deployment verification failed: ${failure}`);
}

if (require.main === module) {
  verifyDeployment({ url: process.env.CDN_HEALTH_URL, release: process.env.CDN_EXPECT_RELEASE,
    requirePaused: process.env.CDN_EXPECT_PAUSED === 'true' })
    .then(() => console.log('Verified expected CDN release and Azure storage readiness.'))
    .catch(err => { console.error(err.message); process.exitCode = 1; });
}

module.exports = { verifyDeployment };
