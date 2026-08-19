const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

// Retrieve already registered model from Mongoose registry, or require file if not yet registered
const Location = mongoose.models.Location || require('../models/location');
const { processInfonetReport } = require('../utils/flattenInfonetReport');
const { generateAdminFeePdfReports } = require('../utils/generateInfonetAdminFeeByClientReport');
const { generateInfonetPdfReports } = require('../utils/generateInfonetByClientReport');
const { formatReportSiteName } = require('../utils/siteDisplayName');
const { emailQueue } = require('../queues/emailQueue'); // Update to match your queue import path

// Configure multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

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

module.exports = router;