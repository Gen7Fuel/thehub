const connectDB = require('../config/db');
const mongoose = require('mongoose');
// Update the import to the new function name
const { runSftIngestionCron } = require('../cron_jobs/fetchBullochShiftsCron');

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('--- 🛠️ Manual Bulloch Shift Sync Started ---');
    
    // We pass null as the first argument to sync ALL stations
    await runSftIngestionCron();

    console.log('--- ✅ Manual Sync Completed Successfully ---');
  } catch (err) {
    hadError = true;
    console.error('❌ Sync failed:', err);
  } finally {
    try { 
      await mongoose.disconnect(); 
      console.log('🔌 Disconnected from MongoDB');
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run };