const {processDailyScheduledSync} = require('../cron_jobs/syncDailyStgLiveFuelCron');

async function run() {
  let hadError = false;

  try {

    console.log('Starting Daily Sync...\n');

    // Run the new sync logic
    await processDailyScheduledSync();

    console.log('\nSync completed successfully.');

  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();