const PDFDocument = require('pdfkit');
const { formatReportSiteName } = require('./siteDisplayName');
const {
  formatCurrency,
  formatNumber,
  parseDateString,
  formatDateToHeaderString,
  formatDateToFileNameString
} = require('./generateInfonetAdminFeeByClientReport');

/**
 * Generates a single PDF report in memory supporting grouped fuel sections with subtotals and grand totals.
 * Returns a Promise resolving to a Buffer.
 */
function generateSinglePdfBuffer(groupedSections, reportTitle, siteDisplayName, addressLine1, addressLine2, dateFromStr, dateToStr) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 36, // 0.5 inch margins
      bufferPages: true
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Layout configuration
    const colX = {
      transNo: 36,
      statusNo: 81,
      name: 156,
      date: 276,
      product: 336,
      litres: 386,
      discount: 446,
      amount: 511
    };

    const colWidths = {
      transNo: 42,
      statusNo: 70,
      name: 115,
      date: 55,
      product: 45,
      litres: 55,
      discount: 60,
      amount: 60
    };

    // Header Renderer
    function renderHeader(currentPage, totalPages) {
      doc.font('Helvetica-Bold').fontSize(14).text(reportTitle.toUpperCase(), 36, 36, { underline: true });

      // Dynamic Address Headers
      let rightHeaderY = 36;
      doc.font('Helvetica-Bold').fontSize(8.5)
         .text((siteDisplayName || '').toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });

      if (addressLine1) {
        rightHeaderY += 11;
        doc.font('Helvetica').fontSize(8)
           .text(addressLine1.toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });
      }

      if (addressLine2) {
        rightHeaderY += 10;
        doc.font('Helvetica').fontSize(8)
           .text(addressLine2.toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });
      }

      // Page Numbers
      doc.font('Helvetica-Bold').fontSize(8.5)
         .text('PAGE', 520, 36, { align: 'right', width: 56 })
         .font('Helvetica')
         .text(`${currentPage} / ${totalPages}`, 520, 48, { align: 'right', width: 56 });

      let metaY = 65;
      doc.font('Helvetica-Bold').fontSize(8.5).text('FROM: ', 60, metaY, { continued: true })
         .font('Helvetica').text(dateFromStr);

      metaY += 12;
      doc.font('Helvetica-Bold').text('TO: ', 74, metaY, { continued: true })
         .font('Helvetica').text(dateToStr);

      metaY += 12;
      doc.font('Helvetica-Bold').text('PERIOD: ', 56, metaY, { continued: true })
         .font('Helvetica').text('DAILY');

      const tableHeaderY = 145;
      doc.lineWidth(1).strokeColor('#000000');
      doc.rect(36, tableHeaderY, 540, 18).stroke();

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('TRANS #', colX.transNo + 2, tableHeaderY + 4);
      doc.text('ACCOUNT #', colX.statusNo, tableHeaderY + 4);
      doc.text('NAME', colX.name, tableHeaderY + 4);
      doc.text('DATE', colX.date, tableHeaderY + 4);
      doc.text('PRODUCT', colX.product, tableHeaderY + 4);
      doc.text('LITRES', colX.litres, tableHeaderY + 4, { align: 'right', width: colWidths.litres });
      doc.text('DISCOUNT', colX.discount, tableHeaderY + 4, { align: 'right', width: colWidths.discount });
      doc.text('AMOUNT', colX.amount, tableHeaderY + 4, { align: 'right', width: colWidths.amount });

      return 168;
    }

    let y = 168;
    const pageHeight = 740;

    renderHeader(1, 1);

    // Grand Totals accumulators
    let grandLitres = 0;
    let grandDiscount = 0;
    let grandAmount = 0;

    const isMultiSection = groupedSections.length > 1;

    // Render Each Grade Section
    groupedSections.forEach((section) => {
      // Sort records within section by Status Number (Account #)
      section.records.sort((a, b) => (a.statusNo || '').localeCompare(b.statusNo || '', undefined, { numeric: true }));

      // Section Header (Only if multi-section)
      if (isMultiSection) {
        if (y + 20 > pageHeight) {
          doc.addPage();
          y = 168;
        }
        doc.font('Helvetica-Bold').fontSize(9).text(`GRADE: ${section.gradeName.toUpperCase()}`, colX.transNo + 2, y);
        y += 14;
      }

      let sectionLitres = 0;
      let sectionDiscount = 0;
      let sectionAmount = 0;

      // Draw Section Rows
      section.records.forEach((rec) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 168;
        }

        doc.font('Helvetica').fontSize(8);
        doc.text(rec.transactionNo, colX.transNo + 2, y);
        doc.text(rec.statusNo, colX.statusNo, y);
        doc.text(rec.name, colX.name, y, { width: colWidths.name, height: 10, ellipsis: true });
        doc.text(rec.date, colX.date, y);
        doc.text(rec.fuelType, colX.product, y);

        doc.text(formatNumber(rec.litres), colX.litres, y, { align: 'right', width: colWidths.litres });
        doc.text(formatCurrency(rec.taxExempt), colX.discount, y, { align: 'right', width: colWidths.discount });
        doc.text(formatCurrency(rec.saleAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

        sectionLitres += rec.litres;
        sectionDiscount += rec.taxExempt;
        sectionAmount += rec.saleAmount;

        y += 14;
      });

      // Accumulate to Grand Total
      grandLitres += sectionLitres;
      grandDiscount += sectionDiscount;
      grandAmount += sectionAmount;

      // Render Section Totals
      if (y + 25 > pageHeight) {
        doc.addPage();
        y = 168;
      }

      y += 2;
      doc.lineWidth(0.5).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
      y += 4;

      doc.font('Helvetica-Bold').fontSize(8.5);
      const totalLabel = isMultiSection ? `${section.gradeName.toUpperCase()} TOTAL:` : 'TOTALS:';
      doc.text(totalLabel, colX.name, y, { width: colX.litres - colX.name - 5, align: 'right' });
      doc.text(formatNumber(sectionLitres), colX.litres, y, { align: 'right', width: colWidths.litres });
      doc.text(formatCurrency(sectionDiscount), colX.discount, y, { align: 'right', width: colWidths.discount });
      doc.text(formatCurrency(sectionAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

      y += 12;
      doc.lineWidth(0.5).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
      y += 10;
    });

    // Render Grand Total if multiple sections exist
    if (isMultiSection) {
      if (y + 25 > pageHeight) {
        doc.addPage();
        y = 168;
      }

      y += 2;
      doc.lineWidth(1.5).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
      y += 5;

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('GRAND TOTAL:', colX.name, y, { width: colX.litres - colX.name - 5, align: 'right' });
      doc.text(formatNumber(grandLitres), colX.litres, y, { align: 'right', width: colWidths.litres });
      doc.text(formatCurrency(grandDiscount), colX.discount, y, { align: 'right', width: colWidths.discount });
      doc.text(formatCurrency(grandAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

      y += 12;
      doc.lineWidth(1.5).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
    }

    // Apply Page Numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      renderHeader(i + 1, range.count);
    }

    doc.end();
  });
}

