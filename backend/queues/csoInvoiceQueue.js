const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { processInvoiceAutomation } = require("../utils/csoInvoiceUpload");

// Initialize a clean, distinct queue for invoice automation
const csoInvoiceQueue = new Queue("csoInvoiceQueue", { connection });

let csoInvoiceWorker = null;

/**
 * Initializes the BullMQ worker and injects the global Socket.io instance
 * @param {import("socket.io").Server} io
 */
const initCsoInvoiceWorker = (io) => {
  if (csoInvoiceWorker) return csoInvoiceWorker;

  csoInvoiceWorker = new Worker(
    "csoInvoiceQueue",
    async (job) => {
      const { invoiceId } = job.data;
      console.log(
        `🤖 [Invoice Worker] Initializing automation runtime thread for Invoice ID: ${invoiceId}`,
      );

      // Pass `io` straight into your automation function
      const result = await processInvoiceAutomation({ invoiceId, io });

      console.log(
        `🎉 [Invoice Worker] Automation successfully resolved sequence for Invoice ID: ${invoiceId}`,
      );
      return result;
    },
    {
      connection,
      concurrency: 1, // Crucial: running browser threads one-by-one protects system CPU/RAM metrics
      stalledInterval: 60000,
      maxStalledCount: 1,
    },
  );

  csoInvoiceWorker.on("failed", (job, err) => {
    console.error(
      `❌ [Invoice Worker] Background Execution Job ${job?.id} failed with error statement:`,
      err.message,
    );
  });

  return csoInvoiceWorker;
};

module.exports = { csoInvoiceQueue, initCsoInvoiceWorker };
