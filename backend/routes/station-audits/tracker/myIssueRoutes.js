const express = require("express");
const mongoose = require("mongoose");
const User = require("../../../models/User");
const Location = require("../../../models/Location");
const { logChange } = require("../../../middleware/changeLogger");
const {
  StationAuditIssue,
  StationAuditIssueActivity,
  StationAuditDepartment,
} = require("../../../models/station-audits");
const { accessibleLocations, accessibleSiteNames } = require("../../../services/stationAuditTrackerAccess");
const { notifyStationAuditIssueUpdate, notifyStationAuditIssueAssigned } = require("../../../services/stationAuditIssueNotification");

const router = express.Router();
const OPEN_STATUSES = ["created", "in_progress", "on_hold"];
const PRIORITIES = ["low", "normal", "high", "critical"];
const STATUS_TRANSITIONS = {
  created: ["in_progress", "on_hold"],
  on_hold: ["in_progress"],
  in_progress: ["on_hold", "resolved"],
};

function isDepartmentScope(req) {
  return req.baseUrl.includes("/department-issues");
}

function trackerSource(req, suffix) {
  return `station-audit.tracker.${isDepartmentScope(req) ? "department-issues" : "my-issues"}.${suffix}`;
}

async function accessibleDepartments(userId) {
  const memberships = await StationAuditDepartment.find({
    active: true,
    $or: [{ departmentHead: userId }, { "members.user": userId }],
  }).select("_id isAdminDepartment").lean();
  if (memberships.some((department) => department.isAdminDepartment === true)) {
    return StationAuditDepartment.find({ active: true }).select("_id name isAdminDepartment").sort({ name: 1 }).lean();
  }
  return StationAuditDepartment.find({
    _id: { $in: memberships.map((department) => department._id) },
    active: true,
  }).select("_id name isAdminDepartment").sort({ name: 1 }).lean();
}

async function assignmentCandidates(issue) {
  const [site, departments] = await Promise.all([
    Location.findById(issue.site).select("stationName site").lean(),
    StationAuditDepartment.find({ active: true })
      .select("name departmentHead members")
      .sort({ name: 1 })
      .lean(),
  ]);
  if (!site) return [];
  const memberships = new Map();
  for (const department of departments) {
    const ids = [department.departmentHead, ...(department.members || []).map((entry) => entry.user)].filter(Boolean);
    for (const id of ids) {
      const key = String(id);
      const current = memberships.get(key) || [];
      current.push({ _id: department._id, name: department.name, current: String(department._id) === String(issue.currentDepartment) });
      memberships.set(key, current);
    }
  }
  const users = await User.find({ _id: { $in: [...memberships.keys()] }, is_active: true })
    .select("firstName lastName email is_active stationName site site_access")
    .sort({ firstName: 1, lastName: 1 })
    .lean();
  const siteNames = new Set([site.stationName, site.site].map((name) => String(name || "").trim()).filter(Boolean));
  return users.filter((user) => accessibleSiteNames(user).some((name) => siteNames.has(name))).map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    departments: memberships.get(String(user._id)) || [],
  }));
}

