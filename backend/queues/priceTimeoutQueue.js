const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { getPg } = require("../config/pg");
const { emailQueue } = require("./emailQueue");

const priceTimeoutQueue = new Queue("priceTimeoutQueue", { connection });

const priceTimeoutWorker = new Worker(
  "priceTimeoutQueue",
  async (job) => {
    const db = getPg();
    // Unpack the metadata along with the template components passed from the parent function
    const { locationId, stationName, toEmail, ccEmails, subject, html } = job.data;

    console.log(`⏱️ Watchdog Evaluation: Checking log records for site: ${stationName}`);

    const outstandingUnverifiedRows = await db("fuel_price_logs")
      .where({ site: locationId })
      .andWhere((builder) => {
        builder.whereNull("image_url").orWhereNull("infonet_image_url");
      })
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '1 hour'"));

    if (!outstandingUnverifiedRows || outstandingUnverifiedRows.length === 0) {
      console.log(`✅ Clean Match: ${stationName} uploaded all terminal reports in time.`);
      return;
    }

    console.warn(`🚨 Validation Failed: Logs are still unverified for ${stationName}. Passing payload to email execution pipeline.`);

    // Route the specific parameters received from the job descriptor block directly onto the emailQueue
    await emailQueue.add(`price-watchdog-dispatch-${locationId}-${Date.now()}`, {
      to: toEmail,
      cc: ccEmails,
      subject: subject,
      html: html
    });

    console.log(`🎉 Watchdog notification for "${subject}" pushed out down the line.`);
  },
  { connection }
);

priceTimeoutWorker.on("failed", (job, err) => {
  console.error(`❌ Verification job ${job?.id} error track:`, err);
});

module.exports = { priceTimeoutQueue, priceTimeoutWorker };