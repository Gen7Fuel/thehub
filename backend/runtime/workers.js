const { Worker } = require('bullmq');
const { runsWorkers } = require('./role');
const workers = new Map();
let stopping = false;

function createWorker(name, processor, options) {
  if (!runsWorkers()) return null;
  if (stopping) throw new Error('Worker runtime is stopping');
  if (workers.has(name)) return workers.get(name);
  const worker = new Worker(name, processor, { ...options, autorun: false });
  worker.on('error', error => console.error('[worker] Redis/runtime error', name, error.code || error.name));
  workers.set(name, worker);
  return worker;
}
async function startWorkers(onFailure) {
  for (const worker of workers.values()) {
    worker.run().catch(error => { if (!stopping) onFailure(error); });
  }
  await Promise.all([...workers.values()].map(worker => worker.waitUntilReady()));
}
async function closeWorkers() {
  stopping = true;
  await Promise.all([...workers.values()].map(worker => worker.close()));
}
function snapshot() {
  return { workers: [...workers.keys()].sort(), running: !stopping && [...workers.values()].every(worker => worker.isRunning()) };
}
module.exports = { createWorker, startWorkers, closeWorkers, snapshot };