async function assignedAccessibleIssue(req, issueId) {
  if (!mongoose.isValidObjectId(issueId)) return null;
  const locations = await accessibleLocations(req.user);
  const filter = {
    _id: issueId,
    status: { $in: OPEN_STATUSES },
    site: { $in: locations.map((location) => location._id) },
  };
  if (isDepartmentScope(req)) {
    const departments = await accessibleDepartments(req.user?._id);
    filter.currentDepartment = { $in: departments.map((department) => department._id) };
  } else {
    filter["assignees.user"] = req.user?._id;
  }
  return StationAuditIssue.findOne(filter)
    .select("_id checklist snapshot status priority site currentDepartment assignees escalation raisedAt resolvedAt resolvedBy updatedAt");
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
    .select("name escalationDepartment departmentHead")
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

async function recordFirstAssigneeView(issue, userId) {
  const assignment = (issue.assignees || []).find(
    (entry) => String(entry.user?._id || entry.user) === String(userId)
  );
  if (!assignment || assignment.read === true) return false;

  const now = new Date();
  const dedupeKey = `issue-viewed:${issue._id}:${userId}`;
  await StationAuditIssueActivity.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        issue: issue._id,
        eventType: "issue_viewed",
        actor: userId,
        body: "",
        photos: [],
        changes: [],
        dedupeKey,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await StationAuditIssue.updateOne(
    {
      _id: issue._id,
      assignees: { $elemMatch: { user: userId, read: { $ne: true } } },
    },
    {
      $set: {
        "assignees.$.read": true,
        "assignees.$.readAt": now,
      },
    }
  );
  return true;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function issueFilter({ userId, departmentIds, siteIds, site, status, priority, search }) {
  const filter = {
    status: { $in: status && OPEN_STATUSES.includes(status) ? [status] : OPEN_STATUSES },
    site: { $in: siteIds },
  };
  if (departmentIds) filter.currentDepartment = { $in: departmentIds };
  else filter["assignees.user"] = userId;
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
    const departmentScope = isDepartmentScope(req);
    const departments = departmentScope ? await accessibleDepartments(userId) : [];
    const requestedDepartment = String(req.query.department || "").trim();
    let selectedDepartment = null;
    if (departmentScope && requestedDepartment && requestedDepartment !== "all") {
      selectedDepartment = departments.find((department) => String(department._id) === requestedDepartment);
      if (!selectedDepartment) return res.status(403).json({ error: "You do not have access to the requested department" });
    }
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
      status: { $in: OPEN_STATUSES },
      site: { $in: siteIds },
    };
    if (departmentScope) baseFilter.currentDepartment = { $in: departments.map((department) => department._id) };
    else baseFilter["assignees.user"] = userId;
    const filter = issueFilter({
      userId,
      departmentIds: departmentScope
        ? selectedDepartment
          ? [selectedDepartment._id]
          : departments.map((department) => department._id)
        : null,
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
      departments: departments.map((department) => ({
        _id: department._id,
        name: department.name,
        isAdminDepartment: department.isAdminDepartment === true,
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
        department: selectedDepartment?._id || "all",
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
      source: trackerSource(req, "activity"),
    });

    await activity.populate("actor", "firstName lastName email");
    const activityType = body && photos.length
      ? "Comment and images added"
      : body
        ? "New comment added"
        : "New images added";
    const activityDetails = body
      ? `${body}${photos.length ? ` (${photos.length} image${photos.length === 1 ? "" : "s"} attached)` : ""}`
      : `${photos.length} new image${photos.length === 1 ? " was" : "s were"} added`;
    notifyStationAuditIssueUpdate({
      req,
      issueId: issue._id,
      updateType: activityType,
      updateReason: activityDetails,
    });
    return res.status(201).json({ activity: activity.toObject() });
  } catch (error) {
    console.error("Failed to add Station Audit issue activity:", error);
    return res.status(500).json({ error: "Failed to add issue activity" });
  }
});

// GET /api/station-audits/tracker/my-issues/:issueId/escalation-target
router.get("/:issueId/escalation-target", async (req, res) => {
  try {
    if (isDepartmentScope(req)) return res.status(404).json({ error: "Escalation is not available from Department Issues" });
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });
    if (issue.escalation?.level && issue.escalation.level !== "none") {
      return res.status(409).json({ error: "This issue has already been escalated" });
    }
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
      source: trackerSource(req, "status"),
    });
    notifyStationAuditIssueUpdate({
      req,
      issueId: issue._id,
      updateType: "Status changed",
      updateReason: `Status changed from ${statusLabels[before.status]} to ${statusLabels[nextStatus]}${comment ? `. ${comment}` : ""}`,
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to update Station Audit issue status:", error);
    return res.status(500).json({ error: "Failed to update issue status" });
  }
});

