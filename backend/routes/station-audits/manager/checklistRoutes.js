const express = require("express");
const mongoose = require("mongoose");
const Vendor = require("../../../models/Vendor");
const {
  StationAuditDepartment,
  StationAuditSection,
  StationAuditChecklist,
  StationAuditStatusOptionSet,
} = require("../../../models/station-audits");
const { normalizeOptions } = require("./statusOptionRoutes");

const router = express.Router();
const EDIT_PERMISSION = "auditManager.checklist.edit";
const ADD_PERMISSION = "auditManager.checklist.add";
const ACTIVE_STATUS_PERMISSION = "auditManager.checklist.edit.updateActiveStatus";
const EDITABLE_FIELDS = new Set([
  "item",
  "description",
  "category",
  "frequency",
  "auditTypes",
  "department",
  "statusOptionSet",
  "followUp",
  "commentRequired",
  "assignedSites",
  "orderConfiguration",
  "active",
]);

function requiredChecklistPermission(field) {
  return field === "active" ? ACTIVE_STATUS_PERMISSION : EDIT_PERMISSION;
}

function normalizeIdArray(value, label) {
  if (!Array.isArray(value)) return { error: `${label} must be an array` };
  const ids = [
    ...new Set(
      value.map((entry) => String(entry || "").trim()).filter(Boolean),
    ),
  ];
  if (ids.some((id) => !mongoose.isValidObjectId(id)))
    return { error: `${label} contains an invalid ID` };
  return { value: ids.map((id) => new mongoose.Types.ObjectId(id)) };
}

function normalizeChecklistUpdate(body = {}) {
  const fields = Object.keys(body).filter((field) => body[field] !== undefined);
  if (fields.length !== 1 || !EDITABLE_FIELDS.has(fields[0]))
    return { error: "Update exactly one supported checklist field at a time" };
  const field = fields[0];
  const rawValue = body[field];
  if (
    ["item", "description", "category"].includes(field)
  ) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (field === "item" && !value)
      return { error: "Checklist name is required" };
    if (value.length > 2000)
      return { error: `${field} is too long` };
    return { field, value };
  }
  if (field === "frequency")
    return ["daily", "weekly", "monthly"].includes(rawValue)
      ? { field, value: rawValue }
      : { error: "Invalid frequency" };
  if (field === "auditTypes") {
    const values = Array.isArray(rawValue) ? [...new Set(rawValue)] : [];
    return values.length &&
      values.every((value) => ["store", "visitor"].includes(value))
      ? { field, value: values }
      : { error: "Select store, visitor, or both" };
  }
  if (field === "department" || field === "statusOptionSet") {
    return mongoose.isValidObjectId(rawValue)
      ? { field, value: new mongoose.Types.ObjectId(rawValue) }
      : { error: `Invalid ${field} ID` };
  }
  if (field === "assignedSites") {
    const normalized = normalizeIdArray(rawValue, "Assigned sites");
    return normalized.error ? normalized : { field, value: normalized.value };
  }
  if (field === "followUp" || field === "commentRequired" || field === "active")
    return typeof rawValue === "boolean"
      ? { field, value: rawValue }
      : { error: `${field} must be true or false` };
  if (field === "orderConfiguration") {
    if (!rawValue || typeof rawValue.enabled !== "boolean")
      return { error: "Invalid order configuration" };
    const vendor =
      typeof rawValue.vendor === "string" ? rawValue.vendor.trim() : "";
    if (rawValue.enabled && !vendor)
      return {
        error: "A station-supplies vendor is required when ordering is enabled",
      };
    return {
      field,
      value: {
        requestOrderEnabled: rawValue.enabled,
        suppliesVendor: rawValue.enabled ? vendor : "",
      },
    };
  }
  return { error: "Unsupported checklist field" };
}

function normalizeChecklistCreate(body = {}) {
  const defaults = {
    description: "",
    category: "",
    frequency: "daily",
    auditTypes: ["store", "visitor"],
    followUp: false,
    commentRequired: false,
    assignedSites: [],
    orderConfiguration: { enabled: false, vendor: "" },
    active: true,
  };
  const fields = [
    "item", "description", "category", "frequency", "auditTypes",
    "department", "statusOptionSet", "followUp", "commentRequired",
    "assignedSites", "orderConfiguration", "active",
  ];
  const value = {};
  for (const field of fields) {
    const rawValue = body[field] === undefined ? defaults[field] : body[field];
    const normalized = normalizeChecklistUpdate({ [field]: rawValue });
    if (normalized.error) return { error: normalized.error };
    if (field === "orderConfiguration") Object.assign(value, normalized.value);
    else value[field] = normalized.value;
  }
  return { value };
}

