const PDFDocument = require("pdfkit");
const { DateTime } = require("luxon");
const Location = require("../models/Location");
const {
  StationAuditRun,
  StationAuditVisitorReportDispatch,
} = require("../models/station-audits");
const { emailQueue } = require("../queues/emailQueue");
const { resolveVisitorComparison } = require("./stationAuditReportResolver");

const REPORT_TO = "abc@gen7fuel.com";
const REPORT_CC = ["def@gen7fuel.com"];
const FREQUENCY_ORDER = { daily: 0, weekly: 1, monthly: 2 };

function validateReportDate(value) {
  if (value == null || value === "") return null;
  const parsed = DateTime.fromISO(String(value), { zone: "UTC" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || !parsed.isValid) {
    throw new Error("Report date must use YYYY-MM-DD format");
  }
  return String(value);
}

function localReportDate(location, requestedDate, now = DateTime.utc()) {
  if (requestedDate) return requestedDate;
  return now.setZone(location.timezone || "America/Toronto").minus({ days: 1 }).toISODate();
}

function localDayRange(date, timezone) {
  const start = DateTime.fromISO(date, { zone: timezone || "America/Toronto" }).startOf("day");
  if (!start.isValid) throw new Error(`Invalid report date ${date}`);
  return { start: start.toUTC().toJSDate(), end: start.plus({ days: 1 }).toUTC().toJSDate() };
}

function personName(person) {
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || person?.email || "Not recorded";
}

function responseValue(item, field) {
  if (!item?.completed) return "Not completed";
  if (field === "status") return item.response?.selectedStatus?.label || "No status recorded";
  if (field === "comment") return item.response?.comment || "No comment";
  return "";
}

function truncate(value, length) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function collectPdf(render) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    render.on("data", (chunk) => chunks.push(chunk));
    render.on("end", () => resolve(Buffer.concat(chunks)));
    render.on("error", reject);
  });
}

function ensureSpace(doc, height, title) {
  if (doc.y + height <= doc.page.height - 48) return;
  doc.addPage();
  if (title) doc.fontSize(9).fillColor("#64748b").text(title).moveDown(0.5);
}

function drawComparisonRow(doc, entry, source, item) {
  const issue = item?.response?.issueRaised === true;
  const startY = doc.y;
  const rowHeight = 44;
  if (issue) doc.save().fillColor("#fef2f2").rect(36, startY - 3, 540, rowHeight).fill().restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(issue ? "#b91c1c" : "#334155")
    .text(source, 42, startY, { width: 48 });
  doc.font("Helvetica").fontSize(7.5).fillColor("#334155")
    .text(truncate(responseValue(item, "status"), 54), 94, startY, { width: 158, height: 28 })
    .text(truncate(responseValue(item, "comment"), 82), 258, startY, { width: 205, height: 28 })
    .text(item?.completed ? personName(item.response?.checkedBy) : "—", 469, startY, { width: 72, height: 28 })
    .text(String(item?.response?.photos?.length || 0), 546, startY, { width: 24, align: "center" });
  doc.y = startY + rowHeight;
}

