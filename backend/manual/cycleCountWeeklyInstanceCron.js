// scripts/runCycleCountUpdate.js
require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const setupSocket = require('../socket');
const { runWeeklyInstanceCalculations } = require('../cron_jobs/cycleCountWeeklyInstanceCron');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to MongoDB");

    // Initialize standalone Socket instance for manual execution pass
    const server = http.createServer();
    const io = setupSocket(server);

    await runWeeklyInstanceCalculations(io);

    console.log("Done generating weekly cycle count instances.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();