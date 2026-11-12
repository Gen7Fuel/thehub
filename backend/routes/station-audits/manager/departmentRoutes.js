const express = require("express");
const mongoose = require("mongoose");
const User = require("../../../models/User");
const Location = require("../../../models/Location");
const { StationAuditDepartment } = require("../../../models/station-audits");

const router = express.Router();
const GENERAL_EDIT_PERMISSION = "auditManager.department.edit";
const ADD_PERMISSION = "auditManager.department.add";
const STRATEGY_PERMISSION = `${GENERAL_EDIT_PERMISSION}.strategyAutomation`;
const STATUS_PERMISSION = `${GENERAL_EDIT_PERMISSION}.status`;
const ADMIN_DEPARTMENT_PERMISSION = `${GENERAL_EDIT_PERMISSION}.adminDepartment`;
const EDITABLE_FIELDS = new Set([
  "name", "description", "departmentHead", "members", "defaultIssueAssignees",
  "assignmentStrategy", "escalationDepartment", "notificationEmails",
  "siteNotifications", "active", "isAdminDepartment",
]);
const CREATE_FIELDS = [...EDITABLE_FIELDS].filter((field) => field !== "isAdminDepartment");

function membershipFilter(userId) {
  return { $or: [{ departmentHead: userId }, { "members.user": userId }] };
}

function requiredPermission(field) {
  if (field === "assignmentStrategy") return STRATEGY_PERMISSION;
  if (field === "active") return STATUS_PERMISSION;
  if (field === "isAdminDepartment") return ADMIN_DEPARTMENT_PERMISSION;
  return GENERAL_EDIT_PERMISSION;
}

function normalizeId(value, label, nullable = false) {
  if (nullable && (value === null || value === "")) return { value: null };
  if (!mongoose.isValidObjectId(value)) return { error: `${label} must be a valid user or department ID` };
  return { value: new mongoose.Types.ObjectId(value) };
}

function normalizeIdArray(value, label) {
  if (!Array.isArray(value)) return { error: `${label} must be an array` };
  const ids = [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return { error: `${label} contains an invalid ID` };
  return { value: ids.map((id) => new mongoose.Types.ObjectId(id)) };
}

function normalizeEmails(value, label) {
  if (!Array.isArray(value)) return { error: `${label} must be an array` };
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = [...new Set(value.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))];
  if (emails.some((email) => !emailPattern.test(email))) return { error: `${label} contains an invalid email` };
  return { value: emails };
}

function normalizeDepartmentUpdate(body = {}) {
  const fields = Object.keys(body).filter((field) => body[field] !== undefined);
  if (fields.length !== 1 || !EDITABLE_FIELDS.has(fields[0])) {
    return { error: "Update exactly one supported department field at a time" };
  }
  const field = fields[0];
  const rawValue = body[field];
  if (field === "name") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    return !value || value.length > 200 ? { error: "Department name is required and cannot exceed 200 characters" } : { field, value };
  }
  if (field === "description") {
    return typeof rawValue !== "string" || rawValue.length > 2000
      ? { error: "Description must be text with at most 2000 characters" }
      : { field, value: rawValue.trim() };
  }
  if (field === "departmentHead") {
    const normalized = normalizeId(rawValue, "Department head", true);
    return normalized.error ? normalized : { field, value: normalized.value };
  }
  if (field === "members" || field === "defaultIssueAssignees") {
    const normalized = normalizeIdArray(rawValue, field === "members" ? "Members" : "Default assignees");
    if (normalized.error) return normalized;
    return {
      field,
      value: field === "members"
        ? normalized.value.map((user) => ({ user }))
        : normalized.value,
    };
  }
  if (field === "assignmentStrategy") {
    return ["department_head", "station_manager", "operations_queue"].includes(rawValue)
      ? { field, value: rawValue }
      : { error: "Invalid assignment strategy" };
  }
  if (field === "escalationDepartment") {
    const normalized = normalizeId(rawValue, "Escalation department", true);
    return normalized.error ? normalized : { field, value: normalized.value };
  }
  if (field === "notificationEmails") {
    const normalized = normalizeEmails(rawValue, "Notification emails");
    return normalized.error ? normalized : { field, value: normalized.value };
  }
  if (field === "siteNotifications") {
    if (!Array.isArray(rawValue)) return { error: "Site notifications must be an array" };
    const seenSites = new Set();
    const entries = [];
    for (const entry of rawValue) {
      const site = normalizeId(entry?.site, "Notification site");
      const emails = normalizeEmails(entry?.emails, "Site notification emails");
      if (site.error || emails.error) return { error: site.error || emails.error };
      const key = site.value.toString();
      if (seenSites.has(key)) return { error: "A site can only have one notification override" };
      seenSites.add(key);
      if (emails.value.length) entries.push({ site: site.value, emails: emails.value });
    }
    return { field, value: entries };
  }
  if (field === "active" || field === "isAdminDepartment") {
    const label = field === "active" ? "Active" : "Admin department";
    return typeof rawValue === "boolean" ? { field, value: rawValue } : { error: `${label} must be true or false` };
  }
  return { error: "Unsupported department field" };
}

