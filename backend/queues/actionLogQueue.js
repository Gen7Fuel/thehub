const { Queue, Worker } = require('bullmq');
const connection = require('../utils/redisClient');
const ActionLog = require('../models/ActionLog');

const actionLogQueue = new Queue('actionLogQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
});

const actionLogWorker = new Worker(
  'actionLogQueue',
  async (job) => ActionLog.findOneAndUpdate(
    { eventId: job.data.eventId },
    { $setOnInsert: job.data },
    { upsert: true, new: true },
  ),
  { connection, concurrency: 5 },
);

actionLogWorker.on('failed', (job, error) => {
  console.error(`Action log job ${job?.id || 'unknown'} failed:`, error.message);
});

async function enqueueActionLog(payload) {
  await actionLogQueue.add('persist-action-log', payload, {
    jobId: payload.eventId,
  });
}

module.exports = { actionLogQueue, actionLogWorker, enqueueActionLog };
