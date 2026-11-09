const express = require("express");
const mongoose = require("mongoose");
const {
  StationAuditStatusOptionSet,
  StationAuditChecklist,
} = require("../../../models/station-audits");

const router = express.Router();
const EDIT_PERMISSION = "auditManager.statusOptions.edit";
const STATUS_UPDATE_PERMISSION = `${EDIT_PERMISSION}.statusUpdate`;
const ADD_PERMISSION = "auditManager.statusOptions.add";
const EDITABLE_FIELDS = new Set(["name", "description", "options", "active"]);

function normalizeOptions(value) {
  if (!Array.isArray(value) || value.length === 0) return { error: "At least one status option is required" };
  const usedKeys = new Set();
  const options = value.map((entry, sortOrder) => {
    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `option-${sortOrder + 1}`;
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${base}-${suffix++}`;
    usedKeys.add(key);
    return { key, label, sortOrder };
  });
  if (options.some((option) => !option.label)) return { error: "Every status option requires a label" };
  if (options.some((option) => option.label.length > 200)) return { error: "Status option label is too long" };
  return { value: options };
}

function normalizeStatusOptionUpdate(body = {}) {
  const fields = Object.keys(body).filter((field) => body[field] !== undefined);
  if (fields.length !== 1 || !EDITABLE_FIELDS.has(fields[0])) return { error: "Update exactly one supported status-option field at a time" };
  const field = fields[0];
  const rawValue = body[field];
  if (field === "name") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    return !value || value.length > 200 ? { error: "Status-option name is required and cannot exceed 200 characters" } : { field, value };
  }
  if (field === "description") {
    return typeof rawValue !== "string" || rawValue.length > 2000 ? { error: "Description must be text with at most 2000 characters" } : { field, value: rawValue.trim() };
  }
  if (field === "options") {
    const normalized = normalizeOptions(rawValue);
    return normalized.error ? normalized : { field, value: normalized.value };
  }
  return typeof rawValue === "boolean" ? { field, value: rawValue } : { error: "Active must be true or false" };
}

function normalizeStatusOptionCreate(body = {}) {
  const value = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) return { error: `${field} is required` };
    const normalized = normalizeStatusOptionUpdate({ [field]: body[field] });
    if (normalized.error) return normalized;
    value[field] = normalized.value;
  }
  return { value };
}

function requiredPermission(field) {
  return field === "active" ? STATUS_UPDATE_PERMISSION : EDIT_PERMISSION;
}

router.get("/", async (_req, res) => {
  try {
    const [sets, usageCounts] = await Promise.all([
      StationAuditStatusOptionSet.find({}).sort({ active: -1, name: 1 }).lean(),
      StationAuditChecklist.aggregate([
        { $group: { _id: "$statusOptionSet", checklistCount: { $sum: 1 }, activeChecklistCount: { $sum: { $cond: ["$active", 1, 0] } } } },
      ]),
    ]);
    const counts = new Map(usageCounts.map((entry) => [entry._id?.toString(), entry]));
    return res.json({
      statusOptionSets: sets.map((set) => ({
        ...set,
        options: [...(set.options || [])].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)),
        checklistCount: counts.get(set._id.toString())?.checklistCount || 0,
        activeChecklistCount: counts.get(set._id.toString())?.activeChecklistCount || 0,
      })),
    });
  } catch (error) {
    console.error("Failed to load Station Audit status options:", error);
    return res.status(500).json({ error: "Failed to load status options" });
  }
});

router.get("/:statusOptionSetId/usage", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.statusOptionSetId)) return res.status(400).json({ error: "Invalid status-option set ID" });
    const checklists = await StationAuditChecklist.find({ statusOptionSet: req.params.statusOptionSetId })
      .select("item description active section")
      .populate("section", "name active")
      .sort({ item: 1 })
      .lean();
    return res.json({ checklists });
  } catch (error) {
    console.error("Failed to load status-option usage:", error);
    return res.status(500).json({ error: "Failed to load status-option usage" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_PERMISSION) return res.status(403).json({ error: "The status-options add permission was not supplied" });
    const normalized = normalizeStatusOptionCreate(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const created = await StationAuditStatusOptionSet.create({ ...normalized.value, createdBy: req.user._id });
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, { action: "create", resourceType: "station-audit-status-option-set", resourceId: created._id, success: true, statusCode: 201, after: created.toObject(), resourceLabel: created.name, source: "station-audit.manager.status-options" });
    return res.status(201).json({ statusOptionSet: { ...created.toObject(), checklistCount: 0, activeChecklistCount: 0 } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: "A status-option set with this name already exists" });
    console.error("Failed to create Station Audit status options:", error);
    return res.status(500).json({ error: "Failed to create status options" });
  }
});

router.put("/:statusOptionSetId", async (req, res) => {
  try {
    const { statusOptionSetId } = req.params;
    if (!mongoose.isValidObjectId(statusOptionSetId)) return res.status(400).json({ error: "Invalid status-option set ID" });
    const update = normalizeStatusOptionUpdate(req.body);
    if (update.error) return res.status(400).json({ error: update.error });
    if (req.header("X-Required-Permission") !== requiredPermission(update.field)) return res.status(403).json({ error: "The required status-option field permission was not supplied" });
    const before = await StationAuditStatusOptionSet.findById(statusOptionSetId).lean();
    if (!before) return res.status(404).json({ error: "Status-option set not found" });
    const updated = await StationAuditStatusOptionSet.findByIdAndUpdate(statusOptionSetId, { $set: { [update.field]: update.value } }, { new: true, runValidators: true }).lean();
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, { action: "update", resourceType: "station-audit-status-option-set", resourceId: statusOptionSetId, success: true, statusCode: 200, before, after: updated, resourceLabel: updated.name, source: "station-audit.manager.status-options" });
    const [checklistCount, activeChecklistCount] = await Promise.all([
      StationAuditChecklist.countDocuments({ statusOptionSet: statusOptionSetId }),
      StationAuditChecklist.countDocuments({ statusOptionSet: statusOptionSetId, active: true }),
    ]);
    return res.json({ statusOptionSet: { ...updated, checklistCount, activeChecklistCount } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: "A status-option set with this name already exists" });
    console.error("Failed to update Station Audit status options:", error);
    return res.status(500).json({ error: "Failed to update status options" });
  }
});

module.exports = { router, normalizeOptions, normalizeStatusOptionUpdate, normalizeStatusOptionCreate, requiredPermission };
