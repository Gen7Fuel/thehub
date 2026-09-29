const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const JSZip = require('jszip');

// Retrieve already registered model from Mongoose registry, or require file if not yet registered
const Location = require('../models/Location');
const { processInfonetReport } = require('../utils/flattenInfonetReport');
const { generateAdminFeePdfReports } = require('../utils/generateInfonetAdminFeeByClientReport');
const { generateInfonetPdfReports } = require('../utils/generateInfonetByClientReport');
const { formatReportSiteName } = require('../utils/siteDisplayName');
const { emailQueue } = require('../queues/emailQueue'); // Update to match your queue import path

// Configure multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });
const Transaction = require("../models/Transactions");
const { CashSummary } = require('../models/CashSummaryNew');
const {
  normalizeCustomerName,
  generateArCustomerReportPdf,
  generateArPaidReportPdf
} = require('../utils/generateArCustomerReportPdf');
// Import your refactored PDF generator helpers
const {
  fetchEodDataForDate,
  combineEodData,
  generateEodReportBuffer
} = require('../utils/eodReportWavers');

const {
  fetchChickenDelightEodDataForDate,
  combineChickenDelightEodData,
  generateChickenDelightEodReportBuffer
} = require('../utils/eodCDReportWavers'); //Path to your Chicken Delight helper module

/**
 * Helper to generate a date array (YYYY-MM-DD) between startStr and endStr inclusive.
 */
function getDateRange(startStr, endStr) {
  const dates = [];
  let current = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
/**
 * Helper to convert a Buffer, Stream, or Base64 string to a pure Base64 string.
 */
async function attachmentContentToBase64(content) {
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content.pipe === 'function') {
    return new Promise((resolve, reject) => {
      const chunks = [];
      content.on('data', (chunk) => chunks.push(chunk));
      content.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      content.on('error', reject);
    });
  }
  throw new Error('Unsupported attachment content format.');
}

/**
 * Helper to generate an Excel sheet from flattening report data array.
 */
async function generateExcelBuffer(rows, sheetName = 'Data') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (rows && rows.length > 0) {
    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length + 5, 15)
    }));

    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
  }

  return await workbook.xlsx.writeBuffer();
}

