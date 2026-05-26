// scripts/runCycleCountUpdate.js
require('dotenv').config();
const mongoose = require('mongoose');
const { runWeeklyInstanceCalculations } = require('../cron_jobs/cycleCountWeeklyInstanceCron'); // Importing the same function from the report cron for manual execution

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to MongoDB");

    await runWeeklyInstanceCalculations();

    console.log("Done generating weekly cycle count instances.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
