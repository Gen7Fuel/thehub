const { Queue, Worker } = require('bullmq');
const connection = require('../utils/redisClient');
const AccessLog = require('../models/AccessLog');

const accessLogQueue = new Queue('accessLogQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
});

const accessLogWorker = new Worker(
  'accessLogQueue',
  async (job) => AccessLog.findOneAndUpdate(
    { eventId: job.data.eventId },
    { $setOnInsert: job.data },
    { upsert: true, new: true },
  ),
  { connection, concurrency: 5 },
);

accessLogWorker.on('failed', (job, error) => {
  console.error(`Access log job ${job?.id || 'unknown'} failed:`, error.message);
});

async function enqueueAccessLog(payload) {
  await accessLogQueue.add('persist-access-log', payload, { jobId: payload.eventId });
}

module.exports = { accessLogQueue, accessLogWorker, enqueueAccessLog };
