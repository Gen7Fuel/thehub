const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const { getPg } = require("../config/pg");
const {
  executeRetailPriceUpdate,
  GRADE_MAP,
} = require("../services/pricingCoreService");

const priceScheduleQueue = new Queue("priceScheduleQueue", { connection });

/**
 * Bootstraps the execution worker with a direct structural reference to the socket system.
 * @param {Object} io - The live initialized Socket.IO server engine instance
 */
function initPriceScheduleWorker(io) {
  const priceScheduleWorker = new Worker(
    "priceScheduleQueue",
    async (job) => {
      const {
        locationId,
        stationName,
        postedByUserIdStr,
        userEmail,
        isSocketEnabled,
        lockScheduledDateTime,
      } = job.data;
      const db = getPg();

      console.log(
        `⏱️ Scheduled execution fired for site: ${stationName} (${locationId})`,
      );

      // 1. Fetch all currently scheduled rows for this station
      const scheduledRows = await db("fuel_current_price").where({
        site: locationId,
        is_scheduled: true,
      });

      if (!scheduledRows || scheduledRows.length === 0) {
        console.log(
          `ℹ️ Aborted: Schedule was deleted or cleared by an administrative update for site ${locationId}.`,
        );
        return;
      }

      // 2. Validate Timestamp Lock: Compare database timestamp with job payload lock timestamp
      const dbTimeStr = new Date(
        scheduledRows[0].scheduled_date_time,
      ).toISOString();
      const lockTimeStr = new Date(lockScheduledDateTime).toISOString();

      if (dbTimeStr !== lockTimeStr) {
        console.log(
          `⚠️ Aborted: Version Mismatch. Schedule time drifted from ${lockTimeStr} to ${dbTimeStr}. Handing execution responsibility to the newer job layout.`,
        );
        return; // Exit cleanly without executing pricingCoreService!
      }

      // 3. Reconstruct the prices payload dynamically mapping DB grades back to frontend codes
      const pricesPayload = {};
      const REVERSE_GRADE_MAP = Object.fromEntries(
        Object.entries(GRADE_MAP).map(([feCode, dbGrade]) => [
          dbGrade.trim(),
          feCode,
        ]),
      );

      for (const row of scheduledRows) {
        const feCode = REVERSE_GRADE_MAP[String(row.grade).trim()];
        if (feCode && row.scheduled_price !== null) {
          pricesPayload[feCode] = parseFloat(row.scheduled_price);
        }
      }

      // 4. Execute the core update logic safely using our live instance context closure
      await executeRetailPriceUpdate({
        locationId,
        stationName,
        prices: pricesPayload,
        postedByUserIdStr,
        userEmail,
        appIo: isSocketEnabled ? io : null,
      });

      // 5. Reset the scheduling parameters back to clean state across all records for this site
      await db("fuel_current_price").where({ site: locationId }).update({
        is_scheduled: false,
        scheduled_date_time: null,
        scheduled_price: null,
      });

      console.log(
        `✅ Timed price adjustment successfully compiled and cleared for ${stationName}.`,
      );
    },
    { connection },
  );

  priceScheduleWorker.on("failed", (job, err) => {
    console.error(`❌ Scheduled queue job execution exception tracking:`, err);
  });

  return priceScheduleWorker;
}

module.exports = { priceScheduleQueue, initPriceScheduleWorker };
