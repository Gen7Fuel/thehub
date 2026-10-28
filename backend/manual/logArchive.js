require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { runLogArchive } = require('../cron_jobs/logArchiveService');

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function manualOptions() {
  const type = readOption('--type');
  const safeDaysValue = readOption('--safe-days');
  if (!type || !['access', 'change', 'both'].includes(type)) {
    throw new Error('Use --type access, --type change, or --type both');
  }
  if (safeDaysValue === undefined) {
    throw new Error('Provide --safe-days followed by a non-negative integer');
  }
  const safeDays = Number(safeDaysValue);
  if (!Number.isInteger(safeDays) || safeDays < 0) {
    throw new Error('--safe-days must be a non-negative integer');
  }
  return {
    types: type === 'both' ? ['access', 'change'] : [type],
    safeDays,
  };
}

async function run() {
  let failed = false;
  try {
    const options = manualOptions();
    await connectDB();
    console.log('Starting manual log archive with options:', options);
    const result = await runLogArchive(options);
    console.log('Manual log archive completed:', JSON.stringify(result, null, 2));
  } catch (error) {
    failed = true;
    console.error('Manual log archive failed:', error.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exitCode = failed ? 1 : 0;
  }
}

if (require.main === module) run();

module.exports = { manualOptions, run };
