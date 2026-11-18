const { DateTime } = require("luxon");
const {
  StationAuditSection,
  StationAuditChecklistRevision,
  StationAuditRun,
  StationAuditResponse,
} = require("../models/station-audits");

const FREQUENCIES = ["daily", "weekly", "monthly"];

function periodKeyFor(frequency, localDate) {
  if (frequency === "daily") return localDate.toFormat("yyyy-MM-dd");
  if (frequency === "monthly") return localDate.toFormat("yyyy-MM");
  const year = localDate.year;
  const day = localDate.ordinal - 1;
  const januaryFirstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const week = Math.ceil((day + januaryFirstDay + 1) / 7);
  return `${year}-W${week}`;
}

function reportPeriod(frequency, date, timezone) {
  if (!FREQUENCIES.includes(frequency)) return null;
  const zone = timezone || "America/Toronto";
  const selected = DateTime.fromISO(String(date || ""), { zone }).startOf("day");
  if (!selected.isValid) return null;

  let start = selected;
  let end = selected.endOf("day");
  if (frequency === "monthly") {
    start = selected.startOf("month");
    end = selected.endOf("month");
  } else if (frequency === "weekly") {
    const key = periodKeyFor(frequency, selected);
    while (periodKeyFor(frequency, start.minus({ days: 1 })) === key) start = start.minus({ days: 1 });
    while (periodKeyFor(frequency, end.plus({ days: 1 })) === key) end = end.plus({ days: 1 }).endOf("day");
  }

  return {
    periodKey: periodKeyFor(frequency, selected),
    start: start.toJSDate(),
    end: end.toJSDate(),
    label: frequency === "daily"
      ? start.toFormat("MMM d, yyyy")
      : frequency === "monthly"
        ? start.toFormat("MMMM yyyy")
        : `${start.toFormat("MMM d")} – ${end.toFormat("MMM d, yyyy")}`,
  };
}

function latestRevisionAt(revisions, cutoff) {
  let latest = null;
  for (const revision of revisions) {
    if (new Date(revision.effectiveFrom) > cutoff) continue;
    if (!latest || new Date(revision.effectiveFrom) > new Date(latest.effectiveFrom)) latest = revision;
  }
  return latest;
}

