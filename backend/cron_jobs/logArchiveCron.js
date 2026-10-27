const cron = require('node-cron');
const { runLogArchive } = require('./logArchiveService');

// Runs every day at 08:00 UTC. The archive service calculates all retention
// boundaries as UTC calendar days regardless of the host/container timezone.
cron.schedule('0 8 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Starting scheduled log archival`);
  try {
    const result = await runLogArchive();
    console.log(`[${new Date().toISOString()}] Scheduled log archival completed`, {
      threshold: result.threshold,
      safeDays: result.safeDays,
      collections: result.results?.map(({ type, documentCount, archived }) => ({
        type,
        documentCount,
        archivedDays: archived.length,
      })),
      skipped: result.skipped,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Scheduled log archival failed:`, error);
  }
}, {
  scheduled: true,
  timezone: 'UTC',
});

module.exports = { runLogArchive };