function normalizeChecklistOrder(body = {}) {
  if (!["daily", "weekly", "monthly"].includes(body.frequency))
    return { error: "A valid checklist frequency is required" };
  if (!Array.isArray(body.checklistIds))
    return {
      error: "checklistIds must contain the complete active checklist order",
    };
  const checklistIds = body.checklistIds.map((id) => String(id || "").trim());
  if (checklistIds.some((id) => !mongoose.isValidObjectId(id)))
    return { error: "checklistIds contains an invalid ID" };
  if (new Set(checklistIds).size !== checklistIds.length)
    return { error: "checklistIds cannot contain duplicates" };
  return { checklistIds, frequency: body.frequency };
}

async function populatedChecklist(checklistId) {
  const checklist = await StationAuditChecklist.findById(checklistId)
    .populate("department", "name active")
    .populate("statusOptionSet", "name description options active")
    .populate("assignedSites", "stationName site")
    .lean();
  if (checklist?.statusOptionSet)
    checklist.statusOptionSet.options = [
      ...(checklist.statusOptionSet.options || []),
    ].sort((a, b) => a.sortOrder - b.sortOrder);
  return checklist;
}

async function departmentIdsForUser(userId) {
  return StationAuditDepartment.find({
    $or: [{ departmentHead: userId }, { "members.user": userId }],
  }).distinct("_id");
}

async function accessibleSection(sectionId, userId) {
  const departmentIds = await departmentIdsForUser(userId);
  if (!departmentIds.length) return null;
  return StationAuditSection.findOne({
    _id: sectionId,
    departments: { $in: departmentIds },
  })
    .populate("sites", "stationName site")
    .populate("departments", "name active")
    .lean();
}

// GET /api/station-audits/manager/checklists/sections
router.get("/sections", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ error: "Authenticated user is required" });
    const departmentIds = await departmentIdsForUser(userId);
    if (!departmentIds.length) return res.json({ sections: [] });

    const sections = await StationAuditSection.find({
      departments: { $in: departmentIds },
    })
      .populate("sites", "stationName site")
      .populate("departments", "name active")
      .sort({ active: -1, sortOrder: 1, name: 1 })
      .lean();
    const sectionIds = sections.map((section) => section._id);
    const counts = sectionIds.length
      ? await StationAuditChecklist.aggregate([
          { $match: { section: { $in: sectionIds } } },
          {
            $group: {
              _id: "$section",
              total: { $sum: 1 },
              active: { $sum: { $cond: ["$active", 1, 0] } },
            },
          },
        ])
      : [];
    const countsBySection = new Map(
      counts.map((entry) => [entry._id.toString(), entry]),
    );
    return res.json({
      sections: sections.map((section) => ({
        ...section,
        sites: section.sites || [],
        departments: section.departments || [],
        checklistCount: countsBySection.get(section._id.toString())?.total || 0,
        activeChecklistCount:
          countsBySection.get(section._id.toString())?.active || 0,
      })),
    });
  } catch (error) {
    console.error("Failed to load accessible checklist sections:", error);
    return res.status(500).json({ error: "Failed to load checklist sections" });
  }
});

