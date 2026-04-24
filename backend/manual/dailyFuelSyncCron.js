const connectDB = require('../config/db');
const mongoose = require('mongoose');
// Update the import to the new function name
const { runSmartSync } = require('../cron_jobs/dailyFuelSyncCron');

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('--- 🛠️ Manual Smart Fuel Sync Started ---');

    // Usage: node scripts/your-script.js [attemptNumber]
    // Default to Attempt 3 for manual runs so it forces a data save
    const attempt = process.argv[2] ? parseInt(process.argv[2]) : 3;

    console.log(`🚀 Running sync with logic for Attempt #${attempt}...`);
    
    // We pass null as the first argument to sync ALL stations
    await runSmartSync(null, attempt);

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