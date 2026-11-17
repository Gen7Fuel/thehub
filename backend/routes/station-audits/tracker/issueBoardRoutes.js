const express = require("express");
const mongoose = require("mongoose");
const {
  StationAuditIssue,
  StationAuditIssueActivity,
  StationAuditDepartment,
} = require("../../../models/station-audits");
const { accessibleLocations } = require("../../../services/stationAuditTrackerAccess");

const router = express.Router();
const STATUSES = ["created", "in_progress", "on_hold", "resolved"];
const PRIORITIES = ["low", "normal", "high", "critical"];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function boardScope(req) {
  const locations = await accessibleLocations(req.user);
  return { locations, siteIds: locations.map((location) => location._id) };
}

function populateIssue(query) {
  return query
    .select("response run checklist section originDepartment currentDepartment site snapshot status priority assignees escalation occurrenceNumber raisedBy raisedAt resolvedBy resolvedAt updatedAt")
    .populate("site", "stationName site timezone")
    .populate("currentDepartment", "name")
    .populate("assignees.user", "firstName lastName email is_active")
    .populate("raisedBy", "firstName lastName email")
    .populate({ path: "response", select: "selectedStatus comment photos checkedAt checkedBy" })
    .populate("run", "frequency periodKey type startedAt completedAt")
    .lean();
}

async function prioritizedIssues(filter) {
  const ranked = await StationAuditIssue.aggregate([
    { $match: filter },
    {
      $addFields: {
        priorityRank: {
          $switch: {
            branches: [
              { case: { $eq: ["$priority", "critical"] }, then: 4 },
              { case: { $eq: ["$priority", "high"] }, then: 3 },
              { case: { $eq: ["$priority", "normal"] }, then: 2 },
              { case: { $eq: ["$priority", "low"] }, then: 1 },
            ],
            default: 0,
          },
        },
      },
    },
    { $sort: { priorityRank: -1, updatedAt: -1, _id: 1 } },
    { $limit: 100 },
    { $project: { _id: 1 } },
  ]);
  if (!ranked.length) return [];
  const issues = await populateIssue(StationAuditIssue.find({ _id: { $in: ranked.map((entry) => entry._id) } }));
  const byId = new Map(issues.map((issue) => [String(issue._id), issue]));
  return ranked.map((entry) => byId.get(String(entry._id))).filter(Boolean);
}

router.get("/", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const { locations, siteIds } = await boardScope(req);
    const requestedSite = String(req.query.site || "all").trim();
    const requestedDepartment = String(req.query.department || "all").trim();
    const priority = String(req.query.priority || "all").trim();
    const search = String(req.query.search || "").trim().slice(0, 200);

    let site = null;
    if (requestedSite !== "all") {
      site = locations.find((location) => String(location._id) === requestedSite);
      if (!site) return res.status(403).json({ error: "You do not have access to the requested site" });
    }
    let department = null;
    if (requestedDepartment !== "all") {
      if (!mongoose.isValidObjectId(requestedDepartment)) return res.status(400).json({ error: "Invalid department" });
      department = await StationAuditDepartment.findById(requestedDepartment).select("_id name").lean();
      if (!department) return res.status(400).json({ error: "Invalid department" });
    }
    if (priority !== "all" && !PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority" });

    const base = { site: { $in: site ? [site._id] : siteIds } };
    if (department) base.currentDepartment = department._id;
    if (priority !== "all") base.priority = priority;
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      base.$or = [
        { "snapshot.checklistItem": expression },
        { "snapshot.sectionName": expression },
        { "snapshot.category": expression },
        { "snapshot.departmentName": expression },
      ];
    }
    const resolvedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filters = {
      created: { ...base, status: "created" },
      in_progress: { ...base, status: "in_progress" },
      on_hold: { ...base, status: "on_hold" },
      resolved: { ...base, status: "resolved", resolvedAt: { $gte: resolvedCutoff } },
    };
    const rows = await Promise.all(STATUSES.flatMap((status) => [
      prioritizedIssues(filters[status]),
      StationAuditIssue.countDocuments(filters[status]),
    ]));
    const sections = {};
    STATUSES.forEach((status, index) => {
      sections[status] = { issues: rows[index * 2], total: rows[index * 2 + 1] };
    });
    const departments = await StationAuditDepartment.find({ active: true }).select("_id name").sort({ name: 1 }).lean();
    return res.json({
      sections,
      sites: locations.map((location) => ({ _id: location._id, name: location.site || location.stationName })),
      departments,
      filters: { site: site?._id || "all", department: department?._id || "all", priority, search },
      resolvedWindowDays: 30,
    });
  } catch (error) {
    console.error("Failed to load Station Audit Issues Board:", error);
    return res.status(500).json({ error: "Failed to load Issues Board" });
  }
});

router.get("/:issueId/activities", async (req, res) => {
  try {
    if (!req.user?._id || !mongoose.isValidObjectId(req.params.issueId)) return res.status(400).json({ error: "Invalid issue request" });
    const { siteIds } = await boardScope(req);
    const issue = await StationAuditIssue.findOne({ _id: req.params.issueId, site: { $in: siteIds } }).select("_id").lean();
    if (!issue) return res.status(404).json({ error: "Issue not found within your accessible sites" });
    const [activities, total] = await Promise.all([
      StationAuditIssueActivity.find({ issue: issue._id }).populate("actor", "firstName lastName email").sort({ createdAt: -1, _id: -1 }).limit(200).lean(),
      StationAuditIssueActivity.countDocuments({ issue: issue._id }),
    ]);
    activities.reverse();
    return res.json({ activities, total, hasMore: total > activities.length });
  } catch (error) {
    console.error("Failed to load Issues Board activity:", error);
    return res.status(500).json({ error: "Failed to load issue activity" });
  }
});

module.exports = router;
