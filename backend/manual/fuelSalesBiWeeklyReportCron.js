require('dotenv').config();
const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { processBiWeeklyFuelReport } = require("../cron_jobs/fuelSalesBiWeeklyReportCron");

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await processBiWeeklyFuelReport("78205", "20260610", "20260615");
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