// scripts/runCycleCountUpdate.js
require('dotenv').config();
const mongoose = require('mongoose');
const { updateCycleCountCSO } = require('../cron_jobs/cycleCountCron');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to MongoDB");

    await updateCycleCountCSO();

    console.log("Done updating onHandCSO for yesterday.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
