const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { getPg } = require("../config/pg");
const { emailQueue } = require("./emailQueue");

const priceTimeoutQueue = new Queue("priceTimeoutQueue", { connection });

const priceTimeoutWorker = new Worker(
  "priceTimeoutQueue",
  async (job) => {
    const db = getPg();
    // Unpack your new custom store routing metrics
    const { locationId, stationName, toEmail, ccEmails } = job.data;

    console.log(`⏱️ Checking 15-min price confirmation status for site: ${stationName}`);

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

    console.warn(`🚨 Reminder Triggered: Sending price validation reminder to ${toEmail}`);

    // Adjusting copy to speak directly to the store team while maintaining urgency
    const emailHtmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
            ⚠️ Action Required: Complete Fuel Price Update
          </h2>
          <p style="color: #78350f; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
            New retail prices were published for your station 15 minutes ago. This is a friendly reminder to ensure your registers are updated and your confirmation snapshots are uploaded.
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${stationName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
              <td style="padding: 6px 0; font-size: 14px; color: #b45309; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Please log into the Gen7 Fuel Hub on your station account, and finalize the price adjustments on your registers, and upload the required receipt imagery to resolve this flag.
        </p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
            Automated operational tracking reminder — Gen 7 Fuel Hub System.
          </span>
        </div>
      </div>
    `;

    // Dispatch job over your network with dynamic direct and CC lines mapped cleanly
    await emailQueue.add(`price-reminder-${locationId}-${Date.now()}`, {
      to: toEmail,
      cc: ccEmails, 
      subject: `⛽ Urgent Reminder: Update & Verify Fuel Prices - ${stationName}`,
      html: emailHtmlBody
    });

    console.log(`🎉 Direct store reminder queued successfully with admin visibility chains.`);
  },
  { connection }
);

priceTimeoutWorker.on("failed", (job, err) => {
  console.error(`❌ Verification job ${job?.id} error track:`, err);
});

module.exports = { priceTimeoutQueue, priceTimeoutWorker };