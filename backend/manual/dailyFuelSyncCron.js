const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { runDailyFuelSync } = require('../cron_jobs/dailyFuelSyncCron');

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('Starting Fuel sync...');
    await runDailyFuelSync();
  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run };
