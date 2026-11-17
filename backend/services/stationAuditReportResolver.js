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

async function resolveStoreReportOverview({ site, timezone, frequency, date }) {
  const period = reportPeriod(frequency, date, timezone);
  if (!period) throw new Error("INVALID_REPORT_PERIOD");
  const now = new Date();
  const openPeriod = period.start <= now && period.end >= now;
  const defaultCutoff = openPeriod ? now : period.end;
  const scopeKey = `${site}:store`;

  const scopedChecklistIds = await StationAuditChecklistRevision.distinct("checklist", {
    scopeKeys: scopeKey,
    "snapshot.frequency": frequency,
    effectiveFrom: { $lte: defaultCutoff },
  });
  const [runs, revisions] = await Promise.all([
    StationAuditRun.find({ site, type: "store", frequency, periodKey: period.periodKey }).lean(),
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
      run: run ? { _id: run._id, state: run.state, completedAt: run.completedAt } : null,
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

async function resolveStoreReportAvailability({ site, timezone, frequency, anchor }) {
  const periods = availabilityPeriods(frequency, anchor, timezone);
  if (!periods) throw new Error("INVALID_REPORT_PERIOD");
  const keys = periods.map((period) => period.periodKey);
  const counts = await StationAuditRun.aggregate([
    { $match: { site, type: "store", frequency, periodKey: { $in: keys } } },
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

module.exports = {
  FREQUENCIES,
  availabilityPeriods,
  periodKeyFor,
  reportPeriod,
  resolveStoreReportAvailability,
  resolveStoreReportOverview,
};
