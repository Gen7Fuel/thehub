const express = require("express");
const mongoose = require("mongoose");
const { logChange } = require("../../../middleware/changeLogger");
const {
  StationAuditIssue,
  StationAuditIssueActivity,
  StationAuditDepartment,
} = require("../../../models/station-audits");
const { accessibleLocations } = require("../../../services/stationAuditTrackerAccess");

const router = express.Router();
const OPEN_STATUSES = ["created", "in_progress", "on_hold"];
const PRIORITIES = ["low", "normal", "high", "critical"];
const STATUS_TRANSITIONS = {
  created: ["in_progress", "on_hold"],
  on_hold: ["in_progress"],
  in_progress: ["on_hold", "resolved"],
};

async function assignedAccessibleIssue(req, issueId) {
  if (!mongoose.isValidObjectId(issueId)) return null;
  const locations = await accessibleLocations(req.user);
  return StationAuditIssue.findOne({
    _id: issueId,
    "assignees.user": req.user?._id,
    status: { $in: OPEN_STATUSES },
    site: { $in: locations.map((location) => location._id) },
  }).select("_id checklist snapshot status site currentDepartment assignees escalation raisedAt resolvedAt resolvedBy updatedAt");
}

function historyCutoff() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return cutoff;
}

function historicalIssueFilter(currentIssue) {
  return {
    _id: { $ne: currentIssue._id },
    checklist: currentIssue.checklist,
    status: { $ne: "created" },
    raisedAt: { $gte: historyCutoff(), $lt: currentIssue.raisedAt },
  };
}

function userId(entry) {
  return entry?._id || entry?.user?._id || entry?.user || entry;
}

async function activeUsersByIds(entries = []) {
  const ids = [...new Map(entries
    .map(userId)
    .filter((id) => id && mongoose.isValidObjectId(id))
    .map((id) => [id.toString(), id])).values()];
  if (!ids.length) return [];
  const users = await mongoose.connection.collection("users")
    .find({ _id: { $in: ids }, is_active: true })
    .project({ _id: 1, email: 1, firstName: 1, lastName: 1 })
    .toArray();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return ids.map((id) => byId.get(id.toString())).filter(Boolean);
}