async function resolveStoreReportOverview({ site, timezone, type = "store", frequency, date }) {
  const period = reportPeriod(frequency, date, timezone);
  if (!period) throw new Error("INVALID_REPORT_PERIOD");
  const now = new Date();
  const openPeriod = period.start <= now && period.end >= now;
  const defaultCutoff = openPeriod ? now : period.end;
  const scopeKey = `${site}:${type}`;

  const scopedChecklistIds = await StationAuditChecklistRevision.distinct("checklist", {
    scopeKeys: scopeKey,
    "snapshot.frequency": frequency,
    effectiveFrom: { $lte: defaultCutoff },
  });
  const [runs, revisions] = await Promise.all([
    StationAuditRun.find({ site, type, frequency, periodKey: period.periodKey })
      .populate("startedBy", "firstName lastName email")
      .populate("completedBy", "firstName lastName email")
      .lean(),
    StationAuditChecklistRevision.find({
      checklist: { $in: scopedChecklistIds },
      effectiveFrom: { $lte: defaultCutoff },
    }).sort({ checklist: 1, effectiveFrom: 1 }).lean(),
  ]);

  const runBySection = new Map(runs.map((run) => [String(run.section), run]));
  const runIds = runs.map((run) => run._id);
  const responses = runIds.length
    ? await StationAuditResponse.find({ run: { $in: runIds } })
      .select("run checklist checklistRevision checked checkedAt")
      .lean()
    : [];
  const responsesByRun = responses.reduce((map, response) => {
    const runId = String(response.run);
    if (!map.has(runId)) map.set(runId, []);
    map.get(runId).push(response);
    return map;
  }, new Map());

  const revisionsByChecklist = revisions.reduce((map, revision) => {
    const checklistId = String(revision.checklist);
    if (!map.has(checklistId)) map.set(checklistId, []);
    map.get(checklistId).push(revision);
    return map;
  }, new Map());

  const sectionIds = new Set([
    ...runs.map((run) => String(run.section)),
    ...revisions.map((revision) => String(revision.section)),
  ]);
  const expectedBySection = new Map([...sectionIds].map((sectionId) => [sectionId, new Map()]));

  for (const checklistRevisions of revisionsByChecklist.values()) {
    const sectionId = String(checklistRevisions[0].section);
    const run = runBySection.get(sectionId);
    const cutoff = run?.state === "completed" && run.completedAt
      ? new Date(run.completedAt)
      : defaultCutoff;
    const revision = latestRevisionAt(checklistRevisions, cutoff);
    if (!revision) continue;
    if (
      revision.snapshot.active === true
      && revision.snapshot.frequency === frequency
      && revision.scopeKeys.includes(scopeKey)
    ) {
      expectedBySection.get(sectionId).set(String(revision.checklist), revision);
    }
  }

  for (const run of runs) {
    const sectionExpected = expectedBySection.get(String(run.section));
    for (const response of responsesByRun.get(String(run._id)) || []) {
      if (!sectionExpected.has(String(response.checklist))) {
        sectionExpected.set(String(response.checklist), null);
      }
    }
  }

  const sections = await StationAuditSection.find({ _id: { $in: [...sectionIds] } })
    .select("name description sortOrder sectionType active")
    .lean();
  const sectionById = new Map(sections.map((section) => [String(section._id), section]));
  const output = [];

  for (const sectionId of sectionIds) {
    const section = sectionById.get(sectionId);
    if (!section) continue;
    const run = runBySection.get(sectionId) || null;
    const expected = expectedBySection.get(sectionId);
    const completedIds = new Set(
      (run ? responsesByRun.get(String(run._id)) || [] : [])
        .filter((response) => response.checked === true)
        .map((response) => String(response.checklist))
    );
    const total = expected.size;
    const completed = [...expected.keys()].filter((checklistId) => completedIds.has(checklistId)).length;
    if (!total) continue;
    output.push({
      _id: section._id,
      name: run?.sectionSnapshot?.name || section.name,
      description: run?.sectionSnapshot?.description || section.description || "",
      sortOrder: section.sortOrder,
      run: run ? {
        _id: run._id,
        state: run.state,
        startedBy: run.startedBy,
        completedBy: run.completedBy,
        completedAt: run.completedAt,
      } : null,
      summary: { total, completed, pending: total - completed },
    });
  }

  output.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const total = output.reduce((sum, section) => sum + section.summary.total, 0);
  const completed = output.reduce((sum, section) => sum + section.summary.completed, 0);
  return {
    period: { ...period, start: period.start.toISOString(), end: period.end.toISOString() },
    summary: { total, completed, pending: total - completed },
    sections: output,
  };
}

function availabilityPeriods(frequency, anchor, timezone) {
  const zone = timezone || "America/Toronto";
  const selected = DateTime.fromISO(String(anchor || ""), { zone }).startOf("month");
  if (!selected.isValid || !FREQUENCIES.includes(frequency)) return null;
  if (frequency === "monthly") {
    return Array.from({ length: 12 }, (_, index) => {
      const date = selected.startOf("year").plus({ months: index });
      return { periodKey: periodKeyFor("monthly", date), date: date.toISODate(), label: date.toFormat("MMM") };
    });
  }
  if (frequency === "daily") {
    return Array.from({ length: selected.daysInMonth }, (_, index) => {
      const date = selected.plus({ days: index });
      return { periodKey: periodKeyFor("daily", date), date: date.toISODate(), label: String(date.day) };
    });
  }

  let weekStart = selected;
  while (weekStart.weekday !== 7) weekStart = weekStart.minus({ days: 1 });
  const monthEnd = selected.endOf("month");
  const periods = [];
  while (weekStart <= monthEnd) {
    const weekEnd = weekStart.plus({ days: 6 });
    periods.push({
      periodKey: periodKeyFor("weekly", weekStart),
      date: weekStart.toISODate(),
      endDate: weekEnd.toISODate(),
      label: `${weekStart.toFormat("MMM d")} – ${weekEnd.toFormat("MMM d")}`,
    });
    weekStart = weekStart.plus({ days: 7 });
  }
  return periods;
}

