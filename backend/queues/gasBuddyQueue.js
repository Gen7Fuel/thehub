// queues/gasBuddyQueue.js
const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { postPricesToGasBuddy } = require("../utils/gasBuddyScrapper");

const gasBuddyQueue = new Queue("gasBuddyQueue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 20,
      age: 1800, // Keep completed jobs for 30 minutes
    },
    removeOnFail: {
      count: 100, // Keep up to 100 failed jobs
      age: 259200, // Keep failed jobs for 3 days (72 hours)
    },
  },
});

const gasBuddyWorker = new Worker(
  "gasBuddyQueue",
  async (job) => {
    const { gasBuddyStationId, stationName, prices } = job.data;
    console.log(`🤖 [GasBuddy Worker] Starting price broadcast sync for site: ${stationName} (${gasBuddyStationId})`);

    await postPricesToGasBuddy({
      gasBuddyStationId,
      prices
    });

    console.log(`🎉 [GasBuddy Worker] Successfully processed ledger updates for ${stationName}.`);
  },
  { 
    connection,
    concurrency: 1,
    // Add these safety thresholds to handle long running browser sessions cleanly:
    stalledInterval: 45000, // Check for stalled jobs every 45 seconds (instead of default 15s)
    maxStalledCount: 1     // Limit the number of automatic retries if an actual stall occurs
  }
);

gasBuddyWorker.on("failed", (job, err) => {
  console.error(`❌ [GasBuddy Worker] Synchronization Job ${job?.id} failed with exception:`, err);
});

module.exports = { gasBuddyQueue, gasBuddyWorker };