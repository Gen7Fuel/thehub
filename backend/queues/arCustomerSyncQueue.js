const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const ArCustomer = require("../models/ArCustomer");
const { emailQueue } = require("./emailQueue");
const { downloadCsoCustomerExport } = require("../utils/csoArCustomerScrapper");
const { parseCsoCustomers, syncArCustomers } = require("../utils/arCustomerSync");

const MAX_ATTEMPTS = 3;
// The sync prunes every customer missing from the file, so a truncated or
// empty export would wipe real customers. Refuse to prune when the file holds
// fewer than this fraction of the current customer count.
const MIN_RETAINED_RATIO = 0.5;

const arCustomerSyncQueue = new Queue("arCustomerSyncQueue", {
  connection,
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 5 * 60 * 1000 },
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

const arCustomerSyncWorker = new Worker(
  "arCustomerSyncQueue",
  async () => {
    console.log("🤖 [AR Customer Sync Worker] Downloading CStoreOffice customer export...");
    const html = await downloadCsoCustomerExport();

    const customers = parseCsoCustomers(html);
    if (customers.length === 0) {
      throw new Error("CStoreOffice export contained no valid customer rows");
    }

    const existingCount = await ArCustomer.countDocuments();
    if (existingCount > 0 && customers.length < existingCount * MIN_RETAINED_RATIO) {
      throw new Error(
        `CStoreOffice export has ${customers.length} customers vs ${existingCount} in Hub; refusing to prune`,
      );
    }

    const result = await syncArCustomers(customers);
    console.log(
      `🎉 [AR Customer Sync Worker] ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`,
    );
    return result;
  },
  {
    connection,
    concurrency: 1,
    stalledInterval: 60000,
    maxStalledCount: 1,
  },
);

arCustomerSyncWorker.on("failed", async (job, err) => {
  console.error(`❌ [AR Customer Sync Worker] Job ${job?.id} failed:`, err.message);

  // Alert only once retries are exhausted.
  if (!job || job.attemptsMade < MAX_ATTEMPTS) return;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px;">
      <h2 style="color: #991b1b; font-size: 16px;">⚠️ AR Customer Sync Failed</h2>
      <p style="font-size: 14px;">The daily CStoreOffice AR customer sync failed ${MAX_ATTEMPTS} times.</p>
      <p style="font-family: monospace; font-size: 13px; color: #ef4444; white-space: pre-wrap;">${err.message}</p>
      ${err.screenshotUrl ? `<p><a href="${err.screenshotUrl}">View diagnostic screenshot</a></p>` : ""}
    </div>`;

  await emailQueue.add(`ar-customer-sync-error-${Date.now()}`, {
    to: "daksh@gen7fuel.com",
    subject: "🚨 Hub Automation Failure: AR Customer Sync",
    html,
  });
});

module.exports = { arCustomerSyncQueue, arCustomerSyncWorker };
