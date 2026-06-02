const {processMonthlySync} = require('../cron_jobs/syncStgLiveFuelPriceCron');

async function run() {
  let hadError = false;

  try {

    console.log('Starting Monthly Sync...\n');

    // Run the new sync logic
    await processMonthlySync();

    console.log('\nSync completed successfully.');

  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();