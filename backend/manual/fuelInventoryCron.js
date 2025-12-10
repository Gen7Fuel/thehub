// scripts/runFuelInventoryCron.js
require('dotenv').config();
const mongoose = require('mongoose');

const { 
  runFuelInventoryReportJobPreviousDay,
  runFuelInventoryReportJobCurrentDay
} = require('../cron_jobs/fuelInventoryReportCron');

async function run() {
  const arg = process.argv[2]; // 'current', 'previous', or 'both'

  if (!arg) {
    console.error("❌ Missing argument. Use: current | previous | both");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("✅ Connected to MongoDB");

    switch (arg.toLowerCase()) {
      case "current":
        console.log("▶ Running CURRENT DAY job...");
        await runFuelInventoryReportJobCurrentDay();
        break;

      case "previous":
        console.log("▶ Running PREVIOUS DAY job...");
        await runFuelInventoryReportJobPreviousDay();
        break;

      case "both":
        console.log("▶ Running BOTH jobs...");
        await runFuelInventoryReportJobCurrentDay();
        await runFuelInventoryReportJobPreviousDay();
        break;

      default:
        console.error("❌ Invalid argument. Use: current | previous | both");
        process.exit(1);
    }

    console.log("✔ All tasks done.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

run();