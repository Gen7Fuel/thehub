const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { syncWriteOffToCStore } = require("../utils/cStoreWriteOffAutomation");

const writeOffAutomationQueue = new Queue("writeOffAutomationQueue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 20, age: 1800 },
    removeOnFail: { count: 100, age: 259200 },
    attempts: 1,
  },
});

let writeOffAutomationWorker = null;

const initWriteOffAutomationWorker = (io) => {
  if (writeOffAutomationWorker) return writeOffAutomationWorker;

  writeOffAutomationWorker = new Worker(
    "writeOffAutomationQueue",
    async (job) => {
      console.log(
        `🤖 [Write-Off Worker] Starting CStore automation for ${job.data.listNumber}`,
      );
      return syncWriteOffToCStore({ ...job.data, io });
    },
    {
      connection,
      concurrency: 1,
      stalledInterval: 60000,
      maxStalledCount: 1,
    },
  );

  writeOffAutomationWorker.on("completed", (job) => {
    console.log(`✅ [Write-Off Worker] Completed job ${job.id} for ${job.data.listNumber}`);
  });

  writeOffAutomationWorker.on("failed", (job, error) => {
    console.error(
      `❌ [Write-Off Worker] Failed job ${job?.id} for ${job?.data?.listNumber}:`,
      error,
    );
  });

  return writeOffAutomationWorker;
};

module.exports = { writeOffAutomationQueue, initWriteOffAutomationWorker };
