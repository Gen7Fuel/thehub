const express = require("express");
const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const Location = require("../../models/Location");
const { logChange } = require("../../middleware/changeLogger");
const { enqueueStationAuditOrder } = require("../../queues/stationAuditOrderQueue");
const { emailQueue } = require("../../queues/emailQueue");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditDepartment,
  StationAuditRun,
  StationAuditResponse,
  StationAuditIssue,
  StationAuditIssueActivity,
} = require("../../models/station-audits");

const router = express.Router();
const FREQUENCIES = ["daily", "weekly", "monthly"];
const FREQUENCY_ORDER = new Map(FREQUENCIES.map((frequency, index) => [frequency, index]));
const AUDIT_TYPES = ["store", "visitor"];

function periodKeyFor(frequency, localDate) {
  if (frequency === "daily") return localDate.toFormat("yyyy-MM-dd");
  if (frequency === "monthly") return localDate.toFormat("yyyy-MM");

  // Preserve the legacy audit week calculation while using the station's
  // local calendar date instead of the API server's timezone.
  const year = localDate.year;
  const day = localDate.ordinal - 1;
  const januaryFirstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const week = Math.ceil((day + januaryFirstDay + 1) / 7);
  return `${year}-W${week}`;
}

function periodKeysFor(timezone, date) {
  const zone = timezone || "America/Toronto";
  const parsed = date
    ? DateTime.fromISO(String(date), { zone }).startOf("day")
    : DateTime.now().setZone(zone);

  if (!parsed.isValid) return null;

  return Object.fromEntries(
    FREQUENCIES.map((frequency) => [frequency, periodKeyFor(frequency, parsed)])
  );
}

async function resolveLocation(value) {
  const site = String(value || "").trim();
  if (!site) return null;

  if (mongoose.isValidObjectId(site)) {
    const byId = await Location.findById(site)
      .select("_id stationName site timezone managerEmails email")
      .lean();
    if (byId) return byId;
  }

  return Location.findOne({
    $or: [
      { site: { $regex: `^${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      { stationName: { $regex: `^${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    ],
  })
    .select("_id stationName site timezone managerEmails email")
    .lean();
}

function normalizeResponseInput(body = {}) {
  const checked = body.checked === true;
  const statusOptionId = String(body.statusOptionId || "").trim();
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const issueRaised = body.issueRaised === true;
  const requestOrder = body.requestOrder === true;
  const issueAlreadyResolved = body.issueAlreadyResolved === true;
  const resolutionComment = typeof body.resolutionComment === "string"
    ? body.resolutionComment.trim()
    : "";
  const photos = Array.isArray(body.photos)
    ? [...new Set(body.photos.map((photo) => String(photo || "").trim()).filter(Boolean))]
    : [];

  if (comment.length > 5000) return { error: "Comment cannot exceed 5000 characters" };
  if (resolutionComment.length > 5000) {
    return { error: "Resolution comment cannot exceed 5000 characters" };
  }
  if (photos.length > 10) return { error: "A checklist response can contain at most 10 images" };
  if (photos.some((photo) => photo.length > 500 || photo.includes(".."))) {
    return { error: "Invalid image path" };
  }

  return {
    checked,
    statusOptionId,
    comment,
    issueRaised,
    requestOrder,
    issueAlreadyResolved,
    resolutionComment,
    photos,
  };
}

function shouldCreateIssue(type, input) {
  return type === "store" && input.checked === true && input.issueRaised === true;
}

async function findOrCreateRun(filter, insert) {
  try {
    return await StationAuditRun.findOneAndUpdate(
      filter,
      { $setOnInsert: insert },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // A concurrent first response can win the unique run upsert. Read the
    // winner instead of surfacing a duplicate-key failure to the station.
    if (error?.code === 11000) return StationAuditRun.findOne(filter);
    throw error;
  }
}

function escapedEmailRegex(email) {
  return new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
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

async function activeAdminHeadUsers() {
  const departments = await StationAuditDepartment.find({
    isAdminDepartment: true,
    active: true,
    departmentHead: { $ne: null },
  })
    .select("departmentHead name")
    .sort({ name: 1 })
    .lean();
  return activeUsersByIds(departments.map((department) => department.departmentHead));
}

async function fallbackIssueAssignees(department) {
  const defaults = await activeUsersByIds(department.defaultIssueAssignees || []);
  if (defaults.length) return defaults;

  const heads = await activeUsersByIds([department.departmentHead]);
  if (heads.length) return heads;

  const adminHeads = await activeAdminHeadUsers();
  return adminHeads.length ? [adminHeads[0]] : [];
}

async function initialIssueAssignees(department, location) {
  if (department.assignmentStrategy === "station_manager") {
    const managerEmails = (location.managerEmails || [])
      .map((email) => String(email || "").trim())
      .filter(Boolean);
    if (!managerEmails.length && location.email) managerEmails.push(String(location.email).trim());
    if (managerEmails.length) {
      const users = await mongoose.connection.collection("users")
      .find({ email: { $in: managerEmails.map(escapedEmailRegex) }, is_active: true })
      .project({ _id: 1, email: 1, firstName: 1, lastName: 1 })
      .toArray();
      const byEmail = new Map(users.map((user) => [String(user.email || "").toLowerCase(), user]));
      const ordered = managerEmails
        .map((email) => byEmail.get(email.toLowerCase()))
        .filter(Boolean);
      if (ordered.length) return [...new Map(ordered.map((user) => [user._id.toString(), user])).values()];
    }
  }

  // department_head and operations_queue intentionally share the same fallback chain.
  return fallbackIssueAssignees(department);
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function issueEmailRecipients({ department, location, assigneeUsers }) {
  const [departmentUsers, adminHeads] = await Promise.all([
    activeUsersByIds([department.departmentHead]),
    activeAdminHeadUsers(),
  ]);
  const siteRule = (department.siteNotifications || []).find(
    (entry) => String(entry.site?._id || entry.site) === String(location._id)
  );
  const primary = assigneeUsers.map((user) => normalizeEmail(user.email)).find(Boolean) || "";
  const cc = new Set([
    ...assigneeUsers.slice(1).map((user) => normalizeEmail(user.email)),
    ...departmentUsers.map((user) => normalizeEmail(user.email)),
    ...adminHeads.map((user) => normalizeEmail(user.email)),
    ...(department.notificationEmails || []).map(normalizeEmail),
    ...(siteRule?.emails || []).map(normalizeEmail),
  ].filter(Boolean));
  cc.delete(primary);
  return { to: primary, cc: [...cc] };
}

async function queueIssueRaisedEmail({ issue, response, checklist, section, location, assigneeUsers, resolved, resolutionComment }) {
  const { to, cc } = await issueEmailRecipients({
    department: checklist.department,
    location,
    assigneeUsers,
  });
  if (!to) {
    console.warn(`No email recipient found for Station Audit issue ${issue._id}`);
    return false;
  }

  const siteName = location.site || location.stationName;
  const statusText = response.selectedStatus?.label || "No Status Selected";
  const commentText = response.comment || "No Comment Provided";
  const resolutionText = resolutionComment || "";
  const subject = resolved
    ? `✅ Issue Raised and Resolved for Site ${siteName}`
    : `⚠️ Issue Raised for Site ${siteName}`;
  const text = [
    resolved ? `An issue was raised and recorded as resolved for site ${siteName}.` : `An issue has been raised for site ${siteName}.`,
    `Section: ${section.name}`,
    `Checklist: ${checklist.item}`,
    `Category: ${checklist.category || "No Category"}`,
    `Status Selected: ${statusText}`,
    `Comment: ${commentText}`,
    ...(resolved ? [`Resolution: ${resolutionText}`] : []),
    "Please review the issue in the Hub under Station Audit Interface.",
  ].join("\n");
  const resolutionRow = resolved ? `
    <tr><td style="padding:8px;font-weight:bold;color:#555;">✅ Resolution:</td><td style="padding:8px;color:#222;">${escapeHtml(resolutionText)}</td></tr>` : "";
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background-color:#f7f9fc;padding:30px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 8px rgba(0,0,0,.08);overflow:hidden;">
        <div style="background:${resolved ? "#2e7d32" : "#d32f2f"};color:#fff;text-align:center;padding:16px 0;">
          <h1 style="margin:0;font-size:22px;">${resolved ? "✅ Issue Raised and Resolved" : "🚨 Issue Raised Alert"}</h1>
        </div>
        <div style="padding:24px 30px;">
          <p style="font-size:16px;color:#333;">${resolved ? "An issue was raised for record keeping and marked resolved." : "An issue has been raised for the following site:"}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <tr><td style="padding:8px;font-weight:bold;color:#555;">🏪 Site:</td><td style="padding:8px;color:#222;">${escapeHtml(siteName)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">📑 Section:</td><td style="padding:8px;color:#222;">${escapeHtml(section.name)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">🧾 Checklist:</td><td style="padding:8px;color:#222;">${escapeHtml(checklist.item)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">📂 Category:</td><td style="padding:8px;color:#222;">${escapeHtml(checklist.category || "No Category")}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">⚡ Status Selected:</td><td style="padding:8px;color:#222;">${escapeHtml(statusText)}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#555;">📝 Comment:</td><td style="padding:8px;color:#222;">${escapeHtml(commentText)}</td></tr>
            ${resolutionRow}
          </table>
          <div style="margin-top:24px;background:#fff3cd;border-left:6px solid #ffc107;padding:16px;border-radius:8px;">
            <p style="margin:0;color:#856404;font-size:15px;">Please review this issue in <strong>Hub → Station Audit Interface</strong>.</p>
          </div>
          <p style="color:#777;font-size:13px;margin-top:32px;text-align:center;">This is an automated message from the Gen7Fuel Hub Audit System.<br>Please do not reply to this email.</p>
        </div>
      </div>
    </div>`;

  await emailQueue.add("sendStationAuditIssueEmail", { to, cc, subject, text, html }, {
    jobId: `station-audit-issue-${issue._id}`,
  });
  return true;
}

async function ensureIssueForResponse({ response, run, checklist, section, location, userId }) {
  const assigneeUsers = await initialIssueAssignees(checklist.department, location);
  const previousIssue = await StationAuditIssue.findOne({
    checklist: checklist._id,
    site: location._id,
    response: { $ne: response._id },
  })
    .sort({ occurrenceNumber: -1, raisedAt: -1 })
    .select("_id occurrenceNumber")
    .lean();

  const issueInsert = {
    response: response._id,
    run: run._id,
    checklist: checklist._id,
    section: section._id,
    originDepartment: checklist.department._id,
    currentDepartment: checklist.department._id,
    site: location._id,
    snapshot: {
      sectionName: section.name,
      checklistItem: checklist.item,
      category: checklist.category || "",
      departmentName: checklist.department.name,
      statusKey: response.selectedStatus?.key || "",
      statusLabel: response.selectedStatus?.label || "",
      originalComment: response.comment || "",
      originalPhotos: response.photos || [],
    },
    status: "created",
    assignees: assigneeUsers.map((user, index) => ({
      user: user._id,
      role: index === 0 ? "owner" : "collaborator",
      assignedBy: null,
    })),
    previousIssue: previousIssue?._id || null,
    occurrenceNumber: (previousIssue?.occurrenceNumber || 0) + 1,
    raisedBy: userId,
  };

  let issue;
  try {
    issue = await StationAuditIssue.findOneAndUpdate(
      { response: response._id },
      { $setOnInsert: issueInsert },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    issue = await StationAuditIssue.findOne({ response: response._id });
  }

  const assigneeLabel = assigneeUsers
    .map((user) => `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email)
    .join(", ");
  const activityFilter = { dedupeKey: `issue-raised:${response._id}` };
  try {
    await StationAuditIssueActivity.findOneAndUpdate(
      activityFilter,
      {
        $setOnInsert: {
          issue: issue._id,
          eventType: "issue_raised",
          actor: userId,
          body: response.comment || "",
          photos: response.photos || [],
          changes: [
            {
              field: "status",
              to: { value: "created", label: "Created" },
            },
            {
              field: "department",
              to: { id: checklist.department._id, label: checklist.department.name },
            },
            ...(assigneeUsers.length
              ? [{ field: "assignees", to: { value: assigneeUsers.map((user) => user._id).join(","), label: assigneeLabel } }]
              : []),
          ],
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000 || !(await StationAuditIssueActivity.exists(activityFilter))) {
      throw error;
    }
  }

  return { issue, assigneeUsers };
}

// PUT /api/station-audits/checklists/:sectionId/responses/:checklistId
// Lazily creates the period run when the first checklist is completed and
// idempotently stores the response for that run/checklist pair.
router.put("/:sectionId/responses/:checklistId", async (req, res) => {
  try {
    const { sectionId, checklistId } = req.params;
    const { site, type = "store", date } = req.query;
    const input = normalizeResponseInput(req.body);

    if (input.error) return res.status(400).json({ error: input.error });
    if (!site) return res.status(400).json({ error: "Missing site" });
    if (!AUDIT_TYPES.includes(type)) return res.status(400).json({ error: "Invalid audit type" });
    if (!mongoose.isValidObjectId(sectionId) || !mongoose.isValidObjectId(checklistId)) {
      return res.status(400).json({ error: "Invalid section or checklist ID" });
    }

    const location = await resolveLocation(site);
    if (!location) return res.status(404).json({ error: "Site not found" });

    const periodKeys = periodKeysFor(location.timezone, date);
    if (!periodKeys) return res.status(400).json({ error: "Invalid date" });

    const [section, checklist] = await Promise.all([
      StationAuditSection.findOne({
        _id: sectionId,
        sites: location._id,
        active: true,
        ...(type === "visitor" ? { sectionType: "checklist" } : {}),
      }).select("name description sectionType"),
      StationAuditChecklist.findOne({
        _id: checklistId,
        section: sectionId,
        assignedSites: location._id,
        auditTypes: type,
        active: true,
      })
        .populate(
          "department",
          "name departmentHead members defaultIssueAssignees assignmentStrategy escalationDepartment notificationEmails siteNotifications"
        )
        .populate("statusOptionSet", "name options"),
    ]);

    if (!section || !checklist) {
      return res.status(404).json({ error: "Checklist not found or not assigned to this site" });
    }
    if (section.sectionType === "order") {
      // TODO: Apply the Station Audit order-section completion workflow here.
    }
    if (!checklist.department || !checklist.statusOptionSet) {
      return res.status(409).json({ error: "Checklist configuration is incomplete" });
    }

    const selectedOption = checklist.statusOptionSet?.options?.find(
      (option) => String(option._id) === input.statusOptionId
    );
    if (input.statusOptionId && !selectedOption) {
      return res.status(400).json({ error: "The selected status is not valid for this checklist" });
    }
    if (input.checked && !selectedOption) {
      return res.status(400).json({ error: "Select a valid status before completing this checklist" });
    }
    if (input.checked && checklist.commentRequired && !input.comment) {
      return res.status(400).json({ error: "A comment is required for this checklist" });
    }
    if (input.requestOrder && !checklist.requestOrderEnabled) {
      return res.status(400).json({ error: "Ordering is not enabled for this checklist" });
    }
    if (checklist.requestOrderEnabled && input.issueRaised) {
      return res.status(400).json({ error: "Order checklists cannot raise an audit issue" });
    }
    if (input.issueAlreadyResolved) {
      if (checklist.requestOrderEnabled || !checklist.followUp || !input.issueRaised) {
        return res.status(400).json({ error: "This checklist does not support resolved issue submission" });
      }
      if (!input.resolutionComment) {
        return res.status(400).json({ error: "Add a brief comment explaining how the issue was resolved" });
      }
    }

    const runFilter = {
      section: section._id,
      site: location._id,
      frequency: checklist.frequency,
      periodKey: periodKeys[checklist.frequency],
      type,
    };
    const userId = req.user._id;
    if (!input.checked) {
      return res.status(409).json({ error: "Completed checklist responses cannot be reopened" });
    }
    const run = input.checked
      ? await findOrCreateRun(runFilter, {
          ...runFilter,
          sectionSnapshot: {
            name: section.name,
            description: section.description || "",
          },
          startedBy: userId,
        })
      : await StationAuditRun.findOne(runFilter);

    if (!run) {
      return res.status(404).json({ error: "No active response exists for this checklist period" });
    }

    const existingResponse = await StationAuditResponse.findOne({
      run: run._id,
      checklist: checklist._id,
    })
      .lean();
    if (existingResponse?.checked === true) {
      return res.status(409).json({ error: "This checklist was already completed and cannot be updated" });
    }

    const now = new Date();
    let response = await StationAuditResponse.findOneAndUpdate(
      { run: run._id, checklist: checklist._id },
      {
        $set: {
          checklistSnapshot: {
            item: checklist.item,
            description: checklist.description || "",
            category: checklist.category || "",
            frequency: checklist.frequency,
            department: checklist.department._id,
            departmentName: checklist.department.name,
          },
          checked: input.checked,
          checkedAt: input.checked ? now : null,
          checkedBy: input.checked ? userId : null,
          selectedStatus: selectedOption
            ? {
                optionSet: checklist.statusOptionSet._id,
                optionId: selectedOption._id,
                key: selectedOption.key,
                label: selectedOption.label,
              }
            : { optionSet: null, optionId: null, key: "", label: "" },
          comment: input.comment,
          photos: input.photos,
          requestOrder: input.requestOrder,
          issueRaised: input.issueRaised,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    const existingIssue = await StationAuditIssue.findOne({ response: response._id })
      .select("_id")
      .lean();
    let issue = existingIssue;
    let issueAssigneeUsers = [];
    if (shouldCreateIssue(type, input)) {
      const issueResult = await ensureIssueForResponse({
        response,
        run,
        checklist,
        section,
        location,
        userId,
      });
      issue = issueResult.issue;
      issueAssigneeUsers = issueResult.assigneeUsers;
    }
    if (issue) {
      response = await StationAuditResponse.findByIdAndUpdate(
        response._id,
        { $set: { issueRaised: true, issue: issue._id } },
        { new: true, runValidators: true }
      ).lean();
    }

    if (issue && input.issueAlreadyResolved) {
      await StationAuditIssue.updateOne(
        { _id: issue._id },
        {
          $set: {
            status: "resolved",
            resolvedBy: userId,
            resolvedAt: now,
          },
        }
      );
      await StationAuditIssueActivity.findOneAndUpdate(
        { dedupeKey: `issue-resolved-on-submit:${response._id}` },
        {
          $setOnInsert: {
            issue: issue._id,
            eventType: "resolved",
            actor: userId,
            body: input.resolutionComment,
            photos: [],
            changes: [{
              field: "status",
              from: { value: "created", label: "Created" },
              to: { value: "resolved", label: "Resolved" },
            }],
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    if (issue && shouldCreateIssue(type, input)) {
      try {
        await queueIssueRaisedEmail({
          issue,
          response,
          checklist,
          section,
          location,
          assigneeUsers: issueAssigneeUsers,
          resolved: input.issueAlreadyResolved,
          resolutionComment: input.resolutionComment,
        });
      } catch (emailError) {
        console.error(`Failed to queue Station Audit issue email for ${issue._id}:`, emailError);
      }
    }

    const requiredChecklistIds = await StationAuditChecklist.find({
      section: section._id,
      assignedSites: location._id,
      auditTypes: type,
      frequency: checklist.frequency,
      active: true,
    }).distinct("_id");
    const completedCount = await StationAuditResponse.countDocuments({
      run: run._id,
      checklist: { $in: requiredChecklistIds },
      checked: true,
    });
    const runCompleted = requiredChecklistIds.length > 0 && completedCount === requiredChecklistIds.length;

    await StationAuditRun.updateOne(
      { _id: run._id },
      {
        $set: {
          state: runCompleted ? "completed" : "in_progress",
          completedAt: runCompleted ? now : null,
          completedBy: runCompleted ? userId : null,
        },
      }
    );

    let orderQueued = false;
    if (response.requestOrder === true) {
      const role = req.user?.role?.role_name || req.user?.role?._id || req.user?.role;
      await enqueueStationAuditOrder({
        responseId: response._id.toString(),
        siteName: location.site || location.stationName,
        locationId: location._id.toString(),
        actor: {
          userId: userId.toString(),
          username: req.user?.username || req.user?.email || req.user?.firstName,
          role: role ? String(role) : undefined,
        },
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      orderQueued = true;
    }

    await logChange(req, {
      action: existingResponse ? "update" : "create",
      resourceType: "station-audit-response",
      resourceId: response._id,
      resourceStore: "mongodb",
      success: true,
      statusCode: 200,
      before: existingResponse,
      after: {
        ...response,
        runState: runCompleted ? "completed" : "in_progress",
        runCompletedAt: runCompleted ? now : null,
        issue: issue?._id || response.issue || null,
        issueStatus: issue && input.issueAlreadyResolved ? "resolved" : issue ? "created" : null,
      },
      resourceLabel: checklist.item,
      message: `Completed Station Audit checklist "${checklist.item}" for ${location.site || location.stationName}`,
      source: "station-audit.checklists.responses",
    });

    return res.json({
      run: {
        _id: run._id,
        periodKey: run.periodKey,
        state: runCompleted ? "completed" : "in_progress",
        completedAt: runCompleted ? now : null,
      },
      response,
      issue: issue ? { _id: issue._id } : null,
      orderQueued,
      completed: response.checked === true,
      summary: {
        total: requiredChecklistIds.length,
        completed: completedCount,
        pending: requiredChecklistIds.length - completedCount,
      },
    });
  } catch (error) {
    console.error("Failed to save Station Audit response:", error);
    return res.status(500).json({ error: "Failed to save Station Audit response" });
  }
});

// GET /api/station-audits/checklists/:sectionId
// Returns definitions and response state for one selected section.
router.get("/:sectionId", async (req, res) => {
  try {
    const { site, frequency = "all", type = "store", date } = req.query;
    const { sectionId } = req.params;

    if (!site) return res.status(400).json({ error: "Missing site" });
    if (frequency !== "all" && !FREQUENCIES.includes(frequency)) {
      return res.status(400).json({ error: "Invalid frequency" });
    }
    if (!AUDIT_TYPES.includes(type)) {
      return res.status(400).json({ error: "Invalid audit type" });
    }
    if (!mongoose.isValidObjectId(sectionId)) {
      return res.status(400).json({ error: "Invalid section ID" });
    }

    const location = await resolveLocation(site);
    if (!location) return res.status(404).json({ error: "Site not found" });

    const periodKeys = periodKeysFor(location.timezone, date);
    if (!periodKeys) return res.status(400).json({ error: "Invalid date" });

    const sections = await StationAuditSection.find({
      _id: sectionId,
      sites: location._id,
      active: true,
      ...(type === "visitor" ? { sectionType: "checklist" } : {}),
    })
      .select("name description sortOrder sectionType")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    if (!sections.length) {
      return res.status(404).json({ error: "Section not found or not assigned to this site" });
    }

    const frequencies = frequency === "all" ? FREQUENCIES : [frequency];
    const sectionIds = sections.map((entry) => entry._id);

    const [checklists, runs] = await Promise.all([
      StationAuditChecklist.find({
        section: { $in: sectionIds },
        assignedSites: location._id,
        auditTypes: type,
        frequency: { $in: frequencies },
        active: true,
      })
        .select(
          "section item description sortOrder category frequency auditTypes department statusOptionSet followUp commentRequired requestOrderEnabled suppliesVendor"
        )
        .populate("department", "name departmentHead")
        .populate("statusOptionSet", "name options")
        .sort({ sortOrder: 1, item: 1 })
        .lean(),
      StationAuditRun.find({
        section: { $in: sectionIds },
        site: location._id,
        frequency: { $in: frequencies },
        type,
        $or: frequencies.map((entry) => ({
          frequency: entry,
          periodKey: periodKeys[entry],
        })),
      })
        .select("section frequency periodKey state completedAt")
        .lean(),
    ]);

    const runIds = runs.map((run) => run._id);
    checklists.sort((left, right) =>
      (FREQUENCY_ORDER.get(left.frequency) ?? Number.MAX_SAFE_INTEGER)
        - (FREQUENCY_ORDER.get(right.frequency) ?? Number.MAX_SAFE_INTEGER)
      || (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
      || left.item.localeCompare(right.item, undefined, { sensitivity: "base" })
    );
    const responses = runIds.length
      ? await StationAuditResponse.find({ run: { $in: runIds } })
          .select(
            "run checklist checked checkedAt checkedBy selectedStatus comment photos requestOrder orderCreated order issueRaised issue updatedAt"
          )
          .lean()
      : [];

    const runBySectionFrequency = new Map(
      runs.map((run) => [`${run.section}:${run.frequency}`, run])
    );
    const responseByRunChecklist = new Map(
      responses.map((response) => [`${response.run}:${response.checklist}`, response])
    );
    const checklistsBySection = new Map(sectionIds.map((id) => [id.toString(), []]));

    for (const checklist of checklists) {
      const run = runBySectionFrequency.get(`${checklist.section}:${checklist.frequency}`);
      const response = run
        ? responseByRunChecklist.get(`${run._id}:${checklist._id}`) || null
        : null;

      if (checklist.statusOptionSet?.options) {
        checklist.statusOptionSet.options.sort((left, right) =>
          left.label.localeCompare(right.label)
        );
      }

      checklistsBySection.get(checklist.section.toString()).push({
        ...checklist,
        run: run
          ? {
              _id: run._id,
              periodKey: run.periodKey,
              state: run.state,
              completedAt: run.completedAt,
            }
          : null,
        response,
        completed: response?.checked === true,
      });
    }

    const outputSections = sections.map((entry) => {
      const items = checklistsBySection.get(entry._id.toString()) || [];
      const completed = items.filter((item) => item.completed).length;
      return {
        ...entry,
        summary: { total: items.length, completed, pending: items.length - completed },
        checklists: items,
      };
    });

    const total = checklists.length;
    const completed = outputSections.reduce(
      (sum, entry) => sum + entry.summary.completed,
      0
    );

    return res.json({
      location: {
        _id: location._id,
        name: location.site || location.stationName,
        timezone: location.timezone,
      },
      type,
      frequency,
      periodKeys,
      summary: { total, completed, pending: total - completed },
      sections: outputSections,
    });
  } catch (error) {
    console.error("Failed to load Station Audit checklists:", error);
    return res.status(500).json({ error: "Failed to load Station Audit checklists" });
  }
});

module.exports = {
  router,
  periodKeyFor,
  periodKeysFor,
  resolveLocation,
  normalizeResponseInput,
  shouldCreateIssue,
  FREQUENCIES,
  AUDIT_TYPES,
};