router.post('/infonet-reports', upload.single('file'), async (req, res) => {
  try {
    const { site, adminFee, provinceStatusDiscount } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Excel file is required.' });
    }

    if (!site) {
      return res.status(400).json({ error: 'Site parameter is required.' });
    }

    // 1. Resolve Site Display Name using helper utility
    const siteDisplayName = formatReportSiteName(site);

    // 2. Fetch Location details & split address
    const locationDoc = await Location.findOne({
      $or: [
        { site: site },
        { stationName: new RegExp(`^${site}$`, 'i') }
      ]
    });

    let addressLine1 = '';
    let addressLine2 = '';

    if (locationDoc && locationDoc.address) {
      const fullAddress = locationDoc.address.trim();
      const commaIndex = fullAddress.indexOf(',');

      if (commaIndex !== -1) {
        addressLine1 = fullAddress.substring(0, commaIndex).trim();
        addressLine2 = fullAddress.substring(commaIndex + 1).trim();
      } else {
        addressLine1 = fullAddress;
        addressLine2 = locationDoc.province || '';
      }
    }

    // 3. Parse & flatten Excel file
    const flattenData = await processInfonetReport(file.buffer);

    if (!flattenData || flattenData.length === 0) {
      return res.status(400).json({ error: 'Failed to process file or file contains no data.' });
    }

    // 4. Extract Date Range from flattened entries
    const dates = flattenData
      .map((item) => item.Date || item.date || item['Transaction Date'])
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));

    let dateRangeStr = '';
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
      dateRangeStr = minDate === maxDate ? ` (${minDate})` : ` (${minDate} to ${maxDate})`;
    }

    // 5. Generate Admin Fee PDF Reports & tracked adjusted transactions
    const { pdfReports: adminFeePdfs, adjustedTransactions } = await generateAdminFeePdfReports(
      site,
      adminFee,
      provinceStatusDiscount,
      flattenData,
      addressLine1,
      addressLine2
    );

    // 6. Generate Standard Infonet Grade PDF Reports
    const infonetPdfs = await generateInfonetPdfReports(
      site,
      flattenData,
      addressLine1,
      addressLine2
    );

    // 7. Build raw attachments array (4 total attachments)
    const attachments = [];

    // Attachment 1: Combined Admin Fee PDF
    adminFeePdfs.forEach((report) => {
      attachments.push({
        filename: report.fileName,
        content: report.buffer,
        contentType: 'application/pdf'
      });
    });

    // Attachment 2: Combined Infonet PDF
    infonetPdfs.forEach((report) => {
      attachments.push({
        filename: report.fileName,
        content: report.buffer,
        contentType: 'application/pdf'
      });
    });

    // Attachment 3: Original Uploaded Excel File
    attachments.push({
      filename: `Infonet_Original_${siteDisplayName}.xlsx`,
      content: file.buffer,
      contentType: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Attachment 4: Adjusted Transactions Excel (if adjustments exist)
    if (adjustedTransactions && adjustedTransactions.length > 0) {
      const adjustedExcelBuffer = await generateExcelBuffer(adjustedTransactions, 'Adjustments');
      attachments.push({
        filename: `Adjusted_Transactions_${siteDisplayName}.xlsx`,
        content: adjustedExcelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    // 8. Serialize attachments to base64
    const serializedAttachments = await Promise.all(
      attachments.map(async (att) => ({
        filename: att.filename,
        content: await attachmentContentToBase64(att.content),
        encoding: 'base64',
        contentType: att.contentType
      }))
    );

    // 9. Queue the email task to req.user.email
    const recipientEmail = req.user && req.user.email ? req.user.email : 'daksh@gen7fuel.com';
    const emailSubject = `Infonet & Admin Fee Reports – ${siteDisplayName}${dateRangeStr}`;

    await emailQueue.add('sendInfonetReportEmail', {
      to: recipientEmail,
      subject: emailSubject,
      text: `Hello,\n\nAttached are the requested Infonet and Admin Fee reports along with data extracts for ${siteDisplayName} for the period ${dateRangeStr}.\n\nTotal Adjustments Made: ${adjustedTransactions.length}\n\nBest regards,\nGen7 Fuel Automated System`,
      attachments: serializedAttachments
    });

    return res.status(200).json({
      success: true,
      message: `Infonet reports generated and queued to be emailed to ${recipientEmail}`,
      adjustedCount: adjustedTransactions.length,
      reportsGenerated: attachments.length
    });

  } catch (error) {
    console.error('Error generating Infonet reports:', error);
    return res.status(500).json({
      error: 'Failed to process and generate Infonet reports.',
      details: error.message
    });
  }
});

/**
 * POST /eod-reports/cumulative
 * Body parameters:
 *  - stationName (string, required)
 *  - startDate (string YYYY-MM-DD, required)
 *  - endDate (string YYYY-MM-DD, required)
 *  - includeIndividualReports (boolean, optional, default: false)
 */
router.post('/eod-reports/cumulative', async (req, res) => {
  try {
    const {
      stationName,
      startDate,
      endDate,
      includeIndividualReports = false,
      includeChickenDelight = false
    } = req.body;

    // 1. Validation
    if (!stationName || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Parameters "stationName", "startDate", and "endDate" are required.'
      });
    }

    // 2. Fetch Location to determine isManitoba flag
    const locationDoc = await Location.findOne({
      $or: [
        { stationName: new RegExp(`^${stationName}$`, 'i') },
        { site: stationName }
      ]
    });

    if (!locationDoc) {
      return res.status(404).json({ error: `Location not found for station: ${stationName}` });
    }

    const isManitoba = (locationDoc.province || '').trim().toLowerCase() === 'manitoba';
    const site = locationDoc.stationName || locationDoc.site;
    const siteDisplayName = formatReportSiteName(site);

    // 3. Process Date Range
    const dates = getDateRange(startDate, endDate);
    if (dates.length === 0) {
      return res.status(400).json({ error: 'Invalid date range provided.' });
    }

    const dailyDataList = [];
    const individualPdfs = [];

    const cdDailyDataList = [];
    const cdIndividualPdfs = [];

    // 4. Fetch daily data & conditionally generate individual PDF buffers
    for (const date of dates) {
      // Regular EOD Data
      const dailyData = await fetchEodDataForDate({ site, date, isManitoba });
      dailyDataList.push(dailyData);

      if (includeIndividualReports) {
        const pdfBuffer = await generateEodReportBuffer({ site, date, data: dailyData });
        individualPdfs.push({
          date,
          fileName: `End-of-Day-Report-${siteDisplayName}-${date}.pdf`,
          buffer: pdfBuffer
        });
      }

      // Chicken Delight EOD Data (if flag is active)
      if (includeChickenDelight) {
        const cdDailyData = await fetchChickenDelightEodDataForDate({ site, date });
        cdDailyDataList.push(cdDailyData);

        if (includeIndividualReports) {
          const cdPdfBuffer = await generateChickenDelightEodReportBuffer({
            site,
            date,
            data: cdDailyData
          });
          cdIndividualPdfs.push({
            date,
            fileName: `Chicken-Delight-EOD-${siteDisplayName}-${date}.pdf`,
            buffer: cdPdfBuffer
          });
        }
      }
    }

    // 5. Generate Cumulative PDFs
    const cumulativeDateLabel = `${startDate} to ${endDate}`;

    // 5a. Standard Cumulative EOD PDF
    const cumulativeData = combineEodData(dailyDataList);
    const cumulativePdfBuffer = await generateEodReportBuffer({
      site,
      date: cumulativeDateLabel,
      data: cumulativeData
    });

    // 6. Build Attachments Array
    const attachments = [];

    // Attach Standard Cumulative PDF
    const cumulativeFileName = `${siteDisplayName}_CUMULATIVE_${startDate}_to_${endDate}.pdf`;
    attachments.push({
      filename: cumulativeFileName,
      content: cumulativePdfBuffer,
      contentType: 'application/pdf'
    });

    // 5b. Chicken Delight Cumulative EOD PDF (if requested)
    if (includeChickenDelight) {
      const cdCumulativeData = combineChickenDelightEodData(cdDailyDataList);
      const cdCumulativePdfBuffer = await generateChickenDelightEodReportBuffer({
        site,
        date: cumulativeDateLabel,
        data: cdCumulativeData
      });

      const cdCumulativeFileName = `Chicken-Delight-EOD-${siteDisplayName}_CUMULATIVE_${startDate}_to_${endDate}.pdf`;
      attachments.push({
        filename: cdCumulativeFileName,
        content: cdCumulativePdfBuffer,
        contentType: 'application/pdf'
      });
    }

    // Attach Standard Individual Reports Zip (if requested)
    if (includeIndividualReports && individualPdfs.length > 0) {
      const zip = new JSZip();
      individualPdfs.forEach((report) => {
        zip.file(report.fileName, report.buffer);
      });

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      attachments.push({
        filename: `Individual_EOD_Reports_${siteDisplayName}_${startDate}_to_${endDate}.zip`,
        content: zipBuffer,
        contentType: 'application/zip'
      });
    }

    // Attach Chicken Delight Individual Reports Zip (if both flags are requested)
    if (includeChickenDelight && includeIndividualReports && cdIndividualPdfs.length > 0) {
      const cdZip = new JSZip();
      cdIndividualPdfs.forEach((report) => {
        cdZip.file(report.fileName, report.buffer);
      });

      const cdZipBuffer = await cdZip.generateAsync({ type: 'nodebuffer' });
      attachments.push({
        filename: `Individual_Chicken_Delight_EOD_Reports_${siteDisplayName}_${startDate}_to_${endDate}.zip`,
        content: cdZipBuffer,
        contentType: 'application/zip'
      });
    }

    // 7. Serialize attachments to base64
    const serializedAttachments = await Promise.all(
      attachments.map(async (att) => ({
        filename: att.filename,
        content: await attachmentContentToBase64(att.content),
        encoding: 'base64',
        contentType: att.contentType
      }))
    );

    // 8. Queue Email Task
    const recipientEmail = req.user && req.user.email ? req.user.email : 'daksh@gen7fuel.com';
    const emailSubject = `End of Day Reports – ${siteDisplayName} (${startDate} to ${endDate})`;

    await emailQueue.add('sendEodReportEmail', {
      to: recipientEmail,
      subject: emailSubject,
      text: `Hello,\n\nAttached are the requested End of Day reports for ${siteDisplayName} covering the period ${startDate} to ${endDate}.\n\nBest regards,\nGen7 Fuel Automated System`,
      attachments: serializedAttachments
    });

    // 9. Return Response
    return res.status(200).json({
      success: true,
      message: `The generated reports have been queued and will be emailed directly to ${recipientEmail} shortly.`,
      site,
      isManitoba,
      dateRange: { startDate, endDate }
    });

  } catch (error) {
    console.error('Error generating EOD cumulative report:', error);
    return res.status(500).json({
      error: 'Failed to generate EOD cumulative report.',
      details: error.message
    });
  }
});

