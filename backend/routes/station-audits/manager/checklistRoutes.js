const express = require("express");
const mongoose = require("mongoose");
const {
  StationAuditDepartment,
  StationAuditSection,
  StationAuditChecklist,
} = require("../../../models/station-audits");

const router = express.Router();

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
    if (!userId) return res.status(401).json({ error: "Authenticated user is required" });
    const departmentIds = await departmentIdsForUser(userId);
    if (!departmentIds.length) return res.json({ sections: [] });

    const sections = await StationAuditSection.find({ departments: { $in: departmentIds } })
      .populate("sites", "stationName site")
      .populate("departments", "name active")
      .sort({ active: -1, sortOrder: 1, name: 1 })
      .lean();
    const sectionIds = sections.map((section) => section._id);
    const counts = sectionIds.length ? await StationAuditChecklist.aggregate([
      { $match: { section: { $in: sectionIds } } },
      { $group: { _id: "$section", total: { $sum: 1 }, active: { $sum: { $cond: ["$active", 1, 0] } } } },
    ]) : [];
    const countsBySection = new Map(counts.map((entry) => [entry._id.toString(), entry]));
    return res.json({
      sections: sections.map((section) => ({
        ...section,
        sites: section.sites || [],
        departments: section.departments || [],
        checklistCount: countsBySection.get(section._id.toString())?.total || 0,
        activeChecklistCount: countsBySection.get(section._id.toString())?.active || 0,
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
    if (!userId || !mongoose.isValidObjectId(sectionId)) return res.status(400).json({ error: "Invalid section request" });
    const section = await accessibleSection(sectionId, userId);
    if (!section) return res.status(404).json({ error: "Section not found or unavailable to this user" });

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
        activeChecklistCount: checklists.filter((checklist) => checklist.active).length,
      },
      checklists: checklists.map((checklist) => ({
        ...checklist,
        assignedSites: checklist.assignedSites || [],
        statusOptionSet: checklist.statusOptionSet
          ? {
              ...checklist.statusOptionSet,
              options: [...(checklist.statusOptionSet.options || [])].sort(
                (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
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

module.exports = { router, departmentIdsForUser };