function peopleLabel(users = []) {
  return users
    .map((user) => `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email)
    .join(", ");
}

async function departmentAssignees(department) {
  const defaults = await activeUsersByIds(department.defaultIssueAssignees || []);
  if (defaults.length) return defaults;
  return activeUsersByIds([department.departmentHead]);
}

async function escalationDestination(issue) {
  const current = await StationAuditDepartment.findById(issue.currentDepartment)
    .select("name escalationDepartment")
    .lean();
  if (!current) return null;

  let destination = null;
  let assignees = [];
  if (current.escalationDepartment) {
    destination = await StationAuditDepartment.findOne({
      _id: current.escalationDepartment,
      active: true,
    })
      .select("name active isAdminDepartment departmentHead defaultIssueAssignees")
      .lean();
    if (destination) assignees = await departmentAssignees(destination);
    if (!assignees.length) destination = null;
  }

  // The named HO Admin department is the preferred fallback, but only when
  // it is explicitly configured as an active admin department.
  if (!destination) {
    const hoAdmin = await StationAuditDepartment.findOne({
      name: /^HO Admin$/i,
      isAdminDepartment: true,
      active: true,
    })
      .select("name active isAdminDepartment departmentHead defaultIssueAssignees")
      .lean();
    if (hoAdmin) {
      const hoAdminAssignees = await departmentAssignees(hoAdmin);
      if (hoAdminAssignees.length) {
        destination = hoAdmin;
        assignees = hoAdminAssignees;
      }
    }
  }

  // If HO Admin is unavailable or unusable, use the first other active admin
  // department that has an active default assignee or department head.
  if (!destination) {
    const adminDepartments = await StationAuditDepartment.find({
      isAdminDepartment: true,
      active: true,
    })
      .select("name active isAdminDepartment departmentHead defaultIssueAssignees")
      .sort({ name: 1 })
      .lean();
    for (const adminDepartment of adminDepartments) {
      if (String(adminDepartment.name || "").trim().toLowerCase() === "ho admin") continue;
      const adminAssignees = await departmentAssignees(adminDepartment);
      if (adminAssignees.length) {
        destination = adminDepartment;
        assignees = adminAssignees;
        break;
      }
    }
  }
  if (!destination) return null;
  return { current, destination, assignees };
}

function normalizeActivityInput(input = {}) {
  const body = String(input.body || "").trim().slice(0, 5000);
  const photos = [...new Set(
    (Array.isArray(input.photos) ? input.photos : [])
      .map((photo) => String(photo || "").trim())
      .filter(Boolean)
      .slice(0, 10)
  )];
  return { body, photos };
}

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

// GET /api/station-audits/tracker/my-issues/:issueId/activities
router.get("/:issueId/activities", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });

    const limit = positiveInteger(req.query.limit, 100, 200);
    const [newestActivities, total] = await Promise.all([
      StationAuditIssueActivity.find({ issue: issue._id })
        .select("eventType actor body photos changes createdAt updatedAt")
        .populate("actor", "firstName lastName email")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean(),
      StationAuditIssueActivity.countDocuments({ issue: issue._id }),
    ]);

    return res.json({
      activities: newestActivities.reverse(),
      total,
      hasMore: total > newestActivities.length,
    });
  } catch (error) {
    console.error("Failed to load Station Audit issue activity:", error);
    return res.status(500).json({ error: "Failed to load issue activity" });
  }
});

// GET /api/station-audits/tracker/my-issues/:issueId/history
router.get("/:issueId/history", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const currentIssue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!currentIssue) return res.status(404).json({ error: "Open assigned issue not found" });

    const historicalIssues = await StationAuditIssue.find(historicalIssueFilter(currentIssue))
      .select("snapshot status priority site currentDepartment assignees occurrenceNumber raisedAt resolvedAt updatedAt")
      .populate("site", "stationName site")
      .populate("currentDepartment", "name")
      .populate("assignees.user", "firstName lastName email")
      .sort({ raisedAt: -1 })
      .limit(200)
      .lean();

    const currentSite = [];
    const otherSites = [];
    for (const issue of historicalIssues) {
      if (String(issue.site?._id || issue.site) === String(currentIssue.site)) currentSite.push(issue);
      else otherSites.push(issue);
    }

    return res.json({
      currentSite,
      otherSites,
      total: historicalIssues.length,
      window: { from: historyCutoff(), to: currentIssue.raisedAt },
    });
  } catch (error) {
    console.error("Failed to load Station Audit issue history:", error);
    return res.status(500).json({ error: "Failed to load historical issues" });
  }
});

// GET /api/station-audits/tracker/my-issues/:issueId/history/:historicalIssueId/activities
router.get("/:issueId/history/:historicalIssueId/activities", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    if (!mongoose.isValidObjectId(req.params.historicalIssueId)) {
      return res.status(400).json({ error: "Invalid historical issue ID" });
    }
    const currentIssue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!currentIssue) return res.status(404).json({ error: "Open assigned issue not found" });

    const historicalIssue = await StationAuditIssue.findOne({
      ...historicalIssueFilter(currentIssue),
      _id: req.params.historicalIssueId,
    })
      .select("snapshot status priority site currentDepartment assignees occurrenceNumber raisedAt resolvedAt updatedAt")
      .populate("site", "stationName site")
      .populate("currentDepartment", "name")
      .populate("assignees.user", "firstName lastName email")
      .lean();
    if (!historicalIssue) return res.status(404).json({ error: "Historical issue not found" });

    const activities = await StationAuditIssueActivity.find({ issue: historicalIssue._id })
      .select("eventType actor body photos changes createdAt updatedAt")
      .populate("actor", "firstName lastName email")
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    return res.json({ issue: historicalIssue, activities });
  } catch (error) {
    console.error("Failed to load historical Station Audit issue activity:", error);
    return res.status(500).json({ error: "Failed to load historical issue activity" });
  }
});

// POST /api/station-audits/tracker/my-issues/:issueId/activities
router.post("/:issueId/activities", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });

    const { body, photos } = normalizeActivityInput(req.body);
    if (!body && photos.length === 0) {
      return res.status(400).json({ error: "Add a comment or at least one image" });
    }
    if (photos.some((photo) => photo.length > 500)) {
      return res.status(400).json({ error: "An image filename is too long" });
    }

    const activity = await StationAuditIssueActivity.create({
      issue: issue._id,
      eventType: body ? "comment_added" : "photos_added",
      actor: userId,
      body,
      photos,
      changes: [],
    });
    await StationAuditIssue.updateOne({ _id: issue._id }, { $set: { updatedAt: activity.createdAt } });

    await logChange(req, {
      action: "create",
      resourceType: "station-audit-issue-activity",
      resourceId: activity._id,
      resourceStore: "mongodb",
      success: true,
      statusCode: 201,
      after: activity.toObject(),
      resourceLabel: issue.snapshot?.checklistItem || "Station Audit issue",
      message: body ? "Added a comment to a Station Audit issue" : "Added images to a Station Audit issue",
      source: "station-audit.tracker.my-issues.activity",
    });

    await activity.populate("actor", "firstName lastName email");
    return res.status(201).json({ activity: activity.toObject() });
  } catch (error) {
    console.error("Failed to add Station Audit issue activity:", error);
    return res.status(500).json({ error: "Failed to add issue activity" });
  }
});

// GET /api/station-audits/tracker/my-issues/:issueId/escalation-target
router.get("/:issueId/escalation-target", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });
    const target = await escalationDestination(issue);
    if (!target) {
      return res.status(409).json({
        error: "There is no escalation department available for this issue. Contact an administrator for more details.",
      });
    }
    return res.json({
      department: {
        _id: target.destination._id,
        name: target.destination.name,
        isAdminDepartment: target.destination.isAdminDepartment === true,
      },
      assignees: target.assignees.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      })),
    });
  } catch (error) {
    console.error("Failed to resolve Station Audit escalation target:", error);
    return res.status(500).json({ error: "Failed to resolve the escalation department" });
  }
});

// POST /api/station-audits/tracker/my-issues/:issueId/status
router.post("/:issueId/status", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });

    const nextStatus = String(req.body?.status || "").trim();
    const comment = String(req.body?.comment || "").trim().slice(0, 5000);
    if (!(STATUS_TRANSITIONS[issue.status] || []).includes(nextStatus)) {
      return res.status(400).json({ error: `The issue cannot move from ${issue.status} to ${nextStatus || "that status"}` });
    }
    if (nextStatus === "resolved" && !comment) {
      return res.status(400).json({ error: "A resolution comment is required" });
    }

    const now = new Date();
    const before = issue.toObject();
    issue.status = nextStatus;
    issue.resolvedAt = nextStatus === "resolved" ? now : null;
    issue.resolvedBy = nextStatus === "resolved" ? userId : null;
    await issue.save();

    const statusLabels = {
      created: "Created",
      in_progress: "In Progress",
      on_hold: "On Hold",
      resolved: "Resolved",
    };
    const activities = [{
      issue: issue._id,
      eventType: "status_changed",
      actor: userId,
      body: nextStatus === "resolved" ? "" : comment,
      changes: [{
        field: "status",
        from: { value: before.status, label: statusLabels[before.status] },
        to: { value: nextStatus, label: statusLabels[nextStatus] },
      }],
    }];
    if (nextStatus === "resolved") {
      activities.push({
        issue: issue._id,
        eventType: "resolved",
        actor: userId,
        body: comment,
        changes: [],
      });
    }
    await StationAuditIssueActivity.insertMany(activities);

    await logChange(req, {
      action: "update",
      resourceType: "station-audit-issue",
      resourceId: issue._id,
      resourceStore: "mongodb",
      success: true,
      statusCode: 200,
      before,
      after: issue.toObject(),
      resourceLabel: issue.snapshot?.checklistItem,
      message: `Changed Station Audit issue status from ${statusLabels[before.status]} to ${statusLabels[nextStatus]}`,
      source: "station-audit.tracker.my-issues.status",
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to update Station Audit issue status:", error);
    return res.status(500).json({ error: "Failed to update issue status" });
  }
});

// POST /api/station-audits/tracker/my-issues/:issueId/escalate
router.post("/:issueId/escalate", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });
    const target = await escalationDestination(issue);
    if (!target) {
      return res.status(409).json({
        error: "There is no escalation department available for this issue. Contact an administrator for more details.",
      });
    }
    if (String(target.destination._id) === String(issue.currentDepartment)) {
      return res.status(409).json({ error: "This issue is already assigned to the escalation department" });
    }

    const reason = String(req.body?.reason || "").trim().slice(0, 5000);
    if (!reason) {
      return res.status(400).json({ error: "An escalation reason is required" });
    }
    const previousUsers = await activeUsersByIds(issue.assignees || []);
    const before = issue.toObject();
    const now = new Date();
    issue.currentDepartment = target.destination._id;
    issue.assignees = target.assignees.map((user, index) => ({
      user: user._id,
      role: index === 0 ? "owner" : "collaborator",
      assignedBy: userId,
      assignedAt: now,
    }));
    issue.escalation = {
      level: target.destination.isAdminDepartment ? "head_office" : "department",
      escalatedAt: now,
      escalatedBy: userId,
      reason,
    };
    await issue.save();

    await StationAuditIssueActivity.insertMany([
      {
        issue: issue._id,
        eventType: "department_changed",
        actor: userId,
        changes: [{
          field: "department",
          from: { id: target.current._id, label: target.current.name },
          to: { id: target.destination._id, label: target.destination.name },
        }],
      },
      {
        issue: issue._id,
        eventType: "assignment_changed",
        actor: userId,
        changes: [{
          field: "assignees",
          from: { value: previousUsers.map((user) => user._id).join(","), label: peopleLabel(previousUsers) },
          to: { value: target.assignees.map((user) => user._id).join(","), label: peopleLabel(target.assignees) },
        }],
      },
      {
        issue: issue._id,
        eventType: "escalated",
        actor: userId,
        body: reason,
        changes: [{
          field: "escalationLevel",
          from: { value: before.escalation?.level || "none", label: before.escalation?.level === "head_office" ? "Head Office" : before.escalation?.level === "department" ? "Department" : "Not Escalated" },
          to: { value: issue.escalation.level, label: issue.escalation.level === "head_office" ? "Head Office" : "Department" },
        }],
      },
    ]);

    await logChange(req, {
      action: "update",
      resourceType: "station-audit-issue",
      resourceId: issue._id,
      resourceStore: "mongodb",
      success: true,
      statusCode: 200,
      before,
      after: issue.toObject(),
      resourceLabel: issue.snapshot?.checklistItem,
      message: `Escalated Station Audit issue to ${target.destination.name}`,
      source: "station-audit.tracker.my-issues.escalation",
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to escalate Station Audit issue:", error);
    return res.status(500).json({ error: "Failed to escalate issue" });
  }
});

module.exports = {
  router,
  issueFilter,
  normalizeActivityInput,
  OPEN_STATUSES,
  PRIORITIES,
  STATUS_TRANSITIONS,
  historicalIssueFilter,
};