async function resolveStoreReportAvailability({ site, timezone, type = "store", frequency, anchor }) {
  const periods = availabilityPeriods(frequency, anchor, timezone);
  if (!periods) throw new Error("INVALID_REPORT_PERIOD");
  const keys = periods.map((period) => period.periodKey);
  const counts = await StationAuditRun.aggregate([
    { $match: { site, type, frequency, periodKey: { $in: keys } } },
    { $group: {
      _id: "$periodKey",
      runCount: { $sum: 1 },
      completedRunCount: { $sum: { $cond: [{ $eq: ["$state", "completed"] }, 1, 0] } },
    } },
  ]);
  const byKey = new Map(counts.map((entry) => [entry._id, entry]));
  return periods.map((period) => ({
    ...period,
    runCount: byKey.get(period.periodKey)?.runCount || 0,
    completedRunCount: byKey.get(period.periodKey)?.completedRunCount || 0,
    hasData: Boolean(byKey.get(period.periodKey)?.runCount),
  }));
}

async function resolveReportSection({ sectionId, site, timezone, type, frequency, date }) {
  const period = reportPeriod(frequency, date, timezone);
  if (!period) throw new Error("INVALID_REPORT_PERIOD");
  const now = new Date();
  const defaultCutoff = period.start <= now && period.end >= now ? now : period.end;
  const scopeKey = `${site}:${type}`;
  const run = await StationAuditRun.findOne({
    section: sectionId,
    site,
    type,
    frequency,
    periodKey: period.periodKey,
  })
    .populate("startedBy", "firstName lastName email")
    .populate("completedBy", "firstName lastName email")
    .lean();
  const cutoff = run?.state === "completed" && run.completedAt
    ? new Date(run.completedAt)
    : defaultCutoff;
  const scopedChecklistIds = await StationAuditChecklistRevision.distinct("checklist", {
    section: sectionId,
    scopeKeys: scopeKey,
    "snapshot.frequency": frequency,
    effectiveFrom: { $lte: cutoff },
  });
  const [revisions, responses, section] = await Promise.all([
    StationAuditChecklistRevision.find({
      checklist: { $in: scopedChecklistIds },
      section: sectionId,
      effectiveFrom: { $lte: cutoff },
    }).sort({ checklist: 1, effectiveFrom: 1 }).lean(),
    run
      ? StationAuditResponse.find({ run: run._id })
        .select("checklist checklistRevision checklistSnapshot checked checkedAt checkedBy selectedStatus comment photos requestOrder orderCreated issueRaised issue")
        .populate("checkedBy", "firstName lastName email")
        .lean()
      : [],
    StationAuditSection.findById(sectionId).select("name description sortOrder sectionType").lean(),
  ]);
  if (!section && !run) throw new Error("REPORT_SECTION_NOT_FOUND");

  const revisionsByChecklist = revisions.reduce((map, revision) => {
    const checklistId = String(revision.checklist);
    if (!map.has(checklistId)) map.set(checklistId, []);
    map.get(checklistId).push(revision);
    return map;
  }, new Map());
  const expected = new Map();
  for (const checklistRevisions of revisionsByChecklist.values()) {
    const revision = latestRevisionAt(checklistRevisions, cutoff);
    if (
      revision?.snapshot.active === true
      && revision.snapshot.frequency === frequency
      && revision.scopeKeys.includes(scopeKey)
    ) expected.set(String(revision.checklist), revision);
  }
  const responseByChecklist = new Map(responses.map((response) => [String(response.checklist), response]));
  for (const response of responses) if (!expected.has(String(response.checklist))) expected.set(String(response.checklist), null);

  const items = [...expected.entries()].map(([checklistId, revision]) => {
    const response = responseByChecklist.get(checklistId) || null;
    const snapshot = response?.checked ? response.checklistSnapshot : revision?.snapshot || response?.checklistSnapshot;
    return {
      checklist: checklistId,
      expectedRevision: revision ? { _id: revision._id, version: revision.version } : null,
      submittedRevision: response?.checklistRevision || null,
      snapshot: {
        item: snapshot?.item || "Checklist item",
        description: snapshot?.description || "",
        category: snapshot?.category || "",
        frequency: snapshot?.frequency || frequency,
        sortOrder: revision?.snapshot?.sortOrder ?? null,
        departmentName: response?.checklistSnapshot?.departmentName || "",
      },
      completed: response?.checked === true,
      response,
    };
  }).sort((left, right) =>
    (left.snapshot.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.snapshot.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || left.snapshot.item.localeCompare(right.snapshot.item, undefined, { sensitivity: "base" })
  );
  const completed = items.filter((item) => item.completed).length;
  return {
    type,
    frequency,
    period: { ...period, start: period.start.toISOString(), end: period.end.toISOString() },
    section: {
      _id: sectionId,
      name: run?.sectionSnapshot?.name || section?.name || "Audit section",
      description: run?.sectionSnapshot?.description || section?.description || "",
    },
    run: run ? {
      _id: run._id,
      state: run.state,
      startedBy: run.startedBy,
      completedBy: run.completedBy,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    } : null,
    summary: { total: items.length, completed, pending: items.length - completed },
    checklists: items,
  };
}

async function resolveVisitorComparison(args) {
  const [store, visitor] = await Promise.all([
    resolveReportSection({ ...args, type: "store" }),
    resolveReportSection({ ...args, type: "visitor" }),
  ]);
  const merged = new Map();
  for (const item of store.checklists) merged.set(String(item.checklist), { checklist: item.checklist, snapshot: item.snapshot, store: item, visitor: null });
  for (const item of visitor.checklists) {
    const key = String(item.checklist);
    const existing = merged.get(key);
    if (existing) {
      existing.visitor = item;
      if (!existing.store?.completed && item.snapshot) existing.snapshot = item.snapshot;
    } else merged.set(key, { checklist: item.checklist, snapshot: item.snapshot, store: null, visitor: item });
  }
  const checklists = [...merged.values()].map((entry) => {
    const storeStatus = entry.store?.response?.selectedStatus?.key || entry.store?.response?.selectedStatus?.label || "";
    const visitorStatus = entry.visitor?.response?.selectedStatus?.key || entry.visitor?.response?.selectedStatus?.label || "";
    const statusDiffers = Boolean(entry.store?.completed || entry.visitor?.completed)
      && (entry.store?.completed !== entry.visitor?.completed || storeStatus !== visitorStatus);
    const issueDiffers = Boolean(entry.store?.response?.issueRaised) !== Boolean(entry.visitor?.response?.issueRaised);
    return { ...entry, statusDiffers, issueDiffers, differs: statusDiffers || issueDiffers };
  }).sort((left, right) =>
    (left.snapshot.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.snapshot.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || left.snapshot.item.localeCompare(right.snapshot.item, undefined, { sensitivity: "base" })
  );
  return {
    type: "visitor",
    frequency: visitor.frequency,
    period: visitor.period,
    section: visitor.section,
    storeRun: store.run,
    visitorRun: visitor.run,
    summary: {
      total: checklists.length,
      differing: checklists.filter((item) => item.differs).length,
      statusDifferences: checklists.filter((item) => item.statusDiffers).length,
      issueDifferences: checklists.filter((item) => item.issueDiffers).length,
    },
    checklists,
  };
}

module.exports = {
  FREQUENCIES,
  availabilityPeriods,
  periodKeyFor,
  reportPeriod,
  resolveStoreReportAvailability,
  resolveStoreReportOverview,
  resolveReportSection,
  resolveVisitorComparison,
};
