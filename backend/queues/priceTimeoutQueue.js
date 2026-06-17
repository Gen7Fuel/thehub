const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { getPg } = require("../config/pg");
const { emailQueue } = require("./emailQueue");

const priceTimeoutQueue = new Queue("priceTimeoutQueue", { connection });

const priceTimeoutWorker = new Worker(
  "priceTimeoutQueue",
  async (job) => {
    const db = getPg();
    // Unpack hasInfonet along with the template components passed from the route payload
    const { locationId, stationName, toEmail, ccEmails, subject, html, hasInfonet } = job.data;

    // Default system behavior assumes a site has an InfoNet terminal unless explicitly set to false
    const infoNetTerminalRequired = hasInfonet !== false;

    console.log(`⏱️ Watchdog Evaluation: Checking log records for site: ${stationName} (Requires InfoNet: ${infoNetTerminalRequired})`);

    const outstandingUnverifiedRows = await db("fuel_price_logs")
      .where({ site: locationId })
      .andWhere((builder) => {
        if (infoNetTerminalRequired) {
          // Strict configuration check: True if either the Bulloch OR the InfoNet snapshot is missing
          builder.whereNull("image_url").orWhereNull("infonet_image_url");
        } else {
          // Dynamic layout configuration check: Only flag if the Bulloch image is missing
          builder.whereNull("image_url");
        }
      })
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '1 hour'"));

    if (!outstandingUnverifiedRows || outstandingUnverifiedRows.length === 0) {
      console.log(`✅ Clean Match: ${stationName} uploaded all required terminal reports in time.`);
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