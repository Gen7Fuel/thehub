const cron = require("../runtime/scheduler").forModule("stationAuditVisitorReportCron");
const { runStationAuditVisitorReports } = require("../services/stationAuditVisitorReportService");

async function runVisitorReportCron({ date, manual = false } = {}) {
  if (process.env.HOST !== "VPS" && manual !== true) {
    console.log("Skipping scheduled Station Audit Visitor report because HOST is not VPS.");
    return;
  }
  const summary = await runStationAuditVisitorReports({ date });
  console.log("Station Audit Visitor report run completed:", {
    locations: summary.locations,
    queued: summary.queued,
    skipped: summary.skipped,
    failed: summary.failed,
  });
  return summary;
}

// The report service calculates yesterday independently for each station.
cron.schedule("0 9 * * *", () => runVisitorReportCron(), {
  scheduled: true,
  timezone: "America/Toronto",
});

module.exports = { runVisitorReportCron };
