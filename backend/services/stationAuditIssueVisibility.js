const { StationAuditIssue } = require("../models/station-audits");

const OPEN_ISSUE_STATUSES = ["created", "in_progress", "on_hold"];

async function getOpenIssueChecklistIds({ siteId, checklistIds, type = "store" }) {
  if (type !== "store" || !siteId || !checklistIds?.length) return new Set();

  const ids = await StationAuditIssue.distinct("checklist", {
    site: siteId,
    checklist: { $in: checklistIds },
    status: { $in: OPEN_ISSUE_STATUSES },
  });

  return new Set(ids.map(String));
}

function isChecklistVisible({ checklistId, openIssueChecklistIds, currentResponseChecklistIds }) {
  const key = String(checklistId);
  return !openIssueChecklistIds.has(key) || currentResponseChecklistIds.has(key);
}

module.exports = {
  OPEN_ISSUE_STATUSES,
  getOpenIssueChecklistIds,
  isChecklistVisible,
};
