const express = require("express");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditRun,
  StationAuditResponse,
} = require("../../models/station-audits");
const {
  resolveLocation,
  periodKeysFor,
  FREQUENCIES,
  AUDIT_TYPES,
} = require("./checklistRoutes");

const router = express.Router();

// GET /api/station-audits/sections?site=...&type=store
// Lightweight navigation read model. Checklist definitions are loaded only
// after the user opens a specific section.
router.get("/", async (req, res) => {
  try {
    const { site, type = "store", date } = req.query;
    if (!site) return res.status(400).json({ error: "Missing site" });
    if (!AUDIT_TYPES.includes(type)) {
      return res.status(400).json({ error: "Invalid audit type" });
    }

    const location = await resolveLocation(site);
    if (!location) return res.status(404).json({ error: "Site not found" });

    const periodKeys = periodKeysFor(location.timezone, date);
    if (!periodKeys) return res.status(400).json({ error: "Invalid date" });

    const sectionFilter = { sites: location._id, active: true };
    if (type === "visitor") sectionFilter.sectionType = "checklist";

    const sections = await StationAuditSection.find(sectionFilter)
      .select("name description sortOrder sectionType")
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    const sectionIds = sections.map((section) => section._id);

    if (!sectionIds.length) {
      return res.json({
        location: { _id: location._id, name: location.site || location.stationName, timezone: location.timezone },
        type,
        periodKeys,
        summary: { total: 0, completed: 0, pending: 0 },
        sections: [],
      });
    }

    const [checklists, runs] = await Promise.all([
      StationAuditChecklist.find({
        section: { $in: sectionIds },
        assignedSites: location._id,
        auditTypes: type,
        active: true,
      })
        .select("section frequency")
        .lean(),
      StationAuditRun.find({
        section: { $in: sectionIds },
        site: location._id,
        type,
        $or: FREQUENCIES.map((frequency) => ({ frequency, periodKey: periodKeys[frequency] })),
      })
        .select("section frequency")
        .lean(),
    ]);

    const responses = runs.length
      ? await StationAuditResponse.find({
          run: { $in: runs.map((run) => run._id) },
          checked: true,
        })
          .select("run checklist")
          .lean()
      : [];

    const runBySectionFrequency = new Map(
      runs.map((run) => [`${run.section}:${run.frequency}`, run])
    );
    const completedKeys = new Set(
      responses.map((response) => `${response.run}:${response.checklist}`)
    );
    const checklistsBySection = new Map(sectionIds.map((id) => [id.toString(), []]));
    checklists.forEach((checklist) => {
      checklistsBySection.get(checklist.section.toString()).push(checklist);
    });

    const outputSections = sections.map((section) => {
      const items = checklistsBySection.get(section._id.toString()) || [];
      const frequencies = Object.fromEntries(
        FREQUENCIES.map((frequency) => {
          const frequencyItems = items.filter((item) => item.frequency === frequency);
          const run = runBySectionFrequency.get(`${section._id}:${frequency}`);
          const completed = run
            ? frequencyItems.filter((item) => completedKeys.has(`${run._id}:${item._id}`)).length
            : 0;
          return [frequency, { total: frequencyItems.length, completed, pending: frequencyItems.length - completed }];
        })
      );
      const total = items.length;
      const completed = Object.values(frequencies).reduce((sum, entry) => sum + entry.completed, 0);

      return {
        ...section,
        summary: { total, completed, pending: total - completed },
        frequencies,
      };
    });

    const total = outputSections.reduce((sum, section) => sum + section.summary.total, 0);
    const completed = outputSections.reduce((sum, section) => sum + section.summary.completed, 0);

    return res.json({
      location: { _id: location._id, name: location.site || location.stationName, timezone: location.timezone },
      type,
      periodKeys,
      summary: { total, completed, pending: total - completed },
      sections: outputSections,
    });
  } catch (error) {
    console.error("Failed to load Station Audit sections:", error);
    return res.status(500).json({ error: "Failed to load Station Audit sections" });
  }
});

module.exports = router;