/**
 * POST /api/accounting-reports/ar-customer-report
 * Body parameters:
 *  - stationName (string, required)
 *  - startDate (string YYYY-MM-DD, required)
 *  - endDate (string YYYY-MM-DD, required)
 *  - includeArPaidReport (boolean, optional)
 */
router.post('/ar-customer-report', async (req, res) => {
  try {
    const {
      stationName,
      startDate,
      endDate,
      includeArPaidReport = false
    } = req.body;

    // 1. Parameter Validation
    if (!stationName || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Parameters "stationName", "startDate", and "endDate" are required.'
      });
    }

    // 2. Fetch Location
    const locationDoc = await Location.findOne({
      $or: [
        { stationName: new RegExp(`^${stationName}$`, 'i') },
        { site: stationName }
      ]
    });

    if (!locationDoc) {
      return res.status(404).json({ error: `Location not found for station: ${stationName}` });
    }

    const site = locationDoc.stationName || locationDoc.site;
    const siteDisplayName = formatReportSiteName(site);

    const startBoundary = new Date(`${startDate}T00:00:00.000Z`);
    const endBoundary = new Date(`${endDate}T23:59:59.999Z`);

    // 3. Query A/R Transactions
    const transactions = await Transaction.find({
      $or: [{ stationName: site }, { site: site }],
      date: { $gte: startBoundary, $lte: endBoundary },
      deletedAt: null
    })
      .sort({ customerName: 1, date: 1 })
      .lean();

    // 4. Group A/R Transactions by Customer
    const customerMap = {};
    transactions.forEach((trx) => {
      const rawName = (trx.customerName || 'Unknown Customer').trim();
      const normalizedKey = normalizeCustomerName(rawName);

      if (!customerMap[normalizedKey]) {
        customerMap[normalizedKey] = {
          customerName: rawName,
          items: [],
          totalAmount: 0,
          count: 0
        };
      }

      customerMap[normalizedKey].items.push(trx);
      customerMap[normalizedKey].totalAmount += trx.amount || 0;
      customerMap[normalizedKey].count += 1;
    });

    const groupedData = Object.values(customerMap).sort((a, b) =>
      a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' })
    );

    // 5. Generate Main A/R Transactions PDF Buffer
    const pdfBuffer = await generateArCustomerReportPdf({
      siteDisplayName,
      startDate,
      endDate,
      groupedData
    });

    // 6. Build Attachments Array
    const attachments = [];
    const mainReportFileName = `AR_Customer_Transactions_${siteDisplayName}_${startDate}_to_${endDate}.pdf`;

    attachments.push({
      filename: mainReportFileName,
      content: await attachmentContentToBase64(pdfBuffer),
      encoding: 'base64',
      contentType: 'application/pdf'
    });

    // 7. Process A/R Paid Report (CashSummary Data) if flag is active
    if (includeArPaidReport) {
      const paidRecords = await CashSummary.find({
        $or: [{ site: site }, { stationName: site }],
        date: { $gte: startBoundary, $lte: endBoundary },
        'arCustomers.paid': { $exists: true, $ne: null, $gt: 0 }
      })
        .sort({ date: 1, shift_number: 1 })
        .lean();

      const paidCustomerMap = {};

      paidRecords.forEach((doc) => {
        const formattedDate = doc.date ? new Date(doc.date).toISOString().split('T')[0] : 'N/A';

        if (Array.isArray(doc.arCustomers)) {
          doc.arCustomers.forEach((cust) => {
            if (cust.paid !== null && cust.paid !== undefined && cust.paid > 0) {
              const rawName = (cust.name || 'Unknown Customer').trim();
              const normalizedKey = normalizeCustomerName(rawName);

              if (!paidCustomerMap[normalizedKey]) {
                paidCustomerMap[normalizedKey] = {
                  customerName: rawName,
                  items: [],
                  totalAmount: 0,
                  count: 0
                };
              }

              paidCustomerMap[normalizedKey].items.push({
                date: formattedDate,
                shift_number: doc.shift_number || '',
                name: rawName,
                paid: cust.paid
              });

              paidCustomerMap[normalizedKey].totalAmount += cust.paid || 0;
              paidCustomerMap[normalizedKey].count += 1;
            }
          });
        }
      });

      const groupedPaidData = Object.values(paidCustomerMap).sort((a, b) =>
        a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' })
      );

      // Generate A/R Paid Report PDF
      const paidPdfBuffer = await generateArPaidReportPdf({
        siteDisplayName,
        startDate,
        endDate,
        groupedData: groupedPaidData
      });

      const paidReportFileName = `AR_Customer_Paid_Report_${siteDisplayName}_${startDate}_to_${endDate}.pdf`;

      attachments.push({
        filename: paidReportFileName,
        content: await attachmentContentToBase64(paidPdfBuffer),
        encoding: 'base64',
        contentType: 'application/pdf'
      });
    }

    // 8. Queue Email Task
    const recipientEmail = req.user && req.user.email ? req.user.email : 'daksh@gen7fuel.com';
    const emailSubject = `A/R Customer Reports – ${siteDisplayName} (${startDate} to ${endDate})`;

    await emailQueue.add('sendArCustomerReportEmail', {
      to: recipientEmail,
      subject: emailSubject,
      text: `Hello,\n\nAttached is the requested Accounts Receivable Customer Report package for ${siteDisplayName} covering the period ${startDate} to ${endDate}.\n\nBest regards,\nGen7 Fuel Automated System`,
      attachments
    });

    // 9. Return Response
    return res.status(200).json({
      success: true,
      message: `The generated A/R report package has been queued and will be emailed directly to ${recipientEmail} shortly.`,
      site,
      dateRange: { startDate, endDate },
      includedArPaidReport: includeArPaidReport
    });

  } catch (error) {
    console.error('Error generating A/R customer report package:', error);
    return res.status(500).json({
      error: 'Failed to generate A/R customer report package.',
      details: error.message
    });
  }
});

