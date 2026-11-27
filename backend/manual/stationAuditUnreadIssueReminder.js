require("dotenv").config();
require("../runtime/role").selectRole("api");
const connectDB = require("../config/db");
const {
  runStationAuditUnreadIssueReminder,
} = require("../cron_jobs/stationAuditUnreadIssueReminderCron");

async function run() {
  await connectDB();
  const summary = await runStationAuditUnreadIssueReminder({ manual: true });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed) process.exitCode = 1;
  return summary;
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Station Audit unread issue reminder failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await require("../queues/emailQueue").emailQueue.close();
      await require("mongoose").disconnect();
      await require("../utils/redisClient").quit();
    });
}

module.exports = { run };
