const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { processInvoiceAutomation } = require("../utils/csoInvoiceUpload");

// Initialize a clean, distinct queue for invoice automation
const csoInvoiceQueue = new Queue("csoInvoiceQueue", { connection });

const csoInvoiceWorker = new Worker(
  "csoInvoiceQueue",
  async (job) => {
    const { invoiceId } = job.data;
    console.log(`🤖 [Invoice Worker] Initializing automation runtime thread for Invoice ID: ${invoiceId}`);

    // Direct invocation of your core Playwright runner logic
    const result = await processInvoiceAutomation({ invoiceId });
    
    console.log(`🎉 [Invoice Worker] Automation successfully resolved sequence for Invoice ID: ${invoiceId}`);
    return result;
  },
  {
    connection,
    concurrency: 1, // Crucial: running browser threads one-by-one protects system CPU/RAM metrics
    stalledInterval: 60000, 
    maxStalledCount: 1
  }
);

csoInvoiceWorker.on("failed", (job, err) => {
  console.error(`❌ [Invoice Worker] Background Execution Job ${job?.id} failed with error statement:`, err.message);
});

module.exports = { csoInvoiceQueue, csoInvoiceWorker };