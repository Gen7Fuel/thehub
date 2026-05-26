const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { runSanitizeItemBk } = require("../cron_jobs/itemBkSanitizationCron");

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await runSanitizeItemBk();
  } catch (err) {
    hadError = true;
    console.error("Sync failed:", err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Mongo disconnected.");
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();