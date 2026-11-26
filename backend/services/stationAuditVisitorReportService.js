const PDFDocument = require("pdfkit");
const { DateTime } = require("luxon");
const Location = require("../models/Location");
const User = require("../models/User");
const {
  StationAuditResponse,
  StationAuditRun,
  StationAuditVisitorReportDispatch,
} = require("../models/station-audits");
const { emailQueue } = require("../queues/emailQueue");

const REPORT_TO = "ana@gen7fuel.com";
const REPORT_CC = ["glenn@gen7fuel.com"];
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

const COLUMNS = [
  ["Checklist", 114], ["Category", 65], ["Frequency", 58],
  ["Status selected", 95], ["Comment posted", 157], ["Issue raised", 51],
];
const CELL_PADDING = 5;

function cellHeight(doc, value, width) {
  return doc.heightOfString(value, { width: width - CELL_PADDING * 2 });
}

function drawTableRow(doc, cells, { header = false, flagged = false } = {}) {
  doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9);
  const top = doc.y;
  const height = Math.ceil(Math.max(...cells.map((cell, index) =>
    cellHeight(doc, cell, COLUMNS[index][1])
  ))) + CELL_PADDING * 2;
  let x = 36;
  for (const [index, [, width]] of COLUMNS.entries()) {
    doc.rect(x, top, width, height)
      .fillAndStroke(header ? "#ede9fe" : flagged ? "#fee2e2" : "#ffffff", "#cbd5e1");
    doc.fillColor(flagged ? "#991b1b" : "#17243a")
      .text(cells[index], x + CELL_PADDING, top + CELL_PADDING, { width: width - CELL_PADDING * 2 });
    x += width;
  }
  doc.x = 36;
  doc.y = top + height;
}

function takeCellText(doc, value, width, available) {
  if (cellHeight(doc, value, width) <= available) return [value, ""];
  const characters = Array.from(value);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (cellHeight(doc, characters.slice(0, mid).join(""), width) <= available) low = mid;
    else high = mid - 1;
  }
  const prefix = characters.slice(0, low).join("");
  const wordEnd = prefix.search(/\s+\S*$/);
  const chunk = wordEnd > 0 ? prefix.slice(0, wordEnd) : prefix;
  return [chunk, value.slice(chunk.length).trimStart()];
}

function createVisitorReportPdf({ location, reportDate, visitor, sections }) {
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 42, bottom: 42, left: 36, right: 36 } });
  const complete = collectPdf(doc);
  const count = sections.reduce((total, section) => total + section.responses.length, 0);
  doc.fillColor("#4c1d95").font("Helvetica-Bold").fontSize(20).text("Visitor Audit Report");
  doc.moveDown(0.3).fillColor("#334155").fontSize(12).text(location.stationName || location.site || "Station");
  doc.font("Helvetica").fontSize(9).fillColor("#64748b")
    .text(`Visitor audit date: ${reportDate}`)
    .text(`Visitor: ${personName(visitor)}`)
    .text(`Checks completed: ${count}`).moveDown();

  const bySection = new Map();
  for (const entry of sections) {
    const key = String(entry.run.section);
    if (!bySection.has(key)) {
      bySection.set(key, { name: entry.run.sectionSnapshot?.name || "Audit section", entries: [] });
    }
    bySection.get(key).entries.push(entry);
  }
  const orderedSections = [...bySection.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, entries } of orderedSections) {
    const heading = (continued = false) => {
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#4c1d95")
        .text(continued ? `${name} (continued)` : name).moveDown(0.4);
      drawTableRow(doc, COLUMNS.map(([label]) => label), { header: true });
    };
    const nextPage = () => { doc.addPage(); heading(true); };
    ensureSpace(doc, 100);
    heading();
    entries.sort((a, b) => FREQUENCY_ORDER[a.run.frequency] - FREQUENCY_ORDER[b.run.frequency]);
    for (const { run, responses } of entries) {
      for (const response of responses) {
        const frequency = run.frequency[0].toUpperCase() + run.frequency.slice(1);
        const flagged = response.issueRaised === true;
        let cells = [
          response.checklistSnapshot?.item || "Checklist item",
          response.checklistSnapshot?.category || "—",
          frequency,
          response.selectedStatus?.label || "—",
          response.comment || "—",
          flagged ? "Yes" : "No",
        ];
        while (cells.some(Boolean)) {
          if (doc.page.maxY() - doc.y < 40) nextPage();
          doc.font("Helvetica").fontSize(9);
          const available = doc.page.maxY() - doc.y - CELL_PADDING * 2 - 1;
          const parts = cells.map((value, index) =>
            takeCellText(doc, value, COLUMNS[index][1], available)
          );
          drawTableRow(doc, parts.map(([chunk]) => chunk), { flagged });
          cells = parts.map(([, rest]) => rest);
          if (cells.some(Boolean)) nextPage();
        }
      }
    }
    doc.moveDown();
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

function groupVisitorSections(runs, responses) {
  const byRun = new Map(runs.map((run) => [String(run._id), { run, responses: [] }]));
  for (const response of responses) byRun.get(String(response.run)).responses.push(response);

  const byVisitor = new Map();
  for (const section of byRun.values()) {
    if (!section.responses.length) continue;
    const visitorId = String(section.run.startedBy);
    if (!byVisitor.has(visitorId)) byVisitor.set(visitorId, []);
    byVisitor.get(visitorId).push(section);
  }
  return byVisitor;
}

async function processLocation(location, requestedDate, now) {
  const reportDate = localReportDate(location, requestedDate, now);
  const range = localDayRange(reportDate, location.timezone);
  const runs = await StationAuditRun.find({
    site: location._id,
    type: "visitor",
    startedAt: { $lt: range.end },
    updatedAt: { $gte: range.start },
  }).lean();
  if (!runs.length) return { site: location._id, reportDate, status: "no-runs" };

  runs.sort((a, b) => FREQUENCY_ORDER[a.frequency] - FREQUENCY_ORDER[b.frequency]
    || (a.sectionSnapshot?.name || "").localeCompare(b.sectionSnapshot?.name || ""));
  const responses = await StationAuditResponse.find({
    run: { $in: runs.map((run) => run._id) },
    checked: true,
    checkedAt: { $gte: range.start, $lt: range.end },
  }).select("run checklistSnapshot selectedStatus issueRaised comment photos").sort({ checkedAt: 1, _id: 1 }).lean();
  if (!responses.length) return { site: location._id, reportDate, status: "no-runs" };

  const groups = groupVisitorSections(runs, responses);
  const runIds = [...new Set(responses.map((response) => String(response.run)))].sort();
  const dispatch = await acquireDispatch(location._id, reportDate, runIds);
  if (!dispatch) return { site: location._id, reportDate, status: "already-dispatched" };

  try {
    const visitors = await User.find({ _id: { $in: [...groups.keys()] } }).select("firstName lastName email").lean();
    const visitorsById = new Map(visitors.map((visitor) => [String(visitor._id), visitor]));
    const stationName = location.stationName || location.site || "Station";
    const safeSite = stationName.replace(/[^a-z0-9_-]+/gi, "_");
    const attachments = [];
    for (const [visitorId, sections] of groups) {
      const visitor = visitorsById.get(visitorId);
      const safeVisitor = personName(visitor).replace(/[^a-z0-9_-]+/gi, "_");
      const filename = `Visitor_Audit_${safeSite}_${reportDate}_${safeVisitor}_${attachments.length + 1}.pdf`;
      const content = await createVisitorReportPdf({ location, reportDate, visitor, sections });
      attachments.push({ filename, content, contentType: "application/pdf" });
    }
    const jobId = `station-audit-visitor-report-${location._id}-${reportDate}`;
    const job = await emailQueue.add("sendStationAuditVisitorReport", {
      to: REPORT_TO,
      cc: REPORT_CC,
      subject: `Visitor Audits Report - ${stationName}`,
      text: `Attached are the visitor audit results for ${stationName} on ${reportDate}, with one PDF per visitor.`,
      auditVisitorReportDispatchId: dispatch._id.toString(),
      attachments,
    }, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
    await StationAuditVisitorReportDispatch.updateOne(
      { _id: dispatch._id, status: "generating" },
      { $set: { status: "queued", queuedAt: new Date(), emailJobId: String(job.id), lastError: "" } }
    );
    return {
      site: location._id, reportDate, status: "queued",
      runs: runIds.length, visitors: attachments.length,
      filenames: attachments.map(({ filename }) => filename),
    };
  } catch (error) {
    await StationAuditVisitorReportDispatch.updateOne(
      { _id: dispatch._id, status: "generating" },
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