// GET /api/station-audits/manager/checklists/sections/:sectionId
router.get("/sections/:sectionId", async (req, res) => {
  try {
    const userId = req.user?._id;
    const { sectionId } = req.params;
    if (!userId || !mongoose.isValidObjectId(sectionId))
      return res.status(400).json({ error: "Invalid section request" });
    const section = await accessibleSection(sectionId, userId);
    if (!section)
      return res
        .status(404)
        .json({ error: "Section not found or unavailable to this user" });

    const checklists = await StationAuditChecklist.find({ section: sectionId })
      .populate("department", "name active")
      .populate("statusOptionSet", "name description options active")
      .populate("assignedSites", "stationName site")
      .sort({ active: -1, sortOrder: 1, item: 1 })
      .lean();
    return res.json({
      section: {
        ...section,
        checklistCount: checklists.length,
        activeChecklistCount: checklists.filter((checklist) => checklist.active)
          .length,
      },
      checklists: checklists.map((checklist) => ({
        ...checklist,
        assignedSites: checklist.assignedSites || [],
        statusOptionSet: checklist.statusOptionSet
          ? {
              ...checklist.statusOptionSet,
              options: [...(checklist.statusOptionSet.options || [])].sort(
                (left, right) =>
                  left.sortOrder - right.sortOrder ||
                  left.label.localeCompare(right.label),
              ),
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Failed to load checklist section metadata:", error);
    return res.status(500).json({ error: "Failed to load checklist metadata" });
  }
});

router.get("/sections/:sectionId/options", async (req, res) => {
  try {
    const userId = req.user?._id;
    const { sectionId } = req.params;
    if (!userId || !mongoose.isValidObjectId(sectionId))
      return res.status(400).json({ error: "Invalid section request" });
    const section = await accessibleSection(sectionId, userId);
    if (!section)
      return res
        .status(404)
        .json({ error: "Section not found or unavailable to this user" });
    const departmentIds = (section.departments || []).map((department) => department._id);
    const [statusOptionSets, usageCounts, categories, vendors, departments] =
      await Promise.all([
        StationAuditStatusOptionSet.find({ active: true })
          .select("name description options active")
          .sort({ name: 1 })
          .lean(),
        StationAuditChecklist.aggregate([
          { $group: { _id: "$statusOptionSet", checklistCount: { $sum: 1 } } },
        ]),
        StationAuditChecklist.distinct("category", {
          category: { $nin: [null, ""] },
        }),
        Vendor.distinct("name", {
          category: { $regex: /^station supplies$/i },
        }),
        StationAuditDepartment.find({ _id: { $in: departmentIds }, active: true })
          .select("name active departmentHead defaultIssueAssignees")
          .populate("departmentHead", "firstName lastName email")
          .populate("defaultIssueAssignees", "firstName lastName email")
          .sort({ name: 1 })
          .lean(),
      ]);
    const usage = new Map(
      usageCounts.map((entry) => [entry._id?.toString(), entry.checklistCount]),
    );
    return res.json({
      sites: section.sites || [],
      departments,
      statusOptionSets: statusOptionSets.map((set) => ({
        ...set,
        options: [...(set.options || [])].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
        checklistCount: usage.get(set._id.toString()) || 0,
      })),
      categories: categories.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
      vendors: vendors.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    });
  } catch (error) {
    console.error("Failed to load checklist edit options:", error);
    return res
      .status(500)
      .json({ error: "Failed to load checklist edit options" });
  }
});

router.post("/sections/:sectionId/checklists", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_PERMISSION)
      return res.status(403).json({ error: "Checklist add permission was not supplied" });
    const userId = req.user?._id;
    const { sectionId } = req.params;
    if (!userId || !mongoose.isValidObjectId(sectionId))
      return res.status(400).json({ error: "Invalid section request" });
    const section = await accessibleSection(sectionId, userId);
    if (!section)
      return res.status(404).json({ error: "Section not found or unavailable to this user" });
    const normalized = normalizeChecklistCreate(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const value = normalized.value;

    const allowedSites = new Set((section.sites || []).map((site) => site._id.toString()));
    if (value.assignedSites.some((site) => !allowedSites.has(site.toString())))
      return res.status(400).json({ error: "Checklist sites must belong to the section" });
    const allowedDepartments = new Set((section.departments || []).map((department) => department._id.toString()));
    if (!allowedDepartments.has(value.department.toString()))
      return res.status(400).json({ error: "Checklist department must belong to the section" });
    if (!await StationAuditStatusOptionSet.exists({ _id: value.statusOptionSet, active: true }))
      return res.status(400).json({ error: "Status-option set must be active" });
    if (value.requestOrderEnabled) {
      if (section.sectionType !== "order")
        return res.status(400).json({ error: "Order configuration is only available for Order sections" });
      if (!await Vendor.exists({ name: value.suppliesVendor, category: { $regex: /^station supplies$/i } }))
        return res.status(400).json({ error: "Select a valid station-supplies vendor" });
    }

    let sortOrder = null;
    if (value.active) {
      const last = await StationAuditChecklist.findOne({
        section: sectionId,
        frequency: value.frequency,
        active: true,
      })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
      sortOrder = (last?.sortOrder ?? -1) + 1;
    }
    const created = await StationAuditChecklist.create({
      ...value,
      section: sectionId,
      sortOrder,
      createdBy: userId,
    });
    const checklist = await populatedChecklist(created._id);
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "create",
      resourceType: "station-audit-checklist",
      resourceId: created._id,
      success: true,
      statusCode: 201,
      after: created.toObject(),
      resourceLabel: created.item,
      source: "station-audit.manager.checklists",
    });
    return res.status(201).json({ checklist });
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyPattern?.legacyTemplateId || error?.keyPattern?.legacyItemId) {
        return res.status(409).json({ error: "This checklist conflicts with an existing legacy checklist mapping" });
      }
      console.error("Duplicate key while creating checklist metadata:", error);
      return res.status(409).json({ error: "A checklist with this configuration already exists" });
    }
    console.error("Failed to create checklist metadata:", error);
    return res.status(500).json({ error: "Failed to create checklist metadata" });
  }
});

