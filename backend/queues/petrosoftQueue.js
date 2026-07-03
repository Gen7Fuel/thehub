const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { uploadInventoryToPetrosoft } = require("../utils/cStoreCountScrapper");

const petrosoftQueue = new Queue("petrosoftQueue", { connection });

const petrosoftWorker = new Worker(
  "petrosoftQueue",
  async (job) => {
    const { targetStationCsoCode, csvBase64 } = job.data;
    console.log(`🤖 [Petrosoft Worker] Starting automated scraper thread for Station CSO: ${targetStationCsoCode}`);

    // 💡 Decode the base64 string back into a NodeJS Binary Buffer for Playwright
    const csvFileBuffer = Buffer.from(csvBase64, "base64");

    const uploadResult = await uploadInventoryToPetrosoft({
      targetStationCsoCode,
      csvFileBuffer
    });

    console.log(`🎉 [Petrosoft Worker] Inventory successfully updated for Station CSO: ${targetStationCsoCode}.`);
    return uploadResult;
  },
  {
    connection,
    concurrency: 1, // Running browser sessions serially avoids resource overloading your system
    stalledInterval: 60000, // Look for stalled processes every 60s since browsers can run long
    maxStalledCount: 1
  }
);

petrosoftWorker.on("failed", (job, err) => {
  console.error(`❌ [Petrosoft Worker] Background Execution Job ${job?.id} failed with exception:`, err);
});

module.exports = { petrosoftQueue, petrosoftWorker };