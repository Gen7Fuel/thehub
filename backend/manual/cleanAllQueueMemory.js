const { Queue } = require("bullmq");
const redisClient = require("../utils/redisClient"); // Path to your connection file

const queueNames = [
  "cdnUploadQueue",
  "csoInvoiceQueue",
  "emailQueue",
  "fuelNotificationQueue",
  "gasBuddyQueue",
  "gvmQueue",
  "invoiceProcessingQueue",
  "petrosoftQueue",
  "priceScheduleQueue",
  "priceTimeoutQueue",
];

async function cleanAllQueues() {
  console.log("🚀 Starting cleanup across all BullMQ queues...\n");

  for (const name of queueNames) {
    // Pass connection: redisClient directly
    const queue = new Queue(name, { connection: redisClient });

    try {
      // 1. Clean ALL completed jobs
      const cleanedCompleted = await queue.clean(0, 0, "completed");

      // 2. Clean failed jobs older than 24 hour (3,600,000 ms * 24)
      const cleanedFailed = await queue.clean(3600 * 1000 * 24, 0, "failed");

      console.log(
        `✅ Queue [${name.padEnd(24)}]: Cleaned ${cleanedCompleted.length} completed, ${cleanedFailed.length} failed jobs.`
      );
    } catch (err) {
      console.error(`❌ Error cleaning queue [${name}]:`, err.message);
    } finally {
      // Do NOT call queue.close() here because it closes your shared redisClient!
    }
  }

  // Gracefully close the shared Redis connection at the very end
  await redisClient.quit();
  console.log("\n✨ Queue cleanup completed successfully!");
  process.exit(0);
}

cleanAllQueues();