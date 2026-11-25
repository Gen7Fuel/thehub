// Run in a disposable backend container with a private checkpoint directory.
// Queue names and pause flags only: never persist Redis URLs or job payloads.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const names = require('../runtime/queueNames');
async function main() {
  const action = process.argv[2];
  assert.ok(['prepare', 'resume'].includes(action));
  const file = process.env.HUB_RUNTIME_CHECKPOINT || '/checkpoint/state.json';
  const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
  redis.on('error', error => console.error('[cutover] Redis unavailable', error.code || error.name));
  const queues = names.map(name => new Queue(name, { connection: redis }));
  function save(state) {
    const temporary = file + '.tmp';
    const checkpoint = fs.openSync(temporary, 'w', 0o600);
    try {
      fs.writeFileSync(checkpoint, JSON.stringify(state));
      fs.fsyncSync(checkpoint);
    } finally {
      fs.closeSync(checkpoint);
    }
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  }
  try {
    let state;
    if (action === 'prepare') {
      assert.ok(!fs.existsSync(file), 'Existing cutover checkpoint; inspect before retry');
      state = { version: 1, phase: 'preparing', queues: await Promise.all(queues.map(async q => ({ name: q.name, wasPaused: await q.isPaused() }))) };
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      save(state);
      await Promise.all(queues.map(q => q.pause()));
      state.phase = 'paused'; save(state);
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        const counts = await Promise.all(queues.map(q => q.getActiveCount()));
        if (counts.every(n => n === 0)) {
          state.phase = 'drained'; save(state);
          console.log(JSON.stringify({ phase: 'drained', queues: names.length, activeJobs: 0 }));
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Active jobs did not drain before deadline');
    }
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(state.version, 1);
    assert.deepEqual(state.queues.map(q => q.name), names);
    assert.ok(state.queues.every(q => typeof q.wasPaused === 'boolean'));
    for (let i = 0; i < queues.length; i++) if (!state.queues[i].wasPaused) await queues[i].resume();
    state.phase = 'resumed'; save(state);
    console.log(JSON.stringify({ phase: 'resumed', queues: names.length, priorPausedQueuesPreserved: true }));
  } finally {
    await Promise.all(queues.map(q => q.close()));
    await redis.quit();
  }
}
main().catch(error => { console.error(JSON.stringify({ success: false, errorType: error.name })); process.exitCode = 1; });
