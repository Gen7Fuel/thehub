const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { runAndEmailReport } = require('../cron_jobs/productCategoryMappingCron');

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('Starting categoryProductMapping sync...');
    await runAndEmailReport();
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
