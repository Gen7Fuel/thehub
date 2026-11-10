const express = require("express");
const mongoose = require("mongoose");
const Location = require("../../../models/Location");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditDepartment,
} = require("../../../models/station-audits");

const router = express.Router();
const ADD_PERMISSION = "auditManager.section.add";
const ADD_ALL_SITE_PERMISSION = "auditManager.section.add.allSite";
const ADD_ALL_DEPARTMENT_PERMISSION = "auditManager.section.add.allDepartment";

async function logSectionChange(req, change) {
  const { logChange } = require("../../../middleware/changeLogger");
  return logChange(req, change);
}
const EDITABLE_FIELDS = new Set([
  "name",
  "description",
  "sectionType",
  "sites",
  "departments",
  "active",
]);

function normalizeObjectIdArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: `${label} must contain at least one selection` };
  }
  const ids = [...new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    return { error: `${label} contains an invalid ID` };
  }
  return { value: ids.map((id) => new mongoose.Types.ObjectId(id)) };
}

function normalizeSectionUpdate(body = {}) {
  const fields = Object.keys(body).filter((field) => body[field] !== undefined);
  if (fields.length !== 1 || !EDITABLE_FIELDS.has(fields[0])) {
    return { error: "Update exactly one supported section field at a time" };
  }

  const field = fields[0];
  const rawValue = body[field];
  if (field === "name") {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value || value.length > 200) return { error: "Section name is required and cannot exceed 200 characters" };
    return { field, value };
  }
  if (field === "description") {
    if (typeof rawValue !== "string" || rawValue.length > 2000) {
      return { error: "Description must be text with at most 2000 characters" };
    }
    return { field, value: rawValue.trim() };
  }
  if (field === "sectionType") {
    if (!["checklist", "order"].includes(rawValue)) return { error: "Invalid section type" };
    return { field, value: rawValue };
  }
  if (field === "active") {
    if (typeof rawValue !== "boolean") return { error: "Active must be true or false" };
    return { field, value: rawValue };
  }
  const normalized = normalizeObjectIdArray(
    rawValue,
    field === "sites" ? "Sites" : "Departments"
  );
  return normalized.error ? normalized : { field, value: normalized.value };
}

function normalizeSectionOrder(body = {}) {
  if (!Array.isArray(body.sectionIds) || body.sectionIds.length === 0) {
    return { error: "sectionIds must contain the complete active section order" };
  }
  const sectionIds = body.sectionIds.map((entry) => String(entry || "").trim());
  if (sectionIds.some((id) => !mongoose.isValidObjectId(id))) {
    return { error: "sectionIds contains an invalid ID" };
  }
  if (new Set(sectionIds).size !== sectionIds.length) {
    return { error: "sectionIds cannot contain duplicates" };
  }
  return { sectionIds };
}

function normalizeSectionCreate(body = {}) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name || name.length > 200) return { error: "Section name is required and cannot exceed 200 characters" };
  if (description.length > 2000) return { error: "Description cannot exceed 2000 characters" };
  if (!["checklist", "order"].includes(body.sectionType)) return { error: "Invalid section type" };
  if (body.active !== undefined && typeof body.active !== "boolean") return { error: "Active must be true or false" };

  const sites = normalizeObjectIdArray(body.sites, "Sites");
  if (sites.error) return sites;
  const departments = normalizeObjectIdArray(body.departments, "Departments");
  if (departments.error) return departments;
  return {
    value: {
      name,
      description,
      sectionType: body.sectionType,
      sites: sites.value,
      departments: departments.value,
      active: body.active !== false,
    },
  };
}

async function getAdminDepartments() {
  return StationAuditDepartment.find({ isAdminDepartment: true, active: true })
    .select("_id")
    .lean();
}

function buildArchivedSectionOrder(sections, archivedSectionId) {
  const targetId = archivedSectionId.toString();
  const byCurrentOrder = (left, right) =>
    left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  const target = sections.find((section) => section._id.toString() === targetId);
  if (!target) return null;

  return sections
    .filter((section) => section.active && section._id.toString() !== targetId)
    .sort(byCurrentOrder)
    .map((section) => section._id.toString());
}

async function checklistCountsFor(sectionId) {
  const [total, active] = await Promise.all([
    StationAuditChecklist.countDocuments({ section: sectionId }),
    StationAuditChecklist.countDocuments({ section: sectionId, active: true }),
  ]);
  return { checklistCount: total, activeChecklistCount: active };
}