module.exports = router;
// router.post('/infonet-reports', upload.single('file'), async (req, res) => {
//   try {
//     const { site, adminFee, provinceStatusDiscount } = req.body;
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({ error: 'Excel file is required.' });
//     }

//     if (!site) {
//       return res.status(400).json({ error: 'Site parameter is required.' });
//     }

//     // 1. Fetch Location details & split address
//     const locationDoc = await Location.findOne({
//       $or: [
//         { site: site },
//         { stationName: new RegExp(`^${site}$`, 'i') }
//       ]
//     });

//     let addressLine1 = '';
//     let addressLine2 = '';

//     if (locationDoc && locationDoc.address) {
//       const fullAddress = locationDoc.address.trim();
//       const commaIndex = fullAddress.indexOf(',');

//       if (commaIndex !== -1) {
//         addressLine1 = fullAddress.substring(0, commaIndex).trim();
//         addressLine2 = fullAddress.substring(commaIndex + 1).trim();
//       } else {
//         addressLine1 = fullAddress;
//         addressLine2 = locationDoc.province || '';
//       }
//     }

//     // 2. Parse & flatten Excel file
//     const flattenData = await processInfonetReport(file.buffer);

//     if (!flattenData || flattenData.length === 0) {
//       return res.status(400).json({ error: 'Failed to process file or file contains no data.' });
//     }

//     // 3. Generate Admin Fee PDF Reports & tracked adjusted transactions
//     const { pdfReports: adminFeePdfs, adjustedTransactions } = await generateAdminFeePdfReports(
//       site,
//       adminFee,
//       provinceStatusDiscount,
//       flattenData,
//       addressLine1,
//       addressLine2
//     );

//     // 4. Generate Standard Infonet Grade PDF Reports
//     const infonetPdfs = await generateInfonetPdfReports(
//       site,
//       flattenData,
//       addressLine1,
//       addressLine2
//     );

//     // 5. Build raw attachments array (PDFs + Excel sheets)
//     const attachments = [];

//     // Add Admin Fee PDFs
//     adminFeePdfs.forEach((report) => {
//       attachments.push({
//         filename: report.fileName,
//         content: report.buffer,
//         contentType: 'application/pdf'
//       });
//     });

//     // Add Standard Infonet PDFs
//     infonetPdfs.forEach((report) => {
//       attachments.push({
//         filename: report.fileName,
//         content: report.buffer,
//         contentType: 'application/pdf'
//       });
//     });

//     // Generate Excel attachment for Raw Flattened Data
//     const flattenExcelBuffer = await generateExcelBuffer(flattenData, 'Flattened Data');
//     attachments.push({
//       filename: `Infonet_Flattened_Data_${site}.xlsx`,
//       content: flattenExcelBuffer,
//       contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     });

