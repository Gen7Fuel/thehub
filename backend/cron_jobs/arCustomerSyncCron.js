const cron = require("node-cron");
const { DateTime } = require("luxon");
const { arCustomerSyncQueue } = require("../queues/arCustomerSyncQueue");

const TIMEZONE = "America/Toronto";

// Daily at 2:00 AM Eastern — queues a CStoreOffice download + AR customer sync.
// The per-day jobId stops a duplicate run if the cron fires twice.
cron.schedule(
  "0 2 * * *",
  async () => {
    const day = DateTime.now().setZone(TIMEZONE).toISODate();
    try {
      await arCustomerSyncQueue.add("daily-ar-customer-sync", {}, { jobId: `ar-customer-sync-${day}` });
      console.log(`📥 AR customer sync queued for ${day}`);
    } catch (err) {
      console.error("❌ Failed to queue AR customer sync:", err);
    }
  },
  { timezone: TIMEZONE },
);
