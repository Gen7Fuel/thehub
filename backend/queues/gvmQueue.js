// queues/gvmQueue.js
const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { postPricesToGvm } = require("../utils/gvmScrapper");

const gvmQueue = new Queue("gvmQueue", { connection });

const gvmWorker = new Worker(
  "gvmQueue",
  async (job) => {
    const { gvmLocationName, prices } = job.data;
    console.log(`🤖 [GVM Worker] Starting price broadcast sync for location: ${gvmLocationName}`);

    await postPricesToGvm({
      gvmLocationName,
      prices
    });

    console.log(`🎉 [GVM Worker] Successfully processed pricing updates for ${gvmLocationName}.`);
  },
  {
    connection,
    concurrency: 1,
    // Safety thresholds for long-running browser sessions:
    stalledInterval: 45000, // Check for stalled jobs every 45 seconds (instead of default 15s)
    maxStalledCount: 1     // Limit automatic retries if an actual stall occurs
  }
);

gvmWorker.on("failed", (job, err) => {
  console.error(`❌ [GVM Worker] Synchronization Job ${job?.id} failed with exception:`, err);
});

module.exports = { gvmQueue, gvmWorker };