/**
 * Generates a single dynamic Infonet PDF report grouped by fuel grade in memory.
 *
 * @param {string} site - Raw site identifier.
 * @param {Array<Object>} flattenData - Array of record objects produced by processInfonetReport.
 * @param {string} [addressLine1=''] - Primary site address line.
 * @param {string} [addressLine2=''] - Secondary site address line (City, Province, Postal Code).
 * @returns {Promise<Array<{ fileName: string, title: string, buffer: Buffer }>>}
 */
async function generateInfonetPdfReports(site, flattenData, addressLine1 = '', addressLine2 = '') {
  if (!Array.isArray(flattenData) || flattenData.length === 0) {
    throw new Error('No flatten data provided to generate PDF reports.');
  }

  const siteDisplayName = formatReportSiteName(site) || 'STORE REPORT';

  // 1. Calculate dynamic date bounds (FROM / TO)
  let minDate = null;
  let maxDate = null;

  flattenData.forEach(row => {
    const rawDate = row['Date'] || row['Date of Sale'] || '';
    const dObj = parseDateString(rawDate);
    if (dObj) {
      if (!minDate || dObj < minDate) minDate = dObj;
      if (!maxDate || dObj > maxDate) maxDate = dObj;
    }
  });

  const dateFromStr = formatDateToHeaderString(minDate);
  const dateToStr = formatDateToHeaderString(maxDate);

  const fileDateFromStr = formatDateToFileNameString(minDate);
  const fileDateToStr = formatDateToFileNameString(maxDate);
  const dateRangeSuffix = fileDateFromStr && fileDateToStr 
    ? ` - ${fileDateFromStr} to ${fileDateToStr}`
    : '';

  // 2. Map raw records cleanly without applying price adjustments
  const allProcessedRecords = flattenData.map(row => ({
    transactionNo: row['Transaction Number'] || row['Transactio Name'] || '',
    date: row['Date'] || row['Date of Sale'] || '',
    statusNo: row['Status Number'] || '',
    name: row['Purchasers Name'] || 'UNKNOWN',
    fuelType: (row['Type of Fuel'] || '').toString().toUpperCase(),
    litres: parseFloat(row['Litres Purchased']) || 0,
    taxExempt: parseFloat(row['Total Fuel Tax Exempt']) || 0,
    saleAmount: parseFloat(row['Total Sale Amount']) || 0
  }));

  // 3. Build grouped sections array for active fuel types in strict order (Regular, Diesel, Premium)
  const order = ['REGULAR', 'DIESEL', 'PREMIUM'];
  const groupedSectionsForCombined = [];

  order.forEach(grade => {
    const matchingRecords = allProcessedRecords.filter(r => r.fuelType === grade);
    if (matchingRecords.length > 0) {
      groupedSectionsForCombined.push({
        gradeName: grade,
        records: JSON.parse(JSON.stringify(matchingRecords))
      });
    }
  });

  // Include any unmatched grades under "OTHER" if present
  const knownGrades = new Set(order);
  const otherRecords = allProcessedRecords.filter(r => !knownGrades.has(r.fuelType));
  if (otherRecords.length > 0) {
    groupedSectionsForCombined.push({
      gradeName: 'OTHER',
      records: JSON.parse(JSON.stringify(otherRecords))
    });
  }

  const pdfReports = [];

  // 4. Generate Combined PDF report containing all non-empty sections
  if (groupedSectionsForCombined.length > 0) {
    const combinedBuffer = await generateSinglePdfBuffer(
      groupedSectionsForCombined,
      'INFONET REPORT BY CLIENT',
      siteDisplayName,
      addressLine1,
      addressLine2,
      dateFromStr,
      dateToStr
    );

    pdfReports.push({
      fileName: `Infonet Report by Client - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
      title: 'INFONET REPORT BY CLIENT',
      buffer: combinedBuffer
    });
  }

  return pdfReports;
}

module.exports = {
  generateInfonetPdfReports
};

// const PDFDocument = require('pdfkit');
// const { formatReportSiteName } = require('./siteDisplayName');
// const {
//   formatCurrency,
//   formatNumber,
//   parseDateString,
//   formatDateToHeaderString,
//   formatDateToFileNameString
// } = require('./generateInfonetAdminFeeByClientReport');

// /**
//  * Generates a single PDF report in memory for a given fuel type and returns a Promise resolving to a Buffer.
//  */
// function generateSinglePdfBuffer(processedRecords, reportTitle, siteDisplayName, addressLine1, addressLine2, dateFromStr, dateToStr) {
//   return new Promise((resolve, reject) => {
//     // Sort records by Status Number (Account #)
//     processedRecords.sort((a, b) => (a.statusNo || '').localeCompare(b.statusNo || '', undefined, { numeric: true }));

//     const doc = new PDFDocument({
//       size: 'LETTER',
//       margin: 36, // 0.5 inch margins
//       bufferPages: true
//     });

//     const buffers = [];
//     doc.on('data', buffers.push.bind(buffers));
//     doc.on('end', () => {
//       const pdfBuffer = Buffer.concat(buffers);
//       resolve(pdfBuffer);
//     });
//     doc.on('error', reject);

//     // Layout configuration
//     const colX = {
//       transNo: 36,
//       statusNo: 81,
//       name: 156,
//       date: 276,
//       product: 336,
//       litres: 386,
//       discount: 446,
//       amount: 511
//     };

//     const colWidths = {
//       transNo: 42,
//       statusNo: 70,
//       name: 115,
//       date: 55,
//       product: 45,
//       litres: 55,
//       discount: 60,
//       amount: 60
//     };

//     // Header Renderer
//     function renderHeader(currentPage, totalPages) {
//       doc.font('Helvetica-Bold').fontSize(14).text(reportTitle.toUpperCase(), 36, 36, { underline: true });

//       // Dynamic Address Headers
//       let rightHeaderY = 36;
//       doc.font('Helvetica-Bold').fontSize(8.5)
//          .text((siteDisplayName || '').toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });

//       if (addressLine1) {
//         rightHeaderY += 11;
//         doc.font('Helvetica').fontSize(8)
//            .text(addressLine1.toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });
//       }

//       if (addressLine2) {
//         rightHeaderY += 10;
//         doc.font('Helvetica').fontSize(8)
//            .text(addressLine2.toUpperCase(), 340, rightHeaderY, { align: 'right', width: 160 });
//       }

//       // Page Numbers
//       doc.font('Helvetica-Bold').fontSize(8.5)
//          .text('PAGE', 520, 36, { align: 'right', width: 56 })
//          .font('Helvetica')
//          .text(`${currentPage} / ${totalPages}`, 520, 48, { align: 'right', width: 56 });

//       let metaY = 65;
//       doc.font('Helvetica-Bold').fontSize(8.5).text('FROM: ', 60, metaY, { continued: true })
//          .font('Helvetica').text(dateFromStr);

//       metaY += 12;
//       doc.font('Helvetica-Bold').text('TO: ', 74, metaY, { continued: true })
//          .font('Helvetica').text(dateToStr);

//       metaY += 12;
//       doc.font('Helvetica-Bold').text('PERIOD: ', 56, metaY, { continued: true })
//          .font('Helvetica').text('DAILY');

//       const tableHeaderY = 145;
//       doc.lineWidth(1).strokeColor('#000000');
//       doc.rect(36, tableHeaderY, 540, 18).stroke();

//       doc.font('Helvetica-Bold').fontSize(8.5);
//       doc.text('TRANS #', colX.transNo + 2, tableHeaderY + 4);
//       doc.text('ACCOUNT #', colX.statusNo, tableHeaderY + 4);
//       doc.text('NAME', colX.name, tableHeaderY + 4);
//       doc.text('DATE', colX.date, tableHeaderY + 4);
//       doc.text('PRODUCT', colX.product, tableHeaderY + 4);
//       doc.text('LITRES', colX.litres, tableHeaderY + 4, { align: 'right', width: colWidths.litres });
//       doc.text('DISCOUNT', colX.discount, tableHeaderY + 4, { align: 'right', width: colWidths.discount });
//       doc.text('AMOUNT', colX.amount, tableHeaderY + 4, { align: 'right', width: colWidths.amount });

//       return 168;
//     }

//     // Totals accumulators
//     let totalLitres = 0;
//     let totalDiscount = 0;
//     let totalAmount = 0;

//     let y = 168;
//     const pageHeight = 740;

//     renderHeader(1, 1);

//     // Draw Rows
//     processedRecords.forEach((rec) => {
//       if (y > pageHeight) {
//         doc.addPage();
//         y = 168;
//       }

//       doc.font('Helvetica').fontSize(8);
//       doc.text(rec.transactionNo, colX.transNo + 2, y);
//       doc.text(rec.statusNo, colX.statusNo, y);
//       doc.text(rec.name, colX.name, y, { width: colWidths.name, height: 10, ellipsis: true });
//       doc.text(rec.date, colX.date, y);
//       doc.text(rec.fuelType, colX.product, y);

//       doc.text(formatNumber(rec.litres), colX.litres, y, { align: 'right', width: colWidths.litres });
//       doc.text(formatCurrency(rec.taxExempt), colX.discount, y, { align: 'right', width: colWidths.discount });
//       doc.text(formatCurrency(rec.saleAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

//       totalLitres += rec.litres;
//       totalDiscount += rec.taxExempt;
//       totalAmount += rec.saleAmount;

//       y += 14;
//     });

//     // Round Totals
//     totalLitres = Math.round((totalLitres + Number.EPSILON) * 100) / 100;
//     totalDiscount = Math.round((totalDiscount + Number.EPSILON) * 100) / 100;
//     totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;

//     // Render Totals
//     if (y + 25 > pageHeight) {
//       doc.addPage();
//       y = 168;
//     }

//     y += 5;
//     doc.lineWidth(1).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
//     y += 5;

//     doc.font('Helvetica-Bold').fontSize(8.5);
//     doc.text('TOTALS:', colX.product, y);
//     doc.text(formatNumber(totalLitres), colX.litres, y, { align: 'right', width: colWidths.litres });
//     doc.text(formatCurrency(totalDiscount), colX.discount, y, { align: 'right', width: colWidths.discount });
//     doc.text(formatCurrency(totalAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

//     y += 12;
//     doc.lineWidth(1).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();

//     // Apply Page Numbers
//     const range = doc.bufferedPageRange();
//     for (let i = range.start; i < range.start + range.count; i++) {
//       doc.switchToPage(i);
//       renderHeader(i + 1, range.count);
//     }

//     doc.end();
//   });
// }

// /**
//  * Generates Infonet PDF reports by grade directly in memory (as raw data, no adjustments).
//  * Skips report generation for grades with zero transactions.
//  *
//  * @param {string} site - Raw site identifier (e.g., 'wavers west', 'wavers east').
//  * @param {Array<Object>} flattenData - Array of record objects produced by processInfonetReport.
//  * @param {string} [addressLine1=''] - Primary site address line.
//  * @param {string} [addressLine2=''] - Secondary site address line (City, Province, Postal Code).
//  * @returns {Promise<Array<{ fileName: string, title: string, buffer: Buffer }>>}
//  */
// async function generateInfonetPdfReports(site, flattenData, addressLine1 = '', addressLine2 = '') {
//   if (!Array.isArray(flattenData) || flattenData.length === 0) {
//     throw new Error('No flatten data provided to generate PDF reports.');
//   }

//   const siteDisplayName = formatReportSiteName(site) || 'STORE REPORT';

//   // 1. Calculate dynamic date bounds (FROM / TO)
//   let minDate = null;
//   let maxDate = null;

//   flattenData.forEach(row => {
//     const rawDate = row['Date'] || row['Date of Sale'] || '';
//     const dObj = parseDateString(rawDate);
//     if (dObj) {
//       if (!minDate || dObj < minDate) minDate = dObj;
//       if (!maxDate || dObj > maxDate) maxDate = dObj;
//     }
//   });

//   const dateFromStr = formatDateToHeaderString(minDate);
//   const dateToStr = formatDateToHeaderString(maxDate);

//   const fileDateFromStr = formatDateToFileNameString(minDate);
//   const fileDateToStr = formatDateToFileNameString(maxDate);
//   const dateRangeSuffix = fileDateFromStr && fileDateToStr 
//     ? ` - ${fileDateFromStr} to ${fileDateToStr}`
//     : '';

//   // 2. Map raw records cleanly without applying price adjustments
//   const processedRecords = flattenData.map(row => ({
//     transactionNo: row['Transaction Number'] || row['Transactio Name'] || '',
//     date: row['Date'] || row['Date of Sale'] || '',
//     statusNo: row['Status Number'] || '',
//     name: row['Purchasers Name'] || 'UNKNOWN',
//     fuelType: (row['Type of Fuel'] || '').toString().toUpperCase(),
//     litres: parseFloat(row['Litres Purchased']) || 0,
//     taxExempt: parseFloat(row['Total Fuel Tax Exempt']) || 0,
//     saleAmount: parseFloat(row['Total Sale Amount']) || 0
//   }));

//   // 3. Define the 3 grade report configurations
//   const fuelGrades = [
//     {
//       type: 'REGULAR',
//       fileName: `Infonet Report by Client - Regular - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
//       title: 'INFONET REPORT BY CLIENT - REGULAR'
//     },
//     {
//       type: 'DIESEL',
//       fileName: `Infonet Report by Client - Diesel - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
//       title: 'INFONET REPORT BY CLIENT - DIESEL'
//     },
//     {
//       type: 'PREMIUM',
//       fileName: `Infonet Report by Client - Premium - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
//       title: 'INFONET REPORT BY CLIENT - PREMIUM'
//     }
//   ];

//   const pdfReports = [];

//   // 4. Generate PDF buffers sequentially per grade, skipping grades with 0 transactions
//   for (const grade of fuelGrades) {
//     const filteredRecords = processedRecords.filter(rec => rec.fuelType === grade.type);

//     // Skip report generation if no records exist for this fuel type
//     if (filteredRecords.length === 0) {
//       continue;
//     }

//     const recordsCopy = JSON.parse(JSON.stringify(filteredRecords));

//     const pdfBuffer = await generateSinglePdfBuffer(
//       recordsCopy,
//       grade.title,
//       siteDisplayName,
//       addressLine1,
//       addressLine2,
//       dateFromStr,
//       dateToStr
//     );

//     pdfReports.push({
//       fileName: grade.fileName,
//       title: grade.title,
//       buffer: pdfBuffer
//     });
//   }

//   return pdfReports;
// }

// module.exports = {
//   generateInfonetPdfReports
// };