const connectDB = require('../config/db');
const mongoose = require('mongoose');
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

async function generateAuditIssueReport() {
    const items = await AuditItem.find({ issueRaised: true })
        .populate({
            path: 'instance',
            match: { type: { $ne: 'visitor' } },
            populate: { path: 'template', select: 'name' }
        })
        .lean();

    const filteredItems = items.filter(item => item && item.instance);

    let reportData = filteredItems.map(item => {
        const statusArray = item.issueStatus || [];
        
        // Helper to find status by exact string match from your reference
        const getStatusTime = (name) => {
            const entry = statusArray.find(s => s.status === name);
            return entry ? entry.timestamp : null;
        };

        return {
            site: item.instance.site || null,
            template: item.instance.template?.name || 'N/A',
            periodKey: item.instance.periodKey, // Kept for sorting
            displayPeriod: normalizePeriod(item.instance.periodKey, item.instance.frequency),
            frequency: item.instance.frequency || null,
            itemName: item.item || null,
            category: item.category || null,
            assignedTo: item.assignedTo || null,
            currentStatus: item.currentIssueStatus || 'Unknown',
            originalComment: item.comment || null,
            // Updated keys based on your status reference
            raisedAt: getStatusTime('Created') || item.checkedAt, 
            inProgressAt: getStatusTime('In Progress') || null,
            resolvedAt: getStatusTime('Resolved') || null,
        };
    });

    // Custom Sort Logic
    const freqOrder = { daily: 1, weekly: 2, monthly: 3 };

    reportData.sort((a, b) => {
        // 1. Sort by Site
        if (a.site !== b.site) return a.site.localeCompare(b.site);
        
        // 2. Sort by Frequency Order (Daily > Weekly > Monthly)
        if (freqOrder[a.frequency] !== freqOrder[b.frequency]) {
            return freqOrder[a.frequency] - freqOrder[b.frequency];
        }

        // 3. Sort by PeriodKey (2025-11-20 vs 2025-11-21)
        return a.periodKey.localeCompare(b.periodKey);
    });

    return reportData;
}

// async function processAndSendReport() {
//     const data = await generateAuditIssueReport();
    
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Audit Issues Report');

//     worksheet.columns = [
//         { header: 'Store/Site', key: 'site', width: 15 },
//         { header: 'Frequency', key: 'frequency', width: 12 },
//         { header: 'Period', key: 'displayPeriod', width: 25 },
//         { header: 'Item Name', key: 'itemName', width: 30 },
//         { header: 'Category', key: 'category', width: 20 },
//         { header: 'Assigned To', key: 'assignedTo', width: 20 },
//         { header: 'Current Status', key: 'currentStatus', width: 15 },
//         { header: 'Raised At (Created)', key: 'raisedAt', width: 22 },
//         { header: 'In Progress At', key: 'inProgressAt', width: 22 },
//         { header: 'Resolved At', key: 'resolvedAt', width: 22 },
//         { header: 'Comments', key: 'originalComment', width: 40 },
//     ];

//     // Ensure date columns are formatted correctly for Excel
//     const dateStyle = { numFmt: 'yyyy-mm-dd hh:mm:ss' };
//     ['raisedAt', 'inProgressAt', 'resolvedAt'].forEach(colKey => {
//         worksheet.getColumn(colKey).style = dateStyle;
//     });

//     worksheet.addRows(data);
//     worksheet.getRow(1).font = { bold: true };

//     const fileName = `Audit_Issues_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`;
//     const tempPath = path.join(__dirname, 'temp', fileName);
    
//     if (!fs.existsSync(path.join(__dirname, 'temp'))) {
//         fs.mkdirSync(path.join(__dirname, 'temp'));
//     }

//     await workbook.xlsx.writeFile(tempPath);

//     await emailQueue.add("sendAuditIssueReport", {
//         to: "ana@gen7fuel.com",
//         cc: "daksh@gen7fuel.com",
//         subject: `Audit Issues Resolution Report - ${dayjs().format('MMM D, YYYY')}`,
//         text: "Please find the attached report.",
//         html: "<p>Attached is the <b>Audit Issues Report</b> sorted by site and period frequency.</p>",
//         attachments: [{ filename: fileName, path: tempPath }]
//     });

//     return tempPath;
// }
async function processAndSendReport() {
    const data = await generateAuditIssueReport();
    
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

    // --- NEW LOGIC: BUFFER INSTEAD OF LOCAL FILE ---
    
    // Generate the Excel file as a Buffer (kept in RAM)
    const buffer = await workbook.xlsx.writeBuffer();
    
    const fileName = `Audit_Issues_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`;

    // Add to Email Queue using the 'content' property instead of 'path'
    await emailQueue.add("sendAuditIssueReport", {
        to: "ana@gen7fuel.com",
        cc: "daksh@gen7fuel.com",
        subject: `Audit Issues Resolution Report - ${dayjs().format('MMM D, YYYY')}`,
        text: "Please find the attached report.",
        html: "<p>Attached is the <b>Audit Issues Report</b> sorted by site and period frequency.</p>",
        attachments: [
            {
                filename: fileName,
                content: buffer.toString('base64'), // Attach the buffer as a base64 string
                encoding: 'base64'
            }
        ]
    });

    return true; // No file path to return anymore!
}

async function run() {
  let hadError = false;

  try {
    await connectDB(); // Assuming this is defined elsewhere
    console.log('Generating Audit Issues Excel Report...\n');

    const filePath = await processAndSendReport();
    
    console.log(`Report generated and queued for email: ${filePath}`);

  } catch (err) {
    hadError = true;
    console.error('Report Generation Failed:', err);
  } finally {
    // Keep a slight delay if you need to ensure file is read before disconnect, 
    // though Bull queue usually handles the path later.
    try { await mongoose.disconnect(); } catch {}
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
module.exports = { run };
