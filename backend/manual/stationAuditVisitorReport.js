require("dotenv").config();
require("../runtime/role").selectRole("api");
const connectDB = require("../config/db");
const { runStationAuditVisitorReports, validateReportDate } = require("../services/stationAuditVisitorReportService");

function dateArgument(argv = process.argv.slice(2)) {
  const inline = argv.find((value) => value.startsWith("--date="));
  if (inline) return validateReportDate(inline.slice("--date=".length));
  const index = argv.indexOf("--date");
  if (index >= 0) {
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error("--date requires YYYY-MM-DD");
    return validateReportDate(argv[index + 1]);
  }
  const positional = argv.find((value) => !value.startsWith("--"));
  return validateReportDate(positional);
}

async function run() {
  const date = dateArgument();
  await connectDB();
  const summary = await runStationAuditVisitorReports({ date });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed) process.exitCode = 1;
  return summary;
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Station Audit Visitor report failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await require("../queues/emailQueue").emailQueue.close();
      await require("mongoose").disconnect();
      await require("../utils/redisClient").quit();
    });
}

module.exports = { dateArgument, run };