function createVisitorReportPdf({ location, reportDate, comparisons }) {
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 42, bottom: 42, left: 36, right: 36 }, bufferPages: true });
  const complete = collectPdf(doc);
  const visitorNames = [...new Set(comparisons.map(({ comparison }) => personName(
    comparison.visitorRun?.completedBy || comparison.visitorRun?.startedBy
  )))];
  const totals = comparisons.reduce((summary, { comparison }) => ({
    checklists: summary.checklists + comparison.summary.total,
    differing: summary.differing + comparison.summary.differing,
    status: summary.status + comparison.summary.statusDifferences,
    issues: summary.issues + comparison.summary.issueDifferences,
  }), { checklists: 0, differing: 0, status: 0, issues: 0 });

  doc.fillColor("#4c1d95").font("Helvetica-Bold").fontSize(20).text("Visitor Audit Comparison Report");
  doc.moveDown(0.3).fillColor("#334155").fontSize(12).text(location.stationName || location.site || "Station");
  doc.font("Helvetica").fontSize(9).fillColor("#64748b")
    .text(`Visitor audit date: ${reportDate}`)
    .text(`Visitor${visitorNames.length === 1 ? "" : "s"}: ${visitorNames.join(", ") || "Not recorded"}`);
  doc.moveDown(0.8);
  const summaryY = doc.y;
  const cells = [
    ["Compared", totals.checklists], ["Different", totals.differing],
    ["Status differences", totals.status], ["Issue differences", totals.issues],
  ];
  cells.forEach(([label, value], index) => {
    const x = 36 + index * 136;
    doc.roundedRect(x, summaryY, 128, 38, 5).fillAndStroke("#f5f3ff", "#ddd6fe");
    doc.fillColor("#4c1d95").font("Helvetica-Bold").fontSize(12).text(String(value), x + 8, summaryY + 7, { width: 112 });
    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(String(label), x + 8, summaryY + 23, { width: 112 });
  });
  doc.y = summaryY + 52;

  for (const { run, comparison } of comparisons) {
    ensureSpace(doc, 105, location.stationName);
    doc.fillColor("#ede9fe").roundedRect(36, doc.y, 540, 42, 5).fill();
    const sectionY = doc.y + 7;
    doc.fillColor("#4c1d95").font("Helvetica-Bold").fontSize(11)
      .text(comparison.section.name, 44, sectionY, { width: 350 });
    doc.font("Helvetica").fontSize(8).fillColor("#6d28d9")
      .text(`${run.frequency.toUpperCase()} · ${comparison.period.label}`, 44, sectionY + 17, { width: 350 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#92400e")
      .text(`${comparison.summary.differing} different`, 430, sectionY + 8, { width: 135, align: "right" });
    doc.y += 50;
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#64748b")
      .text("CHECKLIST", 42, doc.y, { width: 195 })
      .text("RESULT", 242, doc.y, { width: 325 });
    doc.y += 13;

    for (const entry of comparison.checklists) {
      ensureSpace(doc, 118, `${comparison.section.name} · ${run.frequency}`);
      const checklistY = doc.y;
      doc.fillColor(entry.differs ? "#fffbeb" : "#f8fafc").rect(36, checklistY - 3, 540, 21).fill();
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8)
        .text(truncate(entry.snapshot.item, 74), 42, checklistY, { width: 410 });
      if (entry.differs) doc.fillColor("#92400e").text("DIFFERENT", 474, checklistY, { width: 94, align: "right" });
      doc.y = checklistY + 25;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#94a3b8")
        .text("SOURCE", 42, doc.y, { width: 48 })
        .text("STATUS", 94, doc.y, { width: 158 })
        .text("COMMENT", 258, doc.y, { width: 205 })
        .text("COMPLETED BY", 469, doc.y, { width: 72 })
        .text("PHOTOS", 546, doc.y, { width: 24, align: "center" });
      doc.y += 13;
      drawComparisonRow(doc, entry, "Store", entry.store);
      drawComparisonRow(doc, entry, "Visitor", entry.visitor);
      doc.moveTo(36, doc.y - 3).lineTo(576, doc.y - 3).strokeColor("#e2e8f0").stroke();
      doc.y += 5;
    }
    doc.moveDown(0.5);
  }

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index);
    doc.font("Helvetica").fontSize(7).fillColor("#94a3b8")
      .text(`Generated by Gen7 Fuel Hub · Page ${index + 1} of ${pages.count}`, 36, doc.page.height - 30, { width: 540, align: "center" });
  }
  doc.end();
  return complete;
}

