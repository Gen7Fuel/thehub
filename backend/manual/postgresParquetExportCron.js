const { runPostgresParquetExport } = require('../cron_jobs/postgresParquetExportCron');

async function run() {
  let hadError = false;

  try {
    console.log(`🚀 Starting manual Postgres Parquet export...`);
    await runPostgresParquetExport();
    console.log(`✅ Completed Postgres Parquet export.`);
  } catch (err) {
    hadError = true;
    console.error('❌ Export Failed:', err);
  } finally {
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
module.exports = { run };