// GET /api/station-audits/tracker/department-issues/:issueId/department-options
router.get("/:issueId/department-options", async (req, res) => {
  try {
    if (!isDepartmentScope(req)) return res.status(404).json({ error: "Department transfer is only available from Department Issues" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Accessible department issue not found" });
    const departments = await StationAuditDepartment.find({ active: true })
      .select("name departmentHead defaultIssueAssignees isAdminDepartment")
      .sort({ name: 1 })
      .lean();
    const options = [];
    for (const department of departments) {
      const assignees = await departmentAssignees(department);
      options.push({
        _id: department._id,
        name: department.name,
        isAdminDepartment: department.isAdminDepartment === true,
        current: String(department._id) === String(issue.currentDepartment),
        assignees: assignees.map((user) => ({
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        })),
      });
    }
    return res.json({ departments: options });
  } catch (error) {
    console.error("Failed to load Station Audit department transfer options:", error);
    return res.status(500).json({ error: "Failed to load department options" });
  }
});

// GET /api/station-audits/tracker/department-issues/:issueId/assignment-options
router.get("/:issueId/assignment-options", async (req, res) => {
  try {
    if (!isDepartmentScope(req)) return res.status(404).json({ error: "Assignment management is only available from Department Issues" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Accessible department issue not found" });
    return res.json({ users: await assignmentCandidates(issue) });
  } catch (error) {
    console.error("Failed to load Station Audit assignment options:", error);
    return res.status(500).json({ error: "Failed to load assignment options" });
  }
});

// POST /api/station-audits/tracker/department-issues/:issueId/assignments
router.post("/:issueId/assignments", async (req, res) => {
  try {
    if (!isDepartmentScope(req)) return res.status(404).json({ error: "Assignment management is only available from Department Issues" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Accessible department issue not found" });
    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
    if (!assignments.length) return res.status(400).json({ error: "At least one assignee is required" });
    const normalized = assignments.map((entry) => ({ user: String(entry?.user || ""), role: entry?.role }));
    if (normalized.some((entry) => !mongoose.isValidObjectId(entry.user) || !["owner", "collaborator"].includes(entry.role))) {
      return res.status(400).json({ error: "Every assignment must contain a valid user and role" });
    }
    if (new Set(normalized.map((entry) => entry.user)).size !== normalized.length) return res.status(400).json({ error: "A user can only be assigned once" });
    if (normalized.filter((entry) => entry.role === "owner").length !== 1) return res.status(400).json({ error: "Exactly one owner is required" });

    const candidates = await assignmentCandidates(issue);
    const candidateById = new Map(candidates.map((user) => [String(user._id), user]));
    if (normalized.some((entry) => !candidateById.has(entry.user))) {
      return res.status(400).json({ error: "Every assignee must be active, belong to an active department, and have access to the issue site" });
    }
    const previousUsers = await activeUsersByIds(issue.assignees || []);
    const previousIds = new Set((issue.assignees || []).map((entry) => String(entry.user?._id || entry.user)));
    const before = issue.toObject();
    const now = new Date();
    issue.assignees = normalized.map((entry) => ({
      user: new mongoose.Types.ObjectId(entry.user), role: entry.role,
      assignedBy: req.user._id, assignedAt: now, read: false, readAt: null,
    }));
    await issue.save();
    const nextUsers = normalized.map((entry) => ({ ...entry, user: candidateById.get(entry.user) }));
    await StationAuditIssueActivity.create({
      issue: issue._id, eventType: "assignment_changed", actor: req.user._id,
      changes: [{
        field: "assignees",
        from: { value: previousUsers.map((user) => user._id).join(","), label: peopleLabel(previousUsers) },
        to: { value: normalized.map((entry) => entry.user).join(","), label: peopleLabel(nextUsers.map((entry) => entry.user)) },
      }],
    });
    await logChange(req, {
      action: "update", resourceType: "station-audit-issue", resourceId: issue._id,
      resourceStore: "mongodb", success: true, statusCode: 200, before, after: issue.toObject(),
      resourceLabel: issue.snapshot?.checklistItem, message: "Changed Station Audit issue assignment",
      source: trackerSource(req, "assignment"),
    });
    const newlyAssigned = nextUsers.filter((entry) => !previousIds.has(String(entry.user._id)));
    const newlyAssignedEmails = newlyAssigned.map((entry) => entry.user.email).filter(Boolean);
    notifyStationAuditIssueUpdate({
      req, issueId: issue._id, updateType: "Assignment changed",
      updateReason: `Assigned team changed from ${peopleLabel(previousUsers) || "No one"} to ${peopleLabel(nextUsers.map((entry) => entry.user))}`,
      extraRecipientEmails: previousUsers.map((user) => user.email).filter(Boolean),
      excludedRecipientEmails: newlyAssignedEmails,
    });
    notifyStationAuditIssueAssigned({ req, issueId: issue._id, assignees: newlyAssigned });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to change Station Audit issue assignments:", error);
    return res.status(500).json({ error: "Failed to change issue assignments" });
  }
});

// POST /api/station-audits/tracker/department-issues/:issueId/priority
router.post("/:issueId/priority", async (req, res) => {
  try {
    if (!isDepartmentScope(req)) return res.status(404).json({ error: "Priority management is only available from Department Issues" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Accessible department issue not found" });
    const priority = String(req.body?.priority || "").trim();
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid issue priority" });
    if (priority === issue.priority) return res.status(409).json({ error: "The issue already has this priority" });
    const labels = { low: "Low", normal: "Normal", high: "High", critical: "Critical" };
    const before = issue.toObject();
    issue.priority = priority;
    await issue.save();
    await StationAuditIssueActivity.create({
      issue: issue._id,
      eventType: "priority_changed",
      actor: req.user._id,
      changes: [{ field: "priority", from: { value: before.priority, label: labels[before.priority] }, to: { value: priority, label: labels[priority] } }],
    });
    await logChange(req, {
      action: "update", resourceType: "station-audit-issue", resourceId: issue._id,
      resourceStore: "mongodb", success: true, statusCode: 200, before, after: issue.toObject(),
      resourceLabel: issue.snapshot?.checklistItem,
      message: `Changed Station Audit issue priority from ${labels[before.priority]} to ${labels[priority]}`,
      source: trackerSource(req, "priority"),
    });
    notifyStationAuditIssueUpdate({
      req, issueId: issue._id, updateType: "Priority changed",
      updateReason: `Priority changed from ${labels[before.priority]} to ${labels[priority]}`,
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to update Station Audit issue priority:", error);
    return res.status(500).json({ error: "Failed to update issue priority" });
  }
});

// POST /api/station-audits/tracker/department-issues/:issueId/department
router.post("/:issueId/department", async (req, res) => {
  try {
    if (!isDepartmentScope(req)) return res.status(404).json({ error: "Department transfer is only available from Department Issues" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Accessible department issue not found" });
    const departmentId = String(req.body?.department || "").trim();
    const comment = String(req.body?.comment || "").trim().slice(0, 5000);
    if (!mongoose.isValidObjectId(departmentId)) return res.status(400).json({ error: "Select a valid department" });
    if (!comment) return res.status(400).json({ error: "A department change comment is required" });
    if (String(issue.currentDepartment) === departmentId) return res.status(409).json({ error: "This issue already belongs to that department" });

    const [currentDepartment, destination] = await Promise.all([
      StationAuditDepartment.findById(issue.currentDepartment).select("name departmentHead").lean(),
      StationAuditDepartment.findOne({ _id: departmentId, active: true })
        .select("name departmentHead defaultIssueAssignees isAdminDepartment").lean(),
    ]);
    if (!destination) return res.status(404).json({ error: "The selected department is not active or no longer exists" });
    const nextAssignees = await departmentAssignees(destination);
    if (!nextAssignees.length) return res.status(409).json({ error: "The selected department has no active default assignee or department head" });

    const previousUsers = await activeUsersByIds(issue.assignees || []);
    const previousHead = await activeUsersByIds([currentDepartment?.departmentHead]);
    const before = issue.toObject();
    const now = new Date();
    issue.currentDepartment = destination._id;
    issue.assignees = nextAssignees.map((user, index) => ({
      user: user._id,
      role: index === 0 ? "owner" : "collaborator",
      assignedBy: req.user._id,
      assignedAt: now,
      read: false,
      readAt: null,
    }));
    await issue.save();
    await StationAuditIssueActivity.create({
      issue: issue._id,
      eventType: "department_changed",
      actor: req.user._id,
      body: comment,
      changes: [
        { field: "department", from: { id: currentDepartment?._id, label: currentDepartment?.name || "Unknown department" }, to: { id: destination._id, label: destination.name } },
        { field: "assignees", from: { value: previousUsers.map((user) => user._id).join(","), label: peopleLabel(previousUsers) }, to: { value: nextAssignees.map((user) => user._id).join(","), label: peopleLabel(nextAssignees) } },
      ],
    });
    await logChange(req, {
      action: "update", resourceType: "station-audit-issue", resourceId: issue._id,
      resourceStore: "mongodb", success: true, statusCode: 200, before, after: issue.toObject(),
      resourceLabel: issue.snapshot?.checklistItem,
      message: `Transferred Station Audit issue from ${currentDepartment?.name || "unknown"} to ${destination.name}`,
      source: trackerSource(req, "department"),
    });
    notifyStationAuditIssueUpdate({
      req, issueId: issue._id, updateType: "Department changed",
      updateReason: `Transferred from ${currentDepartment?.name || "Unknown department"} to ${destination.name}. ${comment}`,
      extraRecipientEmails: [...previousUsers, ...previousHead].map((user) => user.email).filter(Boolean),
      excludedRecipientEmails: nextAssignees.map((user) => user.email).filter(Boolean),
    });
    notifyStationAuditIssueAssigned({
      req,
      issueId: issue._id,
      assignees: nextAssignees.map((user, index) => ({ user, role: index === 0 ? "owner" : "collaborator" })),
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to change Station Audit issue department:", error);
    return res.status(500).json({ error: "Failed to change issue department" });
  }
});

// POST /api/station-audits/tracker/my-issues/:issueId/escalate
router.post("/:issueId/escalate", async (req, res) => {
  try {
    if (isDepartmentScope(req)) return res.status(404).json({ error: "Escalation is not available from Department Issues" });
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const issue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!issue) return res.status(404).json({ error: "Open assigned issue not found" });
    if (issue.escalation?.level && issue.escalation.level !== "none") {
      return res.status(409).json({ error: "This issue has already been escalated" });
    }
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
    const previousDepartmentHead = await activeUsersByIds([target.current.departmentHead]);
    const before = issue.toObject();
    const now = new Date();
    issue.currentDepartment = target.destination._id;
    issue.assignees = target.assignees.map((user, index) => ({
      user: user._id,
      role: index === 0 ? "owner" : "collaborator",
      assignedBy: userId,
      assignedAt: now,
      read: false,
      readAt: null,
    }));
    issue.escalation = {
      level: target.destination.isAdminDepartment ? "head_office" : "department",
      escalatedAt: now,
      escalatedBy: userId,
      reason,
    };
    await issue.save();

    await StationAuditIssueActivity.create({
      issue: issue._id,
      eventType: "escalated",
      actor: userId,
      body: reason,
      changes: [
        {
          field: "escalation",
          from: { value: before.escalation?.level || "none", label: "Not Escalated" },
          to: { id: target.destination._id, value: issue.escalation.level, label: target.destination.name },
        },
        {
          field: "department",
          from: { id: target.current._id, label: target.current.name },
          to: { id: target.destination._id, label: target.destination.name },
        },
        {
          field: "assignees",
          from: { value: previousUsers.map((user) => user._id).join(","), label: peopleLabel(previousUsers) },
          to: { value: target.assignees.map((user) => user._id).join(","), label: peopleLabel(target.assignees) },
        },
      ],
    });

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
    notifyStationAuditIssueUpdate({
      req,
      issueId: issue._id,
      updateType: "Issue escalated",
      updateReason: `Escalated from ${target.current.name} to ${target.destination.name}. Reason: ${reason}`,
      extraRecipientEmails: [...previousUsers, ...previousDepartmentHead]
        .map((user) => user.email)
        .filter(Boolean),
    });
    return res.json({ issue: issue.toObject() });
  } catch (error) {
    console.error("Failed to escalate Station Audit issue:", error);
    return res.status(500).json({ error: "Failed to escalate issue" });
  }
});

// GET /api/station-audits/tracker/my-issues/:issueId
// Opening the dedicated issue page records the assignee's first view exactly
// once. Admin-only reads use their separate access logging and never reach
// this assignee-scoped route unless the admin is also assigned.
router.get("/:issueId", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const accessibleIssue = await assignedAccessibleIssue(req, req.params.issueId);
    if (!accessibleIssue) return res.status(404).json({ error: "Open assigned issue not found" });

    if (!isDepartmentScope(req)) await recordFirstAssigneeView(accessibleIssue, userId);
    const issue = await StationAuditIssue.findById(accessibleIssue._id)
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
      .lean();

    return res.json({ issue });
  } catch (error) {
    console.error("Failed to load assigned Station Audit issue:", error);
    return res.status(500).json({ error: "Failed to load the Station Audit issue" });
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
  recordFirstAssigneeView,
};