async function acquireDispatch(site, reportDate, runIds) {
  const existing = await StationAuditVisitorReportDispatch.findOne({ site, reportDate }).lean();
  if (existing && ["queued", "sent"].includes(existing.status)) return null;
  if (existing?.status === "generating" && Date.now() - new Date(existing.updatedAt).getTime() < 60 * 60 * 1000) return null;
  if (existing) {
    return StationAuditVisitorReportDispatch.findOneAndUpdate(
      { _id: existing._id, status: existing.status, updatedAt: existing.updatedAt },
      { $set: { status: "generating", visitorRuns: runIds, lastError: "", queuedAt: null, sentAt: null }, $inc: { attempts: 1 } },
      { new: true }
    );
  }
  try {
    return await StationAuditVisitorReportDispatch.create({ site, reportDate, visitorRuns: runIds });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function buildComparisons(location, runs) {
  const comparisons = await Promise.all(runs.map(async (run) => ({
    run,
    comparison: await resolveVisitorComparison({
      sectionId: run.section,
      site: location._id,
      timezone: location.timezone,
      frequency: run.frequency,
      date: DateTime.fromJSDate(run.startedAt).setZone(location.timezone).toISODate(),
      visitorStartedBy: run.startedBy?._id || run.startedBy,
    }),
  })));
  return comparisons.sort((left, right) =>
    FREQUENCY_ORDER[left.run.frequency] - FREQUENCY_ORDER[right.run.frequency]
    || (left.run.sectionSnapshot?.name || "").localeCompare(right.run.sectionSnapshot?.name || "", undefined, { sensitivity: "base" })
  );
}

async function processLocation(location, requestedDate, now) {
  const reportDate = localReportDate(location, requestedDate, now);
  const range = localDayRange(reportDate, location.timezone);
  const runs = await StationAuditRun.find({
    site: location._id,
    type: "visitor",
    startedAt: { $gte: range.start, $lt: range.end },
  }).populate("startedBy completedBy", "firstName lastName email").lean();
  if (!runs.length) return { site: location._id, reportDate, status: "no-runs" };

  const runIds = runs.map((run) => run._id).sort((a, b) => String(a).localeCompare(String(b)));
  const dispatch = await acquireDispatch(location._id, reportDate, runIds);
  if (!dispatch) return { site: location._id, reportDate, status: "already-dispatched" };

  try {
    const comparisons = await buildComparisons(location, runs);
    const pdf = await createVisitorReportPdf({ location, reportDate, comparisons });
    const safeSite = String(location.stationName || location.site || location._id).replace(/[^a-z0-9_-]+/gi, "_");
    const filename = `Visitor_Audit_${safeSite}_${reportDate}.pdf`;
    const jobId = `station-audit-visitor-report-${location._id}-${reportDate}`;
    const job = await emailQueue.add("sendStationAuditVisitorReport", {
      to: REPORT_TO,
      cc: REPORT_CC,
      subject: `Visitor Audit Report - ${location.stationName || location.site} - ${reportDate}`,
      text: `Attached is the Visitor versus Store audit comparison for ${location.stationName || location.site} on ${reportDate}.`,
      html: `<p>Attached is the Visitor versus Store audit comparison for <strong>${location.stationName || location.site}</strong> on <strong>${reportDate}</strong>.</p>`,
      auditVisitorReportDispatchId: dispatch._id.toString(),
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    }, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
    await StationAuditVisitorReportDispatch.updateOne(
      { _id: dispatch._id, status: "generating" },
      { $set: { status: "queued", queuedAt: new Date(), emailJobId: String(job.id), lastError: "" } }
    );
    return { site: location._id, reportDate, status: "queued", runs: runs.length, filename };
  } catch (error) {
    await StationAuditVisitorReportDispatch.updateOne(
      { _id: dispatch._id },
      { $set: { status: "failed", lastError: String(error.message || error).slice(0, 1000) } }
    );
    throw error;
  }
}

async function runStationAuditVisitorReports({ date, now = DateTime.utc() } = {}) {
  const requestedDate = validateReportDate(date);
  const locations = await Location.find({ type: "store" }).select("stationName site timezone").lean();
  const results = [];
  for (const location of locations) {
    try {
      results.push(await processLocation(location, requestedDate, now));
    } catch (error) {
      console.error(`Visitor audit report failed for ${location.stationName || location._id}:`, error);
      results.push({ site: location._id, reportDate: localReportDate(location, requestedDate, now), status: "failed", error: error.message });
    }
  }
  return {
    requestedDate: requestedDate || null,
    locations: locations.length,
    queued: results.filter((result) => result.status === "queued").length,
    skipped: results.filter((result) => ["no-runs", "already-dispatched"].includes(result.status)).length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

module.exports = {
  REPORT_TO,
  REPORT_CC,
  validateReportDate,
  localReportDate,
  localDayRange,
  createVisitorReportPdf,
  runStationAuditVisitorReports,
};
