const http = require('node:http');
async function start() {
  const { getRole } = require('./role');
  const role = getRole();
  if (!['worker', 'scheduler'].includes(role)) throw new Error('Invalid background entry point');
  const redis = require('../utils/redisClient');
  const workers = require('./workers');
  const scheduler = require('./scheduler');
  const bridge = require('./socketBridge');
  const { getPg, connectPG } = require('../config/pg');
  let ready = false, stopping = false;
  const server = http.createServer((req, res) => {
    if (req.url !== '/health') { res.writeHead(404); return res.end(); }
    const healthy = ready && !stopping && redis.status === 'ready' &&
      (role === 'worker' ? workers.snapshot().running : scheduler.isLeader());
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ role, ready: healthy, ...workers.snapshot(), ...scheduler.snapshot() }));
  });
  async function shutdown(code = 0) {
    if (stopping) return;
    stopping = true; ready = false;
    try {
      await Promise.all([workers.closeWorkers(), scheduler.closeScheduler()]);
      await bridge.flush();
      await require('mongoose').disconnect();
      await getPg().destroy();
      await redis.quit();
      server.close(() => process.exit(code));
    } catch (error) { console.error('[runtime] Shutdown failed', error.code || error.name); process.exit(1); }
  }
  process.once('SIGTERM', () => shutdown()); process.once('SIGINT', () => shutdown());
  const onFailure = error => { console.error('[runtime] Background failure', error.code || error.name); void shutdown(1); };
  await require('../config/db')();
  await connectPG();
  await require('./background').startBackground(bridge.createPublisher(redis), onFailure);
  ready = true;
  server.listen(Number(process.env.PORT || 5000), '0.0.0.0');
}
module.exports = { start };