router.post("/sections/:sectionId/status-options", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_PERMISSION)
      return res.status(403).json({ error: "Checklist add permission was not supplied" });
    const userId = req.user?._id;
    const { sectionId } = req.params;
    if (!userId || !mongoose.isValidObjectId(sectionId))
      return res.status(400).json({ error: "Invalid section request" });
    if (!await accessibleSection(sectionId, userId))
      return res.status(404).json({ error: "Section not found or unavailable to this user" });
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const options = normalizeOptions(req.body.options);
    if (!name || name.length > 200)
      return res.status(400).json({ error: "Status-option name is required" });
    if (description.length > 2000)
      return res.status(400).json({ error: "Description is too long" });
    if (options.error) return res.status(400).json({ error: options.error });
    const created = await StationAuditStatusOptionSet.create({
      name,
      description,
      options: options.value,
      active: true,
      createdBy: userId,
    });
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "create",
      resourceType: "station-audit-status-option-set",
      resourceId: created._id,
      success: true,
      statusCode: 201,
      after: created.toObject(),
      resourceLabel: created.name,
      source: "station-audit.manager.checklists",
    });
    return res.status(201).json({
      statusOptionSet: { ...created.toObject(), checklistCount: 0 },
    });
  } catch (error) {
    if (error?.code === 11000)
      return res.status(409).json({ error: "A status-option set with this name already exists" });
    console.error("Failed to create checklist status options:", error);
    return res.status(500).json({ error: "Failed to create status options" });
  }
});

router.put("/sections/:sectionId/reorder", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== EDIT_PERMISSION)
      return res
        .status(403)
        .json({ error: "Checklist edit permission was not supplied" });
    const userId = req.user?._id;
    const { sectionId } = req.params;
    if (!userId || !mongoose.isValidObjectId(sectionId))
      return res.status(400).json({ error: "Invalid section request" });
    if (!(await accessibleSection(sectionId, userId)))
      return res
        .status(404)
        .json({ error: "Section not found or unavailable to this user" });
    const normalized = normalizeChecklistOrder(req.body);
    if (normalized.error)
      return res.status(400).json({ error: normalized.error });
    const activeBefore = await StationAuditChecklist.find({
      section: sectionId,
      frequency: normalized.frequency,
      active: true,
    })
      .select("_id item sortOrder")
      .sort({ sortOrder: 1 })
      .lean();
    const expected = new Set(
      activeBefore.map((checklist) => checklist._id.toString()),
    );
    if (
      expected.size !== normalized.checklistIds.length ||
      normalized.checklistIds.some((id) => !expected.has(id))
    ) {
      return res
        .status(409)
        .json({
          error: "The active checklist list changed. Reload before reordering.",
        });
    }
    const now = new Date();
    await StationAuditChecklist.bulkWrite(
      normalized.checklistIds.map((id, sortOrder) => ({
        updateOne: {
          filter: { _id: id, section: sectionId, frequency: normalized.frequency, active: true },
          update: { $set: { sortOrder, updatedAt: now } },
        },
      })),
    );
    await StationAuditChecklist.updateMany(
      { section: sectionId, active: false, sortOrder: { $ne: null } },
      { $set: { sortOrder: null } },
    );
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "update",
      resourceType: "station-audit-checklist-order",
      resourceIds: normalized.checklistIds,
      success: true,
      statusCode: 200,
      before: { frequency: normalized.frequency, checklistIds: activeBefore.map((item) => item._id.toString()) },
      after: { frequency: normalized.frequency, checklistIds: normalized.checklistIds },
      message: `Reordered ${normalized.checklistIds.length} ${normalized.frequency} checklists`,
      source: "station-audit.manager.checklists",
      bulk: { affectedCount: normalized.checklistIds.length, truncated: false },
    });
    return res.json({ frequency: normalized.frequency, checklistIds: normalized.checklistIds });
  } catch (error) {
    console.error("Failed to reorder checklists:", error);
    return res.status(500).json({ error: "Failed to reorder checklists" });
  }
});