//     // Generate Excel attachment for Adjusted Transactions (if any)
//     if (adjustedTransactions && adjustedTransactions.length > 0) {
//       const adjustedExcelBuffer = await generateExcelBuffer(adjustedTransactions, 'Adjustments');
//       attachments.push({
//         filename: `Adjusted_Transactions_${site}.xlsx`,
//         content: adjustedExcelBuffer,
//         contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//       });
//     }

//     // 6. Serialize attachments to base64
//     const serializedAttachments = await Promise.all(
//       attachments.map(async (att) => ({
//         filename: att.filename,
//         content: await attachmentContentToBase64(att.content),
//         encoding: 'base64',
//         contentType: att.contentType
//       }))
//     );

//     // 7. Queue the email task to req.user.email
//     const recipientEmail = req.user && req.user.email ? req.user.email : 'daksh@gen7fuel.com';

//     await emailQueue.add('sendInfonetReportEmail', {
//       to: recipientEmail,
//       subject: `Infonet & Admin Fee Reports – ${site.toUpperCase()}`,
//       text: `Hello,\n\nAttached are the requested Infonet and Admin Fee reports along with data extracts for ${site}.\n\nTotal Adjustments Made: ${adjustedTransactions.length}\n\nBest regards,\nGen7 Fuel Automated System`,
//       attachments: serializedAttachments
//     });

//     return res.status(200).json({
//       success: true,
//       message: `Infonet reports generated and queued to be emailed to ${recipientEmail}`,
//       adjustedCount: adjustedTransactions.length,
//       reportsGenerated: attachments.length
//     });

//   } catch (error) {
//     console.error('Error generating Infonet reports:', error);
//     return res.status(500).json({
//       error: 'Failed to process and generate Infonet reports.',
//       details: error.message
//     });
//   }
// });

// module.exports = router;