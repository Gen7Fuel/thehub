// Only run inside the disposable Compose project created by rehearse-runtime.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
assert.equal(process.env.HUB_RUNTIME_TEST, 'isolated-fixture');
assert.equal(process.env.MONGO_URI, 'mongodb://mongo:27017/runtime_fixture');
require('../runtime/role').selectRole(process.env.HUB_PROCESS_ROLE || 'api');
const mongoose = require('mongoose');
const redis = require('../utils/redisClient');
const { emailQueue, emailWorker } = require('../queues/emailQueue');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function checkSchedulerLease() {
  const vm = require('node:vm');
  const filename = require.resolve('../runtime/scheduler');
  const actualRequire = require('node:module').createRequire(filename);
  function instance() {
    let callback;
    const module = { exports: {} };
    const wrapped = vm.runInNewContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})',
      { console, setTimeout, clearTimeout, setInterval, clearInterval });
    wrapped(name => name === './role' ? { runsSchedules: () => true } : name === 'node-cron'
      ? { schedule(expression, fn) { callback = fn; return { stop() {} }; } } : actualRequire(name), module, module.exports);
    return { runtime: module.exports, tick: date => callback({ date }) };
  }
  const a = instance(), b = instance(); let calls = 0;
  a.runtime.forModule('fixture').schedule('* * * * *', () => { calls++; });
  b.runtime.forModule('fixture').schedule('* * * * *', () => { calls++; });
  await a.runtime.startLease(redis, assert.fail);
  let bStarted = false;
  const bReady = b.runtime.startLease(redis, assert.fail).then(() => { bStarted = true; });
  try {
    await sleep(1100); assert.equal(bStarted, false);
    const tick = new Date('2026-11-18T15:00:00Z');
    await a.tick(tick); assert.equal(calls, 1);
    await a.runtime.closeScheduler(); await bReady;
    await b.tick(tick); assert.equal(calls, 1, 'Failover must not rerun the same scheduled tick');
    await b.tick(new Date('2026-11-18T15:01:00Z')); assert.equal(calls, 2);
  } finally { await a.runtime.closeScheduler(); await b.runtime.closeScheduler(); }
}
async function waitFor(callback) {
  for (let i = 0; i < 100; i++) { if (await callback()) return; await sleep(100); }
  throw new Error('Fixture condition timed out');
}
async function main() {
  const action = process.argv[2];
  if (action === 'publish') {
    require('../runtime/socketBridge').createPublisher(redis).to(process.argv[3]).emit('new-notification', { fixture: true });
    await require('../runtime/socketBridge').flush();
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../models/User');
  if (action === 'produce') {
    assert.ok(emailWorker === null, 'API must not construct a consumer');
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'runtime@example.invalid', firstName: 'Fixture', lastName: 'User' });
    await redis.set('fixture:user', id.toString());
    const token = require('jsonwebtoken').sign({ id: id.toString() }, process.env.JWT_SECRET, { expiresIn: '10m' });
    assert.equal((await fetch('http://backend:5000/api/purchase-orders')).status, 401);
    const response = await fetch('http://backend:5000/api/send-orderec-email', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'runtime@example.invalid', subject: 'fixture-success', text: 'synthetic' }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    await redis.set('fixture:success', result.jobId);
    fs.writeFileSync('/tmp/runtime-attachment.txt', 'fixture attachment');
    const attachmentJob = await emailQueue.add('fixture-attachment', { to: 'runtime@example.invalid', subject: 'fixture-attachment', attachments: [{ filename: 'fixture.txt', path: '/tmp/runtime-attachment.txt' }] });
    fs.unlinkSync('/tmp/runtime-attachment.txt');
    assert.equal(attachmentJob.data.attachments[0].path, undefined);
    assert.equal(Buffer.from(attachmentJob.data.attachments[0].content, 'base64').toString(), 'fixture attachment');
    await redis.set('fixture:attachment', attachmentJob.id);
    const failureJob = await emailQueue.add('fixture-failure', { to: 'runtime@example.invalid', subject: 'fixture-failure' });
    await redis.set('fixture:failure', failureJob.id);
    await sleep(800);
    assert.equal(await (await emailQueue.getJob(result.jobId)).getState(), 'waiting');
    assert.deepEqual(await (await fetch(process.env.EMAIL_SERVICE_URL + '/_fixture/requests')).json(), []);
    const { Queue } = require('bullmq');
    const priorPaused = new Queue('gvmQueue', { connection: redis });
    await priorPaused.pause();
    const cutoverEnv = { ...process.env, HUB_RUNTIME_CHECKPOINT: '/tmp/runtime-checkpoint/state.json' };
    execFileSync(process.execPath, ['scripts/runtime-cutover.cjs', 'prepare'], { env: cutoverEnv, stdio: 'inherit' });
    assert.equal(await emailQueue.isPaused(), true);
    execFileSync(process.execPath, ['scripts/runtime-cutover.cjs', 'resume'], { env: cutoverEnv, stdio: 'inherit' });
    assert.equal(await emailQueue.isPaused(), false);
    assert.equal(await priorPaused.isPaused(), true);
    assert.equal(await (await emailQueue.getJob(result.jobId)).getState(), 'waiting');
    await priorPaused.resume(); await priorPaused.close();
    await checkSchedulerLease();
    console.log('PASS: authenticated API queues work without consuming it; attachment survives producer file deletion');
    console.log('PASS: real Redis cutover pauses/drains 15 queues, preserves jobs, and restores a previously paused queue');
    console.log('PASS: real Redis scheduler lease admits one leader and deduplicates a tick across leader handoff');
  } else if (action === 'verify') {
    for (const [key, state] of [['success', 'completed'], ['attachment', 'completed'], ['failure', 'failed']]) {
      const job = await emailQueue.getJob(await redis.get('fixture:' + key));
      await waitFor(async () => await job.getState() === state);
    }
    const requests = await (await fetch(process.env.EMAIL_SERVICE_URL + '/_fixture/requests')).json();
    assert.equal(requests.filter(r => r.subject === 'fixture-success').length, 1);
    assert.equal(requests.find(r => r.subject === 'fixture-attachment').attachments[0].content, Buffer.from('fixture attachment').toString('base64'));
    const user = await redis.get('fixture:user');
    const token = require('jsonwebtoken').sign({ id: user }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const socket = new WebSocket('ws://backend:5000/socket.io/?EIO=4&transport=websocket');
    const messages = [];
    socket.addEventListener('message', event => {
      const value = String(event.data); messages.push(value);
      if (value.startsWith('0')) socket.send('40' + JSON.stringify({ token }));
      if (value === '2') socket.send('3');
    });
    try {
      await waitFor(() => messages.some(m => m.startsWith('40')));
      const child = spawn(process.execPath, [__filename, 'publish', user], { env: { ...process.env, HUB_PROCESS_ROLE: 'worker' }, stdio: 'inherit' });
      await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Publisher failed'))); });
      await waitFor(() => messages.some(m => m.startsWith('42') && JSON.parse(m.slice(2))[0] === 'new-notification'));
      assert.equal(JSON.parse(messages.find(m => m.startsWith('42')).slice(2))[1].fixture, true);
    } finally { socket.close(); }
    console.log('PASS: worker delivers queued email and attachment; HTTP 503 retains failed job; background notification reaches authenticated API socket');
  } else throw new Error('Unknown fixture action');
}
main().then(async () => { await emailQueue.close(); await mongoose.disconnect(); await redis.quit(); process.exit(0); }).catch(error => { console.error(error); process.exit(1); });
