const cron = require("../runtime/scheduler").forModule(
  "stationAuditUnreadIssueReminderCron",
);
const User = require("../models/User");
const { StationAuditIssue } = require("../models/station-audits");
const { emailQueue } = require("../queues/emailQueue");

const OPEN_STATUSES = ["created", "in_progress", "on_hold"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function reminderEmail(user, unreadCount) {
  const firstName = String(user.firstName || "").trim();
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hello,";
  const issueLabel = unreadCount === 1 ? "issue" : "issues";
  const subject = `Reminder: ${unreadCount} Station Audit ${issueLabel} waiting to be viewed`;
  const text = `${firstName ? `Hi ${firstName},` : "Hello,"}\n\nYou have ${unreadCount} unread Station Audit ${issueLabel} assigned to you. Log in to the Gen7 Fuel Hub to review ${unreadCount === 1 ? "it" : "them"}.\n\nThis is an automated reminder from the Gen7 Fuel Hub.`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:30px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#5b21b6;color:#ffffff;padding:22px 28px;">
          <h2 style="margin:0;font-size:21px;">Station Audit issue reminder</h2>
        </div>
        <div style="padding:28px;color:#334155;">
          <p style="margin:0 0 18px;font-size:15px;">${greeting}</p>
          <div style="margin:20px 0;padding:22px;text-align:center;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;">
            <div style="font-size:36px;line-height:1;font-weight:700;color:#5b21b6;">${unreadCount}</div>
            <div style="margin-top:8px;font-size:14px;font-weight:600;color:#4c1d95;">Unread ${issueLabel} assigned to you</div>
          </div>
          <p style="font-size:15px;line-height:1.6;">Log in to the Gen7 Fuel Hub to review ${unreadCount === 1 ? "this issue" : "these issues"} and see the latest activity.</p>
          <p style="margin-top:26px;font-size:12px;color:#94a3b8;">This is an automated weekday reminder from the Gen7 Fuel Hub.</p>
        </div>
      </div>
    </div>`;
  return { subject, text, html };
}

async function unreadIssueCounts() {
  return StationAuditIssue.aggregate([
    { $match: { status: { $in: OPEN_STATUSES } } },
    { $unwind: "$assignees" },
    { $match: { "assignees.read": { $ne: true } } },
    { $group: { _id: "$assignees.user", unreadCount: { $sum: 1 } } },
  ]);
}

async function runStationAuditUnreadIssueReminder() {
  const counts = await unreadIssueCounts();
  if (!counts.length) {
    console.log(
      "Station Audit unread issue reminder: no unread assignments found",
    );
    return { users: 0, queued: 0, skipped: 0, failed: 0 };
  }

  const users = await User.find({
    _id: { $in: counts.map((entry) => entry._id) },
    is_active: true,
    email: { $type: "string", $ne: "" },
  })
    .select("_id email firstName lastName")
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of counts) {
    const user = usersById.get(String(entry._id));
    if (!user) {
      skipped += 1;
      continue;
    }
    const unreadCount = Number(entry.unreadCount || 0);
    const content = reminderEmail(user, unreadCount);
    try {
      await emailQueue.add(
        "sendStationAuditUnreadIssueReminder",
        { to: user.email, ...content },
        { attempts: 3, backoff: { type: "exponential", delay: 30000 } },
      );
      queued += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Failed to queue Station Audit unread reminder for user ${user._id}:`,
        error,
      );
    }
  }

  const summary = { users: counts.length, queued, skipped, failed };
  console.log("Station Audit unread issue reminders queued:", summary);
  return summary;
}

cron.schedule("0 9 * * 1-5", runStationAuditUnreadIssueReminder, {
  scheduled: true,
  timezone: "America/Toronto",
});

module.exports = {
  OPEN_STATUSES,
  reminderEmail,
  unreadIssueCounts,
  runStationAuditUnreadIssueReminder,
};
