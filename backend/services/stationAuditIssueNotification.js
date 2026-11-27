const mongoose = require("mongoose");
const { pushNotification } = require("./notificationService");
const {
  StationAuditIssue,
  StationAuditDepartment,
} = require("../models/station-audits");

const TEMPLATE_SLUG = "station-audit-issue-update";
const ASSIGNMENT_TEMPLATE_SLUG = "station-audit-issue-assigned";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayName(user) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
    || user?.email
    || "A Hub user";
}

function isActiveUser(user) {
  return Boolean(user?.email) && user?.is_active !== false;
}

function buildFieldValues({ issue, updateType, updateReason, actor }) {
  return {
    checklistName: escapeHtml(issue.snapshot?.checklistItem || "Station Audit checklist"),
    sectionName: escapeHtml(issue.snapshot?.sectionName || "Not specified"),
    siteName: escapeHtml(issue.site?.stationName || issue.site?.site || "Unknown site"),
    category: escapeHtml(issue.snapshot?.category || "Not specified"),
    updateType: escapeHtml(updateType),
    updateReason: escapeHtml(updateReason),
    updatedBy: escapeHtml(displayName(actor)),
    issueId: String(issue._id),
  };
}

async function loadIssueAudience(issueId) {
  return StationAuditIssue.findById(issueId)
    .select("snapshot site currentDepartment assignees")
    .populate("site", "stationName site")
    .populate({
      path: "currentDepartment",
      select: "name departmentHead notificationEmails siteNotifications",
      populate: { path: "departmentHead", select: "email firstName lastName is_active" },
    })
    .populate("assignees.user", "email firstName lastName is_active")
    .lean();
}

async function recipientEmailsForIssue(issue, extraRecipientEmails = []) {
  const recipients = new Set(extraRecipientEmails.map(normalizeEmail).filter(Boolean));
  const department = issue.currentDepartment;

  for (const assignment of issue.assignees || []) {
    if (isActiveUser(assignment.user)) recipients.add(normalizeEmail(assignment.user.email));
  }
  if (isActiveUser(department?.departmentHead)) {
    recipients.add(normalizeEmail(department.departmentHead.email));
  }
  for (const email of department?.notificationEmails || []) {
    if (normalizeEmail(email)) recipients.add(normalizeEmail(email));
  }

  const siteId = String(issue.site?._id || issue.site || "");
  for (const override of department?.siteNotifications || []) {
    if (String(override.site) !== siteId) continue;
    for (const email of override.emails || []) {
      if (normalizeEmail(email)) recipients.add(normalizeEmail(email));
    }
  }

  const adminDepartments = await StationAuditDepartment.find({
    isAdminDepartment: true,
    active: true,
    departmentHead: { $ne: null },
  })
    .select("departmentHead")
    .populate("departmentHead", "email firstName lastName is_active")
    .lean();
  for (const adminDepartment of adminDepartments) {
    if (isActiveUser(adminDepartment.departmentHead)) {
      recipients.add(normalizeEmail(adminDepartment.departmentHead.email));
    }
  }
  return [...recipients];
}

async function queueStationAuditIssueUpdateNotification({
  req,
  issueId,
  updateType,
  updateReason,
  extraRecipientEmails = [],
  excludedRecipientEmails = [],
}) {
  if (!mongoose.isValidObjectId(issueId)) return null;
  const issue = await loadIssueAudience(issueId);
  if (!issue) return null;

  const actorEmail = normalizeEmail(req.user?.email);
  const excluded = new Set(excludedRecipientEmails.map(normalizeEmail).filter(Boolean));
  const recipientEmails = (await recipientEmailsForIssue(issue, extraRecipientEmails))
    .filter((email) => email !== actorEmail && !excluded.has(email));
  if (!recipientEmails.length) return null;

  const fieldValues = buildFieldValues({
    issue,
    updateType,
    updateReason,
    actor: req.user,
  });
  return pushNotification({
    io: req.app.get("io"),
    senderId: req.user?._id || null,
    recipientEmails,
    slug: TEMPLATE_SLUG,
    fieldValues,
    subject: `Audit issue update: ${issue.snapshot?.checklistItem || "Checklist"} — ${issue.site?.stationName || issue.site?.site || "Site"}`,
    type: "system",
  });
}

async function queueStationAuditIssueAssignedNotification({ req, issueId, assignees = [] }) {
  if (!mongoose.isValidObjectId(issueId)) return null;
  const issue = await loadIssueAudience(issueId);
  if (!issue) return null;
  const actorEmail = normalizeEmail(req.user?.email);
  const recipients = assignees
    .filter((assignment) => isActiveUser(assignment.user || assignment))
    .map((assignment) => ({
      email: normalizeEmail((assignment.user || assignment).email),
      role: assignment.role || "collaborator",
    }))
    .filter((assignment) => assignment.email && assignment.email !== actorEmail);
  if (!recipients.length) return null;
  return Promise.all(["owner", "collaborator"].map(async (role) => {
    const recipientEmails = [...new Set(recipients.filter((recipient) => recipient.role === role).map((recipient) => recipient.email))];
    if (!recipientEmails.length) return null;
    return pushNotification({
      io: req.app.get("io"), senderId: req.user?._id || null, recipientEmails,
      slug: ASSIGNMENT_TEMPLATE_SLUG,
      fieldValues: {
        checklistName: escapeHtml(issue.snapshot?.checklistItem || "Station Audit checklist"),
        sectionName: escapeHtml(issue.snapshot?.sectionName || "Not specified"),
        siteName: escapeHtml(issue.site?.stationName || issue.site?.site || "Unknown site"),
        category: escapeHtml(issue.snapshot?.category || "Not specified"),
        assignedBy: escapeHtml(displayName(req.user)),
        assignmentRole: role === "owner" ? "Owner" : "Collaborator",
        issueId: String(issue._id),
      },
      subject: `Station Audit issue assigned: ${issue.snapshot?.checklistItem || "Checklist"} — ${issue.site?.stationName || issue.site?.site || "Site"}`,
      type: "system",
    });
  }));
}

function notifyStationAuditIssueUpdate(options) {
  void queueStationAuditIssueUpdateNotification(options).catch((error) => {
    // Notifications must never roll back an issue update. A missing template
    // can occur while the matching Hub template is being configured.
    console.error("Failed to queue Station Audit issue update notification:", error);
  });
}

function notifyStationAuditIssueAssigned(options) {
  void queueStationAuditIssueAssignedNotification(options).catch((error) => {
    console.error("Failed to queue Station Audit assignment notification:", error);
  });
}

module.exports = {
  TEMPLATE_SLUG,
  ASSIGNMENT_TEMPLATE_SLUG,
  buildFieldValues,
  notifyStationAuditIssueUpdate,
  queueStationAuditIssueUpdateNotification,
  recipientEmailsForIssue,
  notifyStationAuditIssueAssigned,
  queueStationAuditIssueAssignedNotification,
};
