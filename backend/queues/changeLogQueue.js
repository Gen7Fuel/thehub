const { Queue, Worker } = require('bullmq');
const connection = require('../utils/redisClient');
const ChangeLog = require('../models/ChangeLog');

const changeLogQueue = new Queue('changeLogQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
});

const changeLogWorker = new Worker(
  'changeLogQueue',
  async (job) => ChangeLog.findOneAndUpdate(
    { eventId: job.data.eventId },
    { $setOnInsert: job.data },
    { upsert: true, new: true },
  ),
  { connection, concurrency: 5 },
);

changeLogWorker.on('failed', (job, error) => {
  console.error(`Change log job ${job?.id || 'unknown'} failed:`, error.message);
});

async function enqueueChangeLog(payload) {
  await changeLogQueue.add('persist-change-log', payload, { jobId: payload.eventId });
}

module.exports = { changeLogQueue, changeLogWorker, enqueueChangeLog };