// GET /api/station-audits/manager/sections
// Read-only management projection. Mutations will be introduced separately.
router.get("/", async (_req, res) => {
  try {
    const [sections, availableSites, availableDepartments] = await Promise.all([
      StationAuditSection.find({})
      .select(
        "name description sortOrder sectionType sites departments active createdBy createdAt updatedAt"
      )
      .populate("sites", "stationName site")
      .populate(
        "departments",
        "name description departmentHead members assignmentStrategy active"
      )
      .sort({ active: -1, sortOrder: 1, name: 1 })
      .lean(),
      Location.find({ type: "store" })
        .select("stationName site type")
        .sort({ stationName: 1 })
        .lean(),
      StationAuditDepartment.find({ active: true })
        .select("name description departmentHead assignmentStrategy isAdminDepartment active")
        .populate("departmentHead", "firstName lastName email")
        .sort({ name: 1 })
        .lean(),
    ]);

    const sectionIds = sections.map((section) => section._id);
    const checklistCounts = sectionIds.length
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
      checklistCounts.map((entry) => [entry._id.toString(), entry])
    );

    return res.json({
      sections: sections.map((section) => {
        const counts = countsBySection.get(section._id.toString());
        return {
          ...section,
          sites: section.sites || [],
          departments: section.departments || [],
          checklistCount: counts?.total || 0,
          activeChecklistCount: counts?.active || 0,
        };
      }),
      options: {
        sites: availableSites,
        departments: availableDepartments,
      },
    });
  } catch (error) {
    console.error("Failed to load Station Audit sections for management:", error);
    return res.status(500).json({ error: "Failed to load Station Audit sections" });
  }
});

// POST /api/station-audits/manager/sections
router.post("/", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_PERMISSION)
      return res.status(403).json({ error: "Section add permission was not supplied" });
    const normalized = normalizeSectionCreate(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const [siteCount, departmentCount, adminDepartments, lastActive] = await Promise.all([
      Location.countDocuments({ _id: { $in: normalized.value.sites }, type: "store" }),
      StationAuditDepartment.countDocuments({ _id: { $in: normalized.value.departments }, active: true }),
      getAdminDepartments(),
      StationAuditSection.findOne({ active: true }).sort({ sortOrder: -1 }).select("sortOrder").lean(),
    ]);
    if (siteCount !== normalized.value.sites.length) {
      return res.status(400).json({ error: "Every selected site must be an active store location" });
    }
    if (departmentCount !== normalized.value.departments.length) {
      return res.status(400).json({ error: "Every selected department must be active" });
    }
    if (!adminDepartments.length) return res.status(409).json({ error: "An active admin department must be configured first" });

    const departmentIds = new Map(
      [...normalized.value.departments, ...adminDepartments.map((department) => department._id)]
        .map((id) => [id.toString(), id])
    );
    const section = await StationAuditSection.create({
      ...normalized.value,
      departments: [...departmentIds.values()],
      sortOrder: normalized.value.active ? (lastActive?.sortOrder ?? -1) + 1 : null,
      createdBy: req.user._id,
    });

    const populated = await StationAuditSection.findById(section._id)
      .populate("sites", "stationName site")
      .populate("departments", "name description departmentHead members assignmentStrategy active")
      .lean();
    await logSectionChange(req, {
      action: "create",
      resourceType: "station-audit-section",
      resourceId: section._id,
      success: true,
      statusCode: 201,
      after: section.toObject(),
      resourceLabel: section.name,
      source: "station-audit.manager.sections",
    });
    return res.status(201).json({
      section: { ...populated, checklistCount: 0, activeChecklistCount: 0 },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const conflictingField = Object.keys(error.keyPattern || error.keyValue || {})[0];
      return res.status(409).json({
        error: conflictingField
          ? `A section conflicts with the unique ${conflictingField} value`
          : "A section conflicts with an existing unique value",
      });
    }
    console.error("Failed to create Station Audit section:", error);
    return res.status(500).json({ error: "Failed to create Station Audit section" });
  }
});

