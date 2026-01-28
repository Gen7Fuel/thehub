const cron = require("node-cron");
const { emailQueue } = require("../queues/emailQueue");
const AuditItem = require('../models/audit/auditItem');
const AuditInstance = require('../models/audit/auditInstance');
const AuditTemplate = require('../models/audit/auditTemplate');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);


/**
 * Normalizes periodKey based on your generator logic
 */
function normalizePeriod(key, frequency) {
  if (!key) return null;
  try {
    // Daily: "2025-11-20" -> "Nov 20, 2025"
    if (frequency === "daily") {
      return dayjs(key).format('MMM D, YYYY');
    }

    // Weekly: "2025-W47" -> "Nov 17 - Nov 23, 2025"
    if (frequency === "weekly") {
      const [year, weekPart] = key.split('-W');
      const weekNum = parseInt(weekPart);
      // Using dayjs to find the start of that specific week number
      const startOfWeek = dayjs().year(year).isoWeek(weekNum).startOf('isoWeek');
      const endOfWeek = startOfWeek.endOf('isoWeek');
      return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D, YYYY')}`;
    }

    // Monthly: "2025-11" -> "November 2025"
    if (frequency === "monthly") {
      return dayjs(key).format('MMMM YYYY');
    }

    return key;
  } catch (e) {
    return key;
  }
}
/**
 * Generates data for the previous calendar month based on periodKey
 */
async function generateAuditIssueReport() {
  // 1. Calculate the previous month's string identifier (e.g., "2026-01")
  const startOfPrevMonth = dayjs().subtract(1, 'month').startOf('month');
  const endOfPrevMonth = dayjs().subtract(1, 'month').endOf('month');
  const monthLabel = startOfPrevMonth.format('MMMM YYYY');

  const items = await AuditItem.find({ issueRaised: true })
    .populate({
      path: 'instance',
      match: {
        type: { $ne: 'visitor' },
        // Filter by the date the audit was actually finished
        completedAt: {
          $gte: startOfPrevMonth.toDate(),
          $lte: endOfPrevMonth.toDate()
        }
      },
      populate: { path: 'template', select: 'name' }
    })
    .lean();
  // 3. Filter out items that didn't match the instance criteria (visitor or wrong month)
  const filteredItems = items.filter(item => item && item.instance);

  let reportData = filteredItems.map(item => {
    const statusArray = item.issueStatus || [];

    const getStatusTime = (name) => {
      const entry = statusArray.find(s => s.status === name);
      return entry ? entry.timestamp : null;
    };

    return {
      site: item.instance.site || null,
      template: item.instance.template?.name || 'N/A',
      periodKey: item.instance.periodKey,
      displayPeriod: normalizePeriod(item.instance.periodKey, item.instance.frequency),
      frequency: item.instance.frequency || null,
      itemName: item.item || null,
      category: item.category || null,
      assignedTo: item.assignedTo || null,
      currentStatus: item.currentIssueStatus || 'Unknown',
      originalComment: item.comment || null,
      raisedAt: getStatusTime('Created') || item.checkedAt,
      inProgressAt: getStatusTime('In Progress') || null,
      resolvedAt: getStatusTime('Resolved') || null,
    };
  });

  // Custom Sort Logic: Site -> Frequency -> PeriodKey
  const freqOrder = { daily: 1, weekly: 2, monthly: 3 };
  reportData.sort((a, b) => {
    if (a.site !== b.site) return a.site.localeCompare(b.site);
    if (freqOrder[a.frequency] !== freqOrder[b.frequency]) {
      return freqOrder[a.frequency] - freqOrder[b.frequency];
    }
    return a.periodKey.localeCompare(b.periodKey);
  });

  return {
    data: reportData,
    monthLabel: monthLabel
  };
}

async function processAndSendReport() {
  // Get the data and the month label for the email subject
  const { data, monthLabel } = await generateAuditIssueReport();

  if (data.length === 0) {
    console.log(`No audit issues found for ${monthLabel}. Skipping email.`);
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Audit Issues Report');

  worksheet.columns = [
    { header: 'Store/Site', key: 'site', width: 15 },
    { header: 'Item Name', key: 'itemName', width: 30 },
    { header: 'Frequency', key: 'frequency', width: 12 },
    { header: 'Period', key: 'displayPeriod', width: 25 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Assigned To', key: 'assignedTo', width: 20 },
    { header: 'Current Status', key: 'currentStatus', width: 15 },
    { header: 'Raised At (Created)', key: 'raisedAt', width: 22 },
    { header: 'In Progress At', key: 'inProgressAt', width: 22 },
    { header: 'Resolved At', key: 'resolvedAt', width: 22 },
    { header: 'Comments', key: 'originalComment', width: 40 },
  ];

  const dateStyle = { numFmt: 'yyyy-mm-dd hh:mm:ss' };
  ['raisedAt', 'inProgressAt', 'resolvedAt'].forEach(colKey => {
    worksheet.getColumn(colKey).style = dateStyle;
  });

  worksheet.addRows(data);
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Audit_Issues_Report_${monthLabel.replace(' ', '_')}.xlsx`;

  if (process.env.HOST === "VPS") {
    await emailQueue.add("sendAuditIssueReport", {
      to: "ana@gen7fuel.com",
      cc: ["daksh@gen7fuel.com"],
      subject: `Monthly Audit Issues & Resolutions - ${monthLabel}`,
      text: `Attached is the comprehensive audit issue report for ${monthLabel}.`,
      html: `<p>Please find attached the audit issue report for <b>${monthLabel}</b>, containing all raised and resolved issues from store audits.</p>`,
      attachments: [
        {
          filename: fileName,
          content: buffer.toString('base64'),
          encoding: 'base64'
        }
      ]
    });
  } else {
      console.log("Skipping email - not running on VPS host.");
  }

  return true;
}

// --- CRON SCHEDULE ---
// Runs at 10:00 UTC (6 AM ET) on the 1st day of every month
cron.schedule("0 10 1 * *", () => {
  console.log("Triggering Monthly Audit Issue Report...");
  processAndSendReport();
});

module.exports = { processAndSendReport };