function normalizeDepartmentCreate(body = {}) {
  const fields = CREATE_FIELDS;
  const value = {};
  for (const field of fields) {
    if (body[field] === undefined) return { error: `${field} is required` };
    const normalized = normalizeDepartmentUpdate({ [field]: body[field] });
    if (normalized.error) return normalized;
    value[field] = normalized.value;
  }
  return { value };
}

async function hasGlobalAccess(userId) {
  return Boolean(await StationAuditDepartment.exists({
    isAdminDepartment: true,
    active: true,
    ...membershipFilter(userId),
  }));
}

async function canEditDepartment(userId, department) {
  return department.departmentHead?.toString() === userId.toString() || hasGlobalAccess(userId);
}

function populateDepartment(query) {
  return query
    .populate("departmentHead", "firstName lastName email is_active role")
    .populate("members.user", "firstName lastName email is_active role")
    .populate("members.addedBy", "firstName lastName email")
    .populate("defaultIssueAssignees", "firstName lastName email is_active role")
    .populate("siteNotifications.site", "stationName site")
    .populate("escalationDepartment", "name active");
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const globalAccess = await hasGlobalAccess(userId);
    const query = globalAccess ? {} : membershipFilter(userId);
    const departments = await populateDepartment(
      StationAuditDepartment.find(query).sort({ active: -1, name: 1 })
    ).lean();
    return res.json({
      departments: departments.map((department) => ({
        ...department,
        members: department.members || [],
        memberCount: (department.members || []).length,
        defaultIssueAssignees: department.defaultIssueAssignees || [],
        notificationEmails: department.notificationEmails || [],
        siteNotifications: department.siteNotifications || [],
        accessScope: globalAccess ? "admin" : "member",
      })),
    });
  } catch (error) {
    console.error("Failed to load Station Audit departments for management:", error);
    return res.status(500).json({ error: "Failed to load Station Audit departments" });
  }
});

router.get("/options", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const globalAccess = await hasGlobalAccess(userId);
    if (req.header("X-Required-Permission") === ADD_PERMISSION && !globalAccess) {
      return res.status(403).json({ error: "Only an audit administrator can load department creation options" });
    }
    const departmentQuery = globalAccess ? { active: true } : { active: true, ...membershipFilter(userId) };
    const [users, sites, departments] = await Promise.all([
      User.find({ is_active: true })
        .select("firstName lastName email role is_active")
        .populate("role", "role_name")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      Location.find({ type: "store" }).select("stationName site").sort({ stationName: 1 }).lean(),
      StationAuditDepartment.find(departmentQuery).select("name active").sort({ name: 1 }).lean(),
    ]);
    return res.json({ users, sites, departments });
  } catch (error) {
    console.error("Failed to load Station Audit department options:", error);
    return res.status(500).json({ error: "Failed to load department options" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    if (req.header("X-Required-Permission") !== ADD_PERMISSION) {
      return res.status(403).json({ error: "The department add permission was not supplied" });
    }
    if (!await hasGlobalAccess(userId)) {
      return res.status(403).json({ error: "Only an audit administrator can create departments" });
    }
    const normalized = normalizeDepartmentCreate(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const value = normalized.value;

    const userIds = [
      ...(value.departmentHead ? [value.departmentHead] : []),
      ...value.members.map((entry) => entry.user),
      ...value.defaultIssueAssignees,
    ];
    const uniqueUserIds = [...new Map(userIds.map((id) => [id.toString(), id])).values()];
    if (await User.countDocuments({ _id: { $in: uniqueUserIds }, is_active: true }) !== uniqueUserIds.length) {
      return res.status(400).json({ error: "Every selected user must be active" });
    }
    if (value.escalationDepartment && !await StationAuditDepartment.exists({ _id: value.escalationDepartment, active: true })) {
      return res.status(400).json({ error: "Escalation department must be active" });
    }
    const siteIds = value.siteNotifications.map((entry) => entry.site);
    if (await Location.countDocuments({ _id: { $in: siteIds }, type: "store" }) !== siteIds.length) {
      return res.status(400).json({ error: "Every notification override must reference a store" });
    }

    value.members = value.members.map((entry) => ({ ...entry, addedBy: userId, addedAt: new Date() }));
    const created = await StationAuditDepartment.create({
      ...value,
      isAdminDepartment: false,
      createdBy: userId,
    });
    const department = await populateDepartment(StationAuditDepartment.findById(created._id)).lean();
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "create",
      resourceType: "station-audit-department",
      resourceId: created._id,
      success: true,
      statusCode: 201,
      after: created.toObject(),
      resourceLabel: created.name,
      source: "station-audit.manager.departments",
      diffOptions: { redactedTerms: ["email"] },
    });
    return res.status(201).json({
      department: {
        ...department,
        members: department.members || [],
        memberCount: (department.members || []).length,
        defaultIssueAssignees: department.defaultIssueAssignees || [],
        notificationEmails: department.notificationEmails || [],
        siteNotifications: department.siteNotifications || [],
        accessScope: "admin",
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyPattern?.name || error?.keyValue?.name) {
        return res.status(409).json({ error: "A department with this name already exists" });
      }
      if (error?.keyPattern?.legacySelectOptionText || error?.keyValue?.legacySelectOptionText !== undefined) {
        return res.status(409).json({ error: "This department conflicts with an existing legacy department mapping" });
      }
      console.error("Duplicate key while creating Station Audit department:", error);
      return res.status(409).json({ error: "A department with this configuration already exists" });
    }
    console.error("Failed to create Station Audit department:", error);
    return res.status(500).json({ error: "Failed to create Station Audit department" });
  }
});

router.put("/:departmentId", async (req, res) => {
  try {
    const { departmentId } = req.params;
    const userId = req.user?._id;
    if (!userId || !mongoose.isValidObjectId(departmentId)) return res.status(400).json({ error: "Invalid department request" });
    const update = normalizeDepartmentUpdate(req.body);
    if (update.error) return res.status(400).json({ error: update.error });
    const before = await StationAuditDepartment.findById(departmentId).lean();
    if (!before) return res.status(404).json({ error: "Department not found" });
    const expectedPermission = before.isAdminDepartment || update.field === "isAdminDepartment"
      ? ADMIN_DEPARTMENT_PERMISSION
      : requiredPermission(update.field);
    if (req.header("X-Required-Permission") !== expectedPermission) {
      return res.status(403).json({ error: "The required field-level permission was not supplied" });
    }
    if (!await canEditDepartment(userId, before)) return res.status(403).json({ error: "Only this department's head or an audit administrator can edit it" });

    if (update.field === "departmentHead" && update.value) {
      if (!await User.exists({ _id: update.value, is_active: true })) return res.status(400).json({ error: "Department head must be an active user" });
    }
    if (update.field === "members" || update.field === "defaultIssueAssignees") {
      const ids = update.field === "members" ? update.value.map((entry) => entry.user) : update.value;
      if (await User.countDocuments({ _id: { $in: ids }, is_active: true }) !== ids.length) return res.status(400).json({ error: "Every selected user must be active" });
      if (update.field === "members") {
        update.value = update.value.map((entry) => ({ ...entry, addedBy: userId, addedAt: new Date() }));
      }
    }
    if (update.field === "escalationDepartment" && update.value) {
      if (update.value.toString() === departmentId) return res.status(400).json({ error: "A department cannot escalate to itself" });
      if (!await StationAuditDepartment.exists({ _id: update.value, active: true })) return res.status(400).json({ error: "Escalation department must be active" });
    }
    if (update.field === "siteNotifications") {
      const siteIds = update.value.map((entry) => entry.site);
      if (await Location.countDocuments({ _id: { $in: siteIds }, type: "store" }) !== siteIds.length) return res.status(400).json({ error: "Every notification override must reference a store" });
    }

    await StationAuditDepartment.updateOne(
      { _id: departmentId },
      { $set: { [update.field]: update.value } },
      { runValidators: true }
    );
    const after = await StationAuditDepartment.findById(departmentId).lean();
    const department = await populateDepartment(StationAuditDepartment.findById(departmentId)).lean();
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "update",
      resourceType: "station-audit-department",
      resourceId: departmentId,
      success: true,
      statusCode: 200,
      before,
      after,
      resourceLabel: department.name,
      source: "station-audit.manager.departments",
      diffOptions: { redactedTerms: ["email"] },
    });
    return res.json({
      department: {
        ...department,
        members: department.members || [],
        memberCount: (department.members || []).length,
        defaultIssueAssignees: department.defaultIssueAssignees || [],
        notificationEmails: department.notificationEmails || [],
        siteNotifications: department.siteNotifications || [],
        accessScope: await hasGlobalAccess(userId) ? "admin" : "member",
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyPattern?.name || error?.keyValue?.name) {
        return res.status(409).json({ error: "A department with this name already exists" });
      }
      console.error("Duplicate key while updating Station Audit department:", error);
      return res.status(409).json({ error: "A department with this configuration already exists" });
    }
    console.error("Failed to update Station Audit department:", error);
    return res.status(500).json({ error: "Failed to update Station Audit department" });
  }
});

module.exports = { router, membershipFilter, normalizeDepartmentUpdate, normalizeDepartmentCreate, requiredPermission };
