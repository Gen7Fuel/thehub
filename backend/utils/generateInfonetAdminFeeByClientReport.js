const PDFDocument = require('pdfkit');
const { formatReportSiteName } = require('../utils/siteDisplayName');

// Helper to format currency values to 2 decimal places with commas ($1,234.56 or -$1,234.56)
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

// Helper to format numbers to 2 decimal places with commas (1,234.56)
function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Helper to parse date string into a JS Date object
function parseDateString(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Helper to format date object to "MONTH DD, YYYY" (e.g. "JUNE 11, 2026")
function formatDateToHeaderString(dateObj) {
  if (!dateObj) return 'N/A';
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const month = monthNames[dateObj.getUTCMonth()];
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

// Helper to format date object for clean file names (e.g. "Jun 11 2026")
function formatDateToFileNameString(dateObj) {
  if (!dateObj) return '';
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = monthNames[dateObj.getUTCMonth()];
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();
  return `${month} ${day} ${year}`;
}

/**
 * Generates a single PDF report in memory and returns a Promise resolving to a Buffer.
 */
function generateSinglePdfBuffer(processedRecords, reportTitle, siteDisplayName, addressLine1, addressLine2, dateFromStr, dateToStr) {
  return new Promise((resolve, reject) => {
    // Sort records by Status Number (Account #)
    processedRecords.sort((a, b) => (a.statusNo || '').localeCompare(b.statusNo || '', undefined, { numeric: true }));

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
      statusNo: 78,
      name: 145,
      date: 262,
      product: 314,
      litres: 356,
      fee: 410,
      discount: 460,
      amount: 514
    };

    const colWidths = {
      transNo: 40,
      statusNo: 65,
      name: 115,
      date: 50,
      product: 40,
      litres: 52,
      fee: 48,
      discount: 52,
      amount: 62
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
      doc.text('FEE', colX.fee, tableHeaderY + 4, { align: 'right', width: colWidths.fee });
      doc.text('DISCOUNT', colX.discount, tableHeaderY + 4, { align: 'right', width: colWidths.discount });
      doc.text('AMOUNT', colX.amount, tableHeaderY + 4, { align: 'right', width: colWidths.amount });

      return 168;
    }

    // Totals accumulators
    let totalLitres = 0;
    let totalFee = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    let y = 168;
    const pageHeight = 740;

    renderHeader(1, 1);

    // Draw Rows
    processedRecords.forEach((rec) => {
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
      doc.text(formatCurrency(rec.fee), colX.fee, y, { align: 'right', width: colWidths.fee });
      doc.text(formatCurrency(rec.taxExempt), colX.discount, y, { align: 'right', width: colWidths.discount });
      doc.text(formatCurrency(rec.saleAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

      totalLitres += rec.litres;
      totalFee += rec.fee;
      totalDiscount += rec.taxExempt;
      totalAmount += rec.saleAmount;

      y += 14;
    });

    // Round Totals
    totalLitres = Math.round((totalLitres + Number.EPSILON) * 100) / 100;
    totalFee = Math.round((totalFee + Number.EPSILON) * 100) / 100;
    totalDiscount = Math.round((totalDiscount + Number.EPSILON) * 100) / 100;
    totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;

    // Render Totals
    if (y + 25 > pageHeight) {
      doc.addPage();
      y = 168;
    }

    y += 5;
    doc.lineWidth(1).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();
    y += 5;

    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('TOTALS:', colX.product, y);
    doc.text(formatNumber(totalLitres), colX.litres, y, { align: 'right', width: colWidths.litres });
    doc.text(formatCurrency(totalFee), colX.fee, y, { align: 'right', width: colWidths.fee });
    doc.text(formatCurrency(totalDiscount), colX.discount, y, { align: 'right', width: colWidths.discount });
    doc.text(formatCurrency(totalAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

    y += 12;
    doc.lineWidth(1).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();

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
 * Generates Admin Fee PDF reports directly in memory and tracks adjusted transactions.
 *
 * @param {string} site - Raw site identifier (e.g., 'wavers west', 'wavers east').
 * @param {number|string} adminFee - Dynamic admin fee per litre (e.g., 0.03).
 * @param {number|string} provinceStatusDiscount - Dynamic province status discount per litre (e.g., 0.125).
 * @param {Array<Object>} flattenData - Array of record objects produced by processInfonetReport.
 * @param {string} [addressLine1=''] - Primary site address line.
 * @param {string} [addressLine2=''] - Secondary site address line (City, Province, Postal Code).
 * @returns {Promise<{ pdfReports: Array<{ fileName: string, title: string, buffer: Buffer }>, adjustedTransactions: Array<Object> }>}
 */
async function generateAdminFeePdfReports(site, adminFee, provinceStatusDiscount, flattenData, addressLine1 = '', addressLine2 = '') {
  if (!Array.isArray(flattenData) || flattenData.length === 0) {
    throw new Error('No flatten data provided to generate PDF reports.');
  }

  const numericAdminFee = parseFloat(adminFee) || 0;
  const numericProvinceDiscount = parseFloat(provinceStatusDiscount) || 0;
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

  const adjustedTransactions = [];

  // 2. Process records, apply dynamic adjustments & track adjusted rows
  const allProcessedRecords = flattenData.map(row => {
    const transactionNo = row['Transaction Number'] || row['Transactio Name'] || '';
    const date = row['Date'] || row['Date of Sale'] || '';
    const statusNo = row['Status Number'] || '';
    const name = row['Purchasers Name'] || 'UNKNOWN';
    let litres = parseFloat(row['Litres Purchased']) || 0;
    const fuelType = (row['Type of Fuel'] || '').toString().toUpperCase();
    const regularPrice = parseFloat(row['Regular Price'] || row['Non Status Price']) || 0;
    const treatyPrice = parseFloat(row['Treaty Price']) || 0;
    let taxExempt = parseFloat(row['Total Fuel Tax Exempt']) || 0;
    let saleAmount = parseFloat(row['Total Sale Amount']) || 0;
    const originalSaleAmount = saleAmount;

    // Dynamic Effective Price calculation
    const dynamicEffectivePrice = regularPrice - (numericProvinceDiscount - numericAdminFee);
    const dynamicBasePrice = regularPrice;

    // Price gap checks
    const priceDiff = Math.abs((regularPrice - treatyPrice) - 0.10);
    const isGapMismatch = (fuelType === 'REGULAR' || fuelType === 'PREMIUM') && priceDiff > 0.001;
    const isTreatyNotLessThanRegular = treatyPrice >= (regularPrice - 0.099);
    const isDieselCorrection = fuelType === 'DIESEL' && treatyPrice > regularPrice && taxExempt < 0;

    const needsAdjustment = isDieselCorrection || isGapMismatch || isTreatyNotLessThanRegular;

    if (needsAdjustment) {
      saleAmount = litres * dynamicEffectivePrice;
      const baseCalc = litres * dynamicBasePrice;
      taxExempt = baseCalc - saleAmount;

      adjustedTransactions.push({
        transactionId: transactionNo,
        date: date,
        grade: fuelType,
        originalTreatyPrice: treatyPrice,
        originalRegularPrice: regularPrice,
        litersSold: litres,
        originalSaleAmount: originalSaleAmount,
        adjustedSaleAmount: Math.round((saleAmount + Number.EPSILON) * 100) / 100
      });
    }

    const fee = litres * numericAdminFee;

    return {
      transactionNo,
      date,
      statusNo,
      name,
      fuelType,
      litres,
      fee,
      taxExempt,
      saleAmount
    };
  });

  // 3. Define report configurations
  const reportConfigs = [
    {
      targetFuelType: 'ALL',
      fileName: `Admin Fee by Client - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
      title: 'ADMIN FEE BY CLIENT'
    },
    {
      targetFuelType: 'REGULAR',
      fileName: `Admin Fee by Client - Regular - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
      title: 'ADMIN FEE BY CLIENT - REGULAR'
    },
    {
      targetFuelType: 'DIESEL',
      fileName: `Admin Fee by Client - Diesel - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
      title: 'ADMIN FEE BY CLIENT - DIESEL'
    },
    {
      targetFuelType: 'PREMIUM',
      fileName: `Admin Fee by Client - Premium - ${siteDisplayName.toUpperCase()}${dateRangeSuffix}.pdf`,
      title: 'ADMIN FEE BY CLIENT - PREMIUM'
    }
  ];

  // 4. Generate all PDF buffers concurrently
  const pdfReports = await Promise.all(
    reportConfigs.map(async (config) => {
      let filteredRecords = allProcessedRecords;
      if (config.targetFuelType !== 'ALL') {
        filteredRecords = allProcessedRecords.filter(
          rec => rec.fuelType === config.targetFuelType
        );
      }

      const recordsCopy = JSON.parse(JSON.stringify(filteredRecords));

      const pdfBuffer = await generateSinglePdfBuffer(
        recordsCopy,
        config.title,
        siteDisplayName,
        addressLine1,
        addressLine2,
        dateFromStr,
        dateToStr
      );

      return {
        fileName: config.fileName,
        title: config.title,
        buffer: pdfBuffer
      };
    })
  );

  return {
    pdfReports,
    adjustedTransactions
  };
}

module.exports = {
  generateAdminFeePdfReports,
  formatCurrency,
  formatNumber,
  parseDateString,
  formatDateToHeaderString,
  formatDateToFileNameString
};