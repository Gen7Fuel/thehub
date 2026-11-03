const express = require("express");
const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const Location = require("../../models/Location");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditRun,
  StationAuditResponse,
} = require("../../models/station-audits");

const router = express.Router();
const FREQUENCIES = ["daily", "weekly", "monthly"];
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
      .select("_id stationName site timezone")
      .lean();
    if (byId) return byId;
  }

  return Location.findOne({
    $or: [
      { site: { $regex: `^${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      { stationName: { $regex: `^${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    ],
  })
    .select("_id stationName site timezone")
    .lean();
}

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
    })
      .select("name description")
      .sort({ name: 1 })
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
        frequency: { $in: frequencies },
        active: true,
      })
        .select(
          "section item description category frequency department statusOptionSet followUpInstructions commentRequired requestOrderEnabled suppliesVendor"
        )
        .populate("department", "name departmentHead")
        .populate("statusOptionSet", "name options")
        .sort({ item: 1 })
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
    const responses = runIds.length
      ? await StationAuditResponse.find({ run: { $in: runIds } })
          .select(
            "run checklist checked checkedAt checkedBy selectedStatus comment photos requestOrder orderCreated order issueRaised updatedAt"
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

module.exports = { router, periodKeyFor, periodKeysFor, resolveLocation, FREQUENCIES, AUDIT_TYPES };