router.post(
  "/sections/:sectionId/checklists/:checklistId/status-options",
  async (req, res) => {
    try {
      if (req.header("X-Required-Permission") !== EDIT_PERMISSION)
        return res
          .status(403)
          .json({ error: "Checklist edit permission was not supplied" });
      const { sectionId, checklistId } = req.params;
      const userId = req.user?._id;
      if (
        !userId ||
        !mongoose.isValidObjectId(sectionId) ||
        !mongoose.isValidObjectId(checklistId)
      )
        return res.status(400).json({ error: "Invalid checklist request" });
      if (!(await accessibleSection(sectionId, userId)))
        return res
          .status(404)
          .json({ error: "Section not found or unavailable to this user" });
      const checklist = await StationAuditChecklist.findOne({
        _id: checklistId,
        section: sectionId,
      }).lean();
      if (!checklist)
        return res.status(404).json({ error: "Checklist not found" });
      const name =
        typeof req.body.name === "string" ? req.body.name.trim() : "";
      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : "";
      const options = normalizeOptions(req.body.options);
      if (!name || name.length > 200)
        return res
          .status(400)
          .json({ error: "Status-option name is required" });
      if (description.length > 2000)
        return res.status(400).json({ error: "Description is too long" });
      if (options.error) return res.status(400).json({ error: options.error });
      const created = await StationAuditStatusOptionSet.create({
        name,
        description,
        options: options.value,
        active: true,
        createdBy: userId,
      });
      await StationAuditChecklist.updateOne(
        { _id: checklistId },
        { $set: { statusOptionSet: created._id } },
      );
      const updated = await populatedChecklist(checklistId);
      const { logChange } = require("../../../middleware/changeLogger");
      await logChange(req, {
        action: "create",
        resourceType: "station-audit-status-option-set",
        resourceId: created._id,
        success: true,
        statusCode: 201,
        after: created.toObject(),
        resourceLabel: created.name,
        source: "station-audit.manager.checklists",
      });
      await logChange(req, {
        action: "update",
        resourceType: "station-audit-checklist",
        resourceId: checklistId,
        success: true,
        statusCode: 200,
        before: checklist,
        after: await StationAuditChecklist.findById(checklistId).lean(),
        resourceLabel: checklist.item,
        source: "station-audit.manager.checklists",
      });
      return res
        .status(201)
        .json({ checklist: updated, statusOptionSet: created.toObject() });
    } catch (error) {
      if (error?.code === 11000)
        return res
          .status(409)
          .json({ error: "A status-option set with this name already exists" });
      console.error("Failed to create checklist status options:", error);
      return res.status(500).json({ error: "Failed to create status options" });
    }
  },
);