// PUT /api/station-audits/manager/sections/sites/universal
router.put("/sites/universal", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_ALL_SITE_PERMISSION)
      return res.status(403).json({ error: "Universal site permission was not supplied" });
    const siteId = String(req.body?.siteId || "").trim();
    if (!mongoose.isValidObjectId(siteId)) return res.status(400).json({ error: "Invalid site ID" });
    const site = await Location.findOne({ _id: siteId, type: "store" }).select("_id stationName site").lean();
    if (!site) return res.status(400).json({ error: "The selected location must be a store" });

    const affectedSections = await StationAuditSection.find({
      active: true,
      sites: { $ne: site._id },
    }).select("_id name").lean();
    const result = await StationAuditSection.updateMany(
      { active: true, sites: { $ne: site._id } },
      { $addToSet: { sites: site._id } }
    );
    await logSectionChange(req, {
      action: "update",
      resourceType: "station-audit-section",
      resourceIds: affectedSections.map((section) => section._id),
      success: true,
      statusCode: 200,
      message: `Added site ${site.stationName || site.site || site._id} to ${result.modifiedCount} active Station Audit sections`,
      source: "station-audit.manager.sections",
      bulk: { affectedCount: result.modifiedCount, truncated: false },
    });
    return res.json({ site, updatedSections: result.modifiedCount });
  } catch (error) {
    console.error("Failed to add a site to all Station Audit sections:", error);
    return res.status(500).json({ error: "Failed to add site to all Station Audit sections" });
  }
});

// PUT /api/station-audits/manager/sections/departments/universal
router.put("/departments/universal", async (req, res) => {
  try {
    if (req.header("X-Required-Permission") !== ADD_ALL_DEPARTMENT_PERMISSION)
      return res.status(403).json({ error: "Universal department permission was not supplied" });
    const departmentId = String(req.body?.departmentId || "").trim();
    if (!mongoose.isValidObjectId(departmentId))
      return res.status(400).json({ error: "Invalid department ID" });
    const department = await StationAuditDepartment.findOne({
      _id: departmentId,
      active: true,
      isAdminDepartment: true,
    })
      .select("_id name departmentHead isAdminDepartment")
      .populate("departmentHead", "firstName lastName email")
      .lean();
    if (!department)
      return res.status(400).json({ error: "The selected department must be an active admin department" });

    const affectedSections = await StationAuditSection.find({
      departments: { $ne: department._id },
    }).select("_id name").lean();
    const result = await StationAuditSection.updateMany(
      { departments: { $ne: department._id } },
      { $addToSet: { departments: department._id } },
    );
    await logSectionChange(req, {
      action: "update",
      resourceType: "station-audit-section",
      resourceIds: affectedSections.map((section) => section._id),
      success: true,
      statusCode: 200,
      message: `Added admin department ${department.name} to ${result.modifiedCount} Station Audit sections`,
      source: "station-audit.manager.sections",
      bulk: { affectedCount: result.modifiedCount, truncated: false },
    });
    return res.json({ department, updatedSections: result.modifiedCount });
  } catch (error) {
    console.error("Failed to add a department to all Station Audit sections:", error);
    return res.status(500).json({ error: "Failed to add department to all Station Audit sections" });
  }
});

// PUT /api/station-audits/manager/sections/reorder
// Persists the complete active-section order as one operation.
router.put("/reorder", async (req, res) => {
  try {
    const normalized = normalizeSectionOrder(req.body);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const activeSectionsBefore = await StationAuditSection.find({ active: true })
      .select("_id name sortOrder")
      .sort({ sortOrder: 1 })
      .lean();
    const activeSectionIds = activeSectionsBefore.map((section) => section._id);
    const expected = new Set(activeSectionIds.map((id) => id.toString()));
    const received = new Set(normalized.sectionIds);
    if (
      expected.size !== received.size
      || [...expected].some((id) => !received.has(id))
    ) {
      return res.status(409).json({
        error: "The active section list changed. Refresh the page before reordering.",
      });
    }

    const now = new Date();
    await StationAuditSection.bulkWrite(
      normalized.sectionIds.map((sectionId, sortOrder) => ({
        updateOne: {
          filter: { _id: sectionId, active: true },
          update: { $set: { sortOrder, updatedAt: now } },
        },
      }))
    );
    await StationAuditSection.updateMany(
      { active: false, sortOrder: { $ne: null } },
      { $set: { sortOrder: null } }
    );
    await logSectionChange(req, {
      action: "update",
      resourceType: "station-audit-section-order",
      resourceIds: normalized.sectionIds,
      success: true,
      statusCode: 200,
      before: { sectionIds: activeSectionsBefore.map((section) => section._id.toString()) },
      after: { sectionIds: normalized.sectionIds },
      message: `Reordered ${normalized.sectionIds.length} active Station Audit sections`,
      source: "station-audit.manager.sections",
      bulk: { affectedCount: normalized.sectionIds.length, truncated: false },
      diffOptions: { maxChanges: 100 },
    });

    return res.json({
      sectionIds: normalized.sectionIds,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Failed to reorder Station Audit sections:", error);
    return res.status(500).json({ error: "Failed to reorder Station Audit sections" });
  }
});

// PUT /api/station-audits/manager/sections/:sectionId
// Accepts exactly one metadata field per request to prevent accidental bulk edits.
router.put("/:sectionId", async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!mongoose.isValidObjectId(sectionId)) {
      return res.status(400).json({ error: "Invalid section ID" });
    }

    const update = normalizeSectionUpdate(req.body);
    if (update.error) return res.status(400).json({ error: update.error });
    const beforeSection = await StationAuditSection.findById(sectionId).lean();
    if (!beforeSection) return res.status(404).json({ error: "Section not found" });

    if (update.field === "sites") {
      const count = await Location.countDocuments({
        _id: { $in: update.value },
        type: "store",
      });
      if (count !== update.value.length) {
        return res.status(400).json({ error: "Every selected site must be an active store location" });
      }
    }
    if (update.field === "departments") {
      const adminDepartments = await getAdminDepartments();
      if (!adminDepartments.length) return res.status(409).json({ error: "An active admin department must be configured first" });
      const selectedIds = new Set(update.value.map((id) => id.toString()));
      for (const department of adminDepartments) {
        if (!selectedIds.has(department._id.toString())) update.value.push(department._id);
      }
      const count = await StationAuditDepartment.countDocuments({
        _id: { $in: update.value },
        active: true,
      });
      if (count !== update.value.length) {
        return res.status(400).json({ error: "Every selected department must be active" });
      }
    }

    if (update.field === "active" && update.value === false) {
      const currentSections = await StationAuditSection.find({})
        .select("name sortOrder active")
        .lean();
      const archivedOrder = buildArchivedSectionOrder(currentSections, sectionId);
      if (!archivedOrder) return res.status(404).json({ error: "Section not found" });

      const now = new Date();
      await StationAuditSection.bulkWrite(
        [
          ...archivedOrder.map((orderedSectionId, sortOrder) => ({
            updateOne: {
              filter: { _id: orderedSectionId },
              update: { $set: { sortOrder, updatedAt: now } },
            },
          })),
          {
            updateOne: {
              filter: { _id: sectionId },
              update: { $set: { active: false, sortOrder: null, updatedAt: now } },
            },
          },
        ]
      );
      await StationAuditSection.updateMany(
        { active: false, sortOrder: { $ne: null } },
        { $set: { sortOrder: null } }
      );
    } else if (update.field === "active" && update.value === true) {
      const currentSection = await StationAuditSection.findById(sectionId)
        .select("active")
        .lean();
      if (!currentSection) return res.status(404).json({ error: "Section not found" });

      if (!currentSection.active) {
        const lastActive = await StationAuditSection.findOne({ active: true })
          .sort({ sortOrder: -1 })
          .select("sortOrder")
          .lean();
        await StationAuditSection.updateOne(
          { _id: sectionId },
          { $set: { active: true, sortOrder: (lastActive?.sortOrder ?? -1) + 1 } },
          { runValidators: true }
        );
      }
      await StationAuditSection.updateMany(
        { active: false, sortOrder: { $ne: null } },
        { $set: { sortOrder: null } }
      );
    } else {
      const updateResult = await StationAuditSection.updateOne(
        { _id: sectionId },
        { $set: { [update.field]: update.value } },
        { runValidators: true }
      );
      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ error: "Section not found" });
      }
    }

    const afterSection = await StationAuditSection.findById(sectionId).lean();
    const section = await StationAuditSection.findById(sectionId)
      .select(
        "name description sortOrder sectionType sites departments active createdBy createdAt updatedAt"
      )
      .populate("sites", "stationName site")
      .populate(
        "departments",
        "name description departmentHead members assignmentStrategy active"
      )
      .lean();

    if (!section) return res.status(404).json({ error: "Section not found" });
    await logSectionChange(req, {
      action: "update",
      resourceType: "station-audit-section",
      resourceId: section._id,
      success: true,
      statusCode: 200,
      before: beforeSection,
      after: afterSection,
      resourceLabel: section.name,
      source: "station-audit.manager.sections",
    });
    const counts = await checklistCountsFor(section._id);
    return res.json({
      section: {
        ...section,
        sites: section.sites || [],
        departments: section.departments || [],
        ...counts,
      },
    });
  } catch (error) {
    console.error("Failed to update Station Audit section:", error);
    return res.status(500).json({ error: "Failed to update Station Audit section" });
  }
});

module.exports = {
  router,
  normalizeSectionUpdate,
  normalizeSectionOrder,
  normalizeSectionCreate,
  buildArchivedSectionOrder,
};
