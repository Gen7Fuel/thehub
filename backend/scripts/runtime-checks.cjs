const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
function load(file, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '../runtime', file);
  const actual = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})',
    { console, process, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, ...globals }, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : actual(name), module, module.exports);
  return module.exports;
}
test('role validation and explicit entry point conflicts fail closed', () => {
  const env = {};
  const role = load('role.js', {}, { process: { env } });
  assert.equal(role.getRole(), 'all');
  role.selectRole('api');
  assert.equal(role.runsWorkers(), false);
  assert.equal(role.runsSchedules(), false);
  assert.throws(() => role.selectRole('worker'));
  env.HUB_PROCESS_ROLE = 'typo';
  assert.throws(() => role.getRole());
});
test('API and scheduler imports cannot construct BullMQ consumers', () => {
  for (const role of ['api', 'scheduler']) {
    const runtime = load('workers.js', { './role': { runsWorkers: () => false }, bullmq: { Worker: class { constructor() { assert.fail(role + ' constructed a worker'); } } } });
    assert.equal(runtime.createWorker('emailQueue', () => {}, {}), null);
  }
});
test('worker starts explicitly, imports are idempotent, shutdown awaits processing', async () => {
  let instances = 0, started = 0, closed = 0;
  class Worker extends EventEmitter {
    constructor(name, processor, options) { super(); instances++; assert.equal(options.autorun, false); }
    run() { started++; this.running = true; return new Promise(resolve => { this.done = resolve; }); }
    isRunning() { return this.running; }
    async waitUntilReady() {}
    async close() { closed++; this.running = false; this.done(); }
  }
  const runtime = load('workers.js', { './role': { runsWorkers: () => true }, bullmq: { Worker } });
  assert.equal(runtime.createWorker('emailQueue', () => {}, {}), runtime.createWorker('emailQueue', () => {}, {}));
  assert.equal(instances, 1); assert.equal(started, 0);
  await runtime.startWorkers(assert.fail);
  assert.equal(runtime.snapshot().running, true);
  await runtime.closeWorkers(); assert.equal(closed, 1); assert.equal(runtime.snapshot().running, false);
});
function schedulerFixture(enabled = true) {
  const callbacks = [], values = new Map(); let renew;
  const redis = {
    async set(key, value, ...args) { if (args.includes('NX') && values.has(key)) return null; values.set(key, value); return 'OK'; },
    async eval(script, n, key, value) { if (values.get(key) !== value) return 0; if (script.includes("'del'")) values.delete(key); return 1; },
  };
  const runtime = load('scheduler.js', {
    './role': { runsSchedules: () => enabled },
    'node-cron': { schedule(expression, callback) { callbacks.push(callback); return { stop() {} }; } },
  }, { setInterval(callback) { renew = callback; return 1; }, clearInterval() {} });
  return { runtime, redis, callbacks, values, renew: () => renew() };
}
test('API and worker do not register cron timers, including manual report imports', () => {
  const f = schedulerFixture(false);
  assert.equal(f.runtime.forModule('manual-report').schedule('* * * * *', assert.fail), null);
  assert.equal(f.callbacks.length, 0);
});
test('scheduler requires leadership, deduplicates one tick, and stops after lease loss', async () => {
  const f = schedulerFixture(); let calls = 0, lost = 0;
  const module = f.runtime.forModule('report');
  module.schedule('* * * * *', () => { calls++; });
  const tick = { date: new Date('2026-11-18T15:00:00Z') };
  await f.callbacks[0](tick); assert.equal(calls, 0);
  await f.runtime.startLease(f.redis, () => { lost++; });
  await f.callbacks[0](tick); await f.callbacks[0](tick); assert.equal(calls, 1);
  f.values.clear(); await f.renew(); assert.equal(lost, 1);
  await f.callbacks[0]({ date: new Date('2026-11-18T15:01:00Z') }); assert.equal(calls, 1);
  await f.runtime.closeScheduler();
});
test('scheduler shutdown drains an active callback before releasing its lease', async () => {
  const f = schedulerFixture(); let finish;
  await f.runtime.startLease(f.redis, assert.fail);
  f.runtime.forModule('report').schedule('* * * * *', () => new Promise(resolve => { finish = resolve; }));
  const run = f.callbacks[0]({ date: new Date() });
  await new Promise(resolve => setImmediate(resolve));
  let closed = false; const stop = f.runtime.closeScheduler().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false); assert.equal(f.values.has('gen7hub:runtime:scheduler:leader:v1'), true);
  finish(); await run; await stop;
  assert.equal(f.values.has('gen7hub:runtime:scheduler:leader:v1'), false);
});
test('socket bridge preserves private room routing and rejects unexpected events', async () => {
  const subscriber = new EventEmitter(); subscriber.subscribe = async () => {}; subscriber.quit = async () => {};
  const seen = []; const redis = { duplicate: () => subscriber, publish: async (channel, body) => subscriber.emit('message', channel, body) };
  const io = { to: rooms => ({ emit: (event, ...args) => seen.push({ rooms: [...rooms], event, args }) }), emit() { assert.fail('private event broadcast'); } };
  const bridge = load('socketBridge.js');
  const subscription = await bridge.subscribe(io, redis);
  bridge.createPublisher(redis).to('user-a').emit('new-notification', { fixture: true });
  await bridge.flush(); assert.equal(seen.length, 1); assert.equal(seen[0].rooms[0], 'user-a');
  subscriber.emit('message', bridge.CHANNEL, JSON.stringify({ version: 1, rooms: ['user-b'], event: 'unexpected', args: [] }));
  assert.equal(seen.length, 1);
  assert.throws(() => bridge.createPublisher(redis).emit('unexpected'));
  assert.throws(() => bridge.createPublisher(redis).emit('new-notification', 'x'.repeat(600000)));
  subscriber.emit('close'); assert.equal(subscription.isReady(), false); await subscription.close();
});
