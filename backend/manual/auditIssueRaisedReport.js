const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { emailQueue } = require("../queues/emailQueue");
const AuditItem = require('../models/audit/auditItem');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function processAndSendReport() {
    const data = await generateAuditIssueReport();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Audit Issues Report');

    worksheet.columns = [
        { header: 'Item Name', key: 'itemName', width: 30 },
        { header: 'Store/Site', key: 'site', width: 15 },
        { header: 'Template', key: 'template', width: 20 },
        { header: 'Period', key: 'periodKey', width: 15 },
        { header: 'Frequency', key: 'frequency', width: 10 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Assigned To', key: 'assignedTo', width: 20 },
        { header: 'Current Status', key: 'currentStatus', width: 15 },
        { header: 'Raised At', key: 'raisedAt', width: 25 },
        { header: 'In Progress At', key: 'inProgressAt', width: 25 },
        { header: 'Resolved At', key: 'resolvedAt', width: 25 },
        { header: 'Comments', key: 'originalComment', width: 40 },
    ];

    worksheet.addRows(data);

    // Style the header
    worksheet.getRow(1).font = { bold: true };

    const fileName = `Audit_Issues_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, 'temp', fileName);
    
    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, 'temp'))) fs.mkdirSync(path.join(__dirname, 'temp'));

    await workbook.xlsx.writeFile(filePath);

    // Add to Email Queue
    await emailQueue.add("sendAuditIssueReport", {
        to: "daksh@gen7fuel.com",
        // cc: ["admin@example.com"],
        subject: `Audit Issues Resolution Report - ${new Date().toLocaleDateString()}`,
        text: "Please find the attached report detailing all raised and resolved audit issues.",
        html: "<p>Attached is the <b>Audit Issues Report</b> containing item details, store info, and resolution timestamps.</p>",
        attachments: [
            {
                filename: fileName,
                path: filePath
            }
        ]
    });

    return filePath;
}

async function generateAuditIssueReport() {
    // 1. Fetch AuditItems where an issue was raised
    // We populate 'instance' to filter by 'type' and get site details
    const items = await AuditItem.find({ issueRaised: true })
        .populate({
            path: 'instance',
            match: { type: { $ne: 'visitor' } }, // Filter out visitor audits
            populate: { path: 'template', select: 'name' } // Assuming template has a name field
        })
        .lean();

    // 2. Filter out items where the populated instance is null (because of the visitor filter)
    const filteredItems = items.filter(item => item.instance !== null);

    const reportData = filteredItems.map(item => {
        // Find specific timestamps from the issueStatus array
        const getStatusTime = (statusName) => {
            const entry = item.issueStatus.find(s => s.status === statusName);
            return entry ? entry.timestamp : null;
        };

        return {
            site: item.instance.site || null,
            template: item.instance.template?.name || 'N/A',
            periodKey: item.instance.periodKey || null,
            frequency: item.instance.frequency || null,
            itemName: item.item || null,
            category: item.category || null,
            assignedTo: item.assignedTo || null,
            currentStatus: item.currentIssueStatus || 'Unknown',
            originalComment: item.comment || null,
            // Timestamps
            raisedAt: getStatusTime('raised') || getStatusTime('open') || null,
            inProgressAt: getStatusTime('in-progress') || null,
            resolvedAt: getStatusTime('resolved') || null,
        };
    });

    return reportData;
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
