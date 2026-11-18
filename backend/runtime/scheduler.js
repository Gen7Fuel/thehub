const cron = require('node-cron');
const crypto = require('node:crypto');
const { runsSchedules } = require('./role');
const tasks = new Map();
const active = new Set();
const LEASE = 'gen7hub:runtime:scheduler:leader:v1';
const TTL = 30000;
const token = crypto.randomUUID();
let redis, owned = false, expiresAt = 0, timer, closing = false;

function isLeader() { return owned && !closing && Date.now() < expiresAt - 1000; }
async function startLease(connection, onLost) {
  redis = connection;
  while (!(await redis.set(LEASE, token, 'PX', TTL, 'NX'))) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  owned = true; expiresAt = Date.now() + TTL;
  let renewing = false;
  timer = setInterval(async () => {
    if (renewing || !owned) return;
    renewing = true;
    let timeout;
    try {
      const result = await Promise.race([
        redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end", 1, LEASE, token, TTL),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Scheduler renewal timed out')), 5000); }),
      ]);
      if (result !== 1) throw new Error('Scheduler leadership lost');
      expiresAt = Date.now() + TTL;
    } catch (error) { owned = false; onLost(error); }
    finally { clearTimeout(timeout); renewing = false; }
  }, 8000);
}
function forModule(name) {
  let index = 0;
  return { schedule(expression, callback, options = {}) {
    const id = name + ':' + index++;
    if (!runsSchedules()) return null;
    if (tasks.has(id)) return tasks.get(id);
    const task = cron.schedule(expression, async context => {
      if (!isLeader()) return;
      const date = new Date(context?.date || Date.now());
      const slot = 'gen7hub:runtime:scheduler:slot:' + id + ':' + date.toISOString();
      try {
        if (!(await redis.set(slot, token, 'EX', 7 * 24 * 60 * 60, 'NX')) || !isLeader()) return;
        const run = Promise.resolve().then(() => callback(context));
        active.add(run);
        try { await run; } finally { active.delete(run); }
      } catch (error) { console.error('[scheduler] Task failed', id, error.code || error.name); }
    }, options);
    tasks.set(id, task);
    return task;
  } };
}
async function closeScheduler() {
  closing = true;
  await Promise.all([...tasks.values()].map(task => Promise.resolve(task.stop())));
  await Promise.allSettled([...active]);
  clearInterval(timer);
  if (redis) await redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, LEASE, token);
  owned = false;
}
const snapshot = () => ({ leader: isLeader(), schedules: [...tasks.keys()].sort(), activeTasks: active.size });
module.exports = { forModule, startLease, closeScheduler, snapshot, isLeader };
