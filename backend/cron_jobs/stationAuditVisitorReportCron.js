const cron = require("../runtime/scheduler").forModule("stationAuditVisitorReportCron");
const { runStationAuditVisitorReports } = require("../services/stationAuditVisitorReportService");

async function runVisitorReportCron() {
  const summary = await runStationAuditVisitorReports();
  console.log("Station Audit Visitor report run completed:", {
    locations: summary.locations,
    queued: summary.queued,
    skipped: summary.skipped,
    failed: summary.failed,
  });
  return summary;
}

// All station-local dates have crossed midnight by 6 AM Toronto time. The
// report service still calculates "yesterday" independently in each site's
// configured timezone.
cron.schedule("0 6 * * *", runVisitorReportCron, {
  scheduled: true,
  timezone: "America/Toronto",
});

module.exports = { runVisitorReportCron };