router.put("/sections/:sectionId/checklists/:checklistId", async (req, res) => {
  try {
    const { sectionId, checklistId } = req.params;
    const userId = req.user?._id;
    if (
      !userId ||
      !mongoose.isValidObjectId(sectionId) ||
      !mongoose.isValidObjectId(checklistId)
    )
      return res.status(400).json({ error: "Invalid checklist request" });
    const section = await accessibleSection(sectionId, userId);
    if (!section)
      return res
        .status(404)
        .json({ error: "Section not found or unavailable to this user" });
    const update = normalizeChecklistUpdate(req.body);
    if (update.error) return res.status(400).json({ error: update.error });
    const requiredPermission = requiredChecklistPermission(update.field);
    if (req.header("X-Required-Permission") !== requiredPermission)
      return res.status(403).json({
        error: "The required checklist field permission was not supplied",
      });
    const before = await StationAuditChecklist.findOne({
      _id: checklistId,
      section: sectionId,
    }).lean();
    if (!before) return res.status(404).json({ error: "Checklist not found" });

    if (update.field === "assignedSites") {
      const allowed = new Set(
        (section.sites || []).map((site) => site._id.toString()),
      );
      if (update.value.some((site) => !allowed.has(site.toString())))
        return res
          .status(400)
          .json({ error: "Checklist sites must belong to the section" });
    }
    if (update.field === "department") {
      const allowed = new Set(
        (section.departments || []).map((department) =>
          department._id.toString(),
        ),
      );
      if (!allowed.has(update.value.toString()))
        return res
          .status(400)
          .json({ error: "Checklist department must belong to the section" });
    }
    if (
      update.field === "statusOptionSet" &&
      !(await StationAuditStatusOptionSet.exists({
        _id: update.value,
        active: true,
      }))
    )
      return res
        .status(400)
        .json({ error: "Status-option set must be active" });
    if (update.field === "orderConfiguration") {
      if (section.sectionType !== "order")
        return res
          .status(400)
          .json({
            error: "Order configuration is only available for Order sections",
          });
      if (
        update.value.requestOrderEnabled &&
        !(await Vendor.exists({
          name: update.value.suppliesVendor,
          category: { $regex: /^station supplies$/i },
        }))
      )
        return res
          .status(400)
          .json({ error: "Select a valid station-supplies vendor" });
    }

    if (update.field === "active" && update.value === false) {
      const remaining = await StationAuditChecklist.find({
        section: sectionId,
        frequency: before.frequency,
        active: true,
        _id: { $ne: checklistId },
      })
        .select("_id sortOrder item")
        .sort({ sortOrder: 1, item: 1 })
        .lean();
      const now = new Date();
      await StationAuditChecklist.bulkWrite([
        ...remaining.map((item, sortOrder) => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { sortOrder, updatedAt: now } },
          },
        })),
        {
          updateOne: {
            filter: { _id: checklistId },
            update: {
              $set: { active: false, sortOrder: null, updatedAt: now },
            },
          },
        },
      ]);
    } else if (
      update.field === "active" &&
      update.value === true &&
      !before.active
    ) {
      const last = await StationAuditChecklist.findOne({
        section: sectionId,
        frequency: before.frequency,
        active: true,
      })
        .sort({ sortOrder: -1 })
        .select("sortOrder")
        .lean();
      await StationAuditChecklist.updateOne(
        { _id: checklistId },
        { $set: { active: true, sortOrder: (last?.sortOrder ?? -1) + 1 } },
      );
    } else if (
      update.field === "frequency" &&
      before.active &&
      update.value !== before.frequency
    ) {
      const [remainingOld, lastNew] = await Promise.all([
        StationAuditChecklist.find({
          section: sectionId,
          frequency: before.frequency,
          active: true,
          _id: { $ne: checklistId },
        }).select("_id sortOrder item").sort({ sortOrder: 1, item: 1 }).lean(),
        StationAuditChecklist.findOne({
          section: sectionId,
          frequency: update.value,
          active: true,
        }).sort({ sortOrder: -1 }).select("sortOrder").lean(),
      ]);
      const now = new Date();
      await StationAuditChecklist.bulkWrite([
        ...remainingOld.map((item, sortOrder) => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { sortOrder, updatedAt: now } },
          },
        })),
        {
          updateOne: {
            filter: { _id: checklistId },
            update: {
              $set: {
                frequency: update.value,
                sortOrder: (lastNew?.sortOrder ?? -1) + 1,
                updatedAt: now,
              },
            },
          },
        },
      ]);
    } else if (update.field === "orderConfiguration") {
      await StationAuditChecklist.updateOne(
        { _id: checklistId },
        { $set: update.value },
        { runValidators: true },
      );
    } else {
      await StationAuditChecklist.updateOne(
        { _id: checklistId },
        { $set: { [update.field]: update.value } },
        { runValidators: true },
      );
    }
    await StationAuditChecklist.updateMany(
      { section: sectionId, active: false, sortOrder: { $ne: null } },
      { $set: { sortOrder: null } },
    );
    const after = await StationAuditChecklist.findById(checklistId).lean();
    const checklist = await populatedChecklist(checklistId);
    const { logChange } = require("../../../middleware/changeLogger");
    await logChange(req, {
      action: "update",
      resourceType: "station-audit-checklist",
      resourceId: checklistId,
      success: true,
      statusCode: 200,
      before,
      after,
      resourceLabel: checklist.item,
      source: "station-audit.manager.checklists",
    });
    return res.json({ checklist });
  } catch (error) {
    console.error("Failed to update checklist metadata:", error);
    return res
      .status(500)
      .json({ error: "Failed to update checklist metadata" });
  }
});

module.exports = {
  router,
  departmentIdsForUser,
  normalizeChecklistUpdate,
  normalizeChecklistCreate,
  normalizeChecklistOrder,
  requiredChecklistPermission,
};
