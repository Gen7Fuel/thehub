const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { runArCustomerSync } = require("../cron_jobs/arCustomerSyncCron");

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await runArCustomerSync();
  } catch (err) {
    hadError = true;
    console.error("❌ Manual AR customer sync failed:", err);
  } finally {
    try { await mongoose.disconnect(); } catch { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error("❌ Manual AR customer sync failed:", err);
    process.exitCode = 1;
  });
}

module.exports = { run };
