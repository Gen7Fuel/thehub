const express = require("express");
const mongoose = require("mongoose");
const { StationAuditIssue } = require("../../../models/station-audits");
const { accessibleLocations } = require("../../../services/stationAuditTrackerAccess");

const router = express.Router();
const OPEN_STATUSES = ["created", "in_progress", "on_hold"];
const PRIORITIES = ["low", "normal", "high", "critical"];

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function issueFilter({ userId, siteIds, site, status, priority, search }) {
  const filter = {
    "assignees.user": userId,
    status: { $in: status && OPEN_STATUSES.includes(status) ? [status] : OPEN_STATUSES },
    site: { $in: siteIds },
  };
  if (priority && PRIORITIES.includes(priority)) filter.priority = priority;
  if (site) filter.site = site;
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { "snapshot.checklistItem": expression },
      { "snapshot.sectionName": expression },
      { "snapshot.category": expression },
      { "snapshot.departmentName": expression },
      { "snapshot.statusLabel": expression },
    ];
  }
  return filter;
}

// GET /api/station-audits/tracker/my-issues
router.get("/", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });

    const locations = await accessibleLocations(req.user);
    const siteIds = locations.map((location) => location._id);
    const requestedSite = String(req.query.site || "").trim();
    let selectedSite = null;
    if (requestedSite && requestedSite !== "all") {
      selectedSite = locations.find((location) =>
        String(location._id) === requestedSite
        || location.stationName === requestedSite
        || location.site === requestedSite
      );
      if (!selectedSite) {
        return res.status(403).json({ error: "You do not have access to the requested site" });
      }
    }

    const status = String(req.query.status || "").trim();
    const priority = String(req.query.priority || "").trim();
    if (status && status !== "all" && !OPEN_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid issue status" });
    }
    if (priority && priority !== "all" && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid issue priority" });
    }

    const page = positiveInteger(req.query.page, 1, 100000);
    const limit = positiveInteger(req.query.limit, 30, 100);
    const search = String(req.query.search || "").trim().slice(0, 200);
    const baseFilter = {
      "assignees.user": userId,
      status: { $in: OPEN_STATUSES },
      site: { $in: siteIds },
    };
    const filter = issueFilter({
      userId,
      siteIds,
      site: selectedSite?._id,
      status: status === "all" ? "" : status,
      priority: priority === "all" ? "" : priority,
      search,
    });

    const [issues, total, summaryRows] = await Promise.all([
      StationAuditIssue.find(filter)
        .select("response run checklist section originDepartment currentDepartment site snapshot status priority assignees escalation previousIssue occurrenceNumber raisedBy raisedAt resolvedBy resolvedAt updatedAt")
        .populate("site", "stationName site timezone")
        .populate("originDepartment", "name")
        .populate("currentDepartment", "name")
        .populate("assignees.user", "firstName lastName email is_active")
        .populate("raisedBy", "firstName lastName email")
        .populate({
          path: "response",
          select: "checklistSnapshot selectedStatus comment photos checkedAt checkedBy",
          populate: { path: "checkedBy", select: "firstName lastName email" },
        })
        .populate("run", "frequency periodKey type startedAt completedAt")
        .sort({ updatedAt: -1, raisedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StationAuditIssue.countDocuments(filter),
      StationAuditIssue.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const summaryByStatus = new Map(summaryRows.map((row) => [row._id, row.count]));
    const summary = {
      total: summaryRows.reduce((sum, row) => sum + row.count, 0),
      created: summaryByStatus.get("created") || 0,
      inProgress: summaryByStatus.get("in_progress") || 0,
      onHold: summaryByStatus.get("on_hold") || 0,
    };

    return res.json({
      issues,
      summary,
      sites: locations.map((location) => ({
        _id: location._id,
        name: location.site || location.stationName,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: total ? Math.ceil(total / limit) : 0,
      },
      filters: {
        status: status || "all",
        priority: priority || "all",
        site: selectedSite?._id || "all",
        search,
      },
    });
  } catch (error) {
    console.error("Failed to load assigned Station Audit issues:", error);
    return res.status(500).json({ error: "Failed to load your Station Audit issues" });
  }
});

module.exports = { router, issueFilter, OPEN_STATUSES, PRIORITIES };
