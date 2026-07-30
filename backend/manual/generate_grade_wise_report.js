const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

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

function generateReportForFuelType(rawRows, targetFuelType, outputPdfPath, reportTitle) {
  // Filter records by the requested fuel type grade
  const filteredRows = rawRows.filter(row => {
    const fuelType = (row['Type of Fuel'] || '').toString().toUpperCase();
    return fuelType === targetFuelType.toUpperCase();
  });

  // Process records
  const processedRecords = filteredRows.map(row => {
    const transactionNo = row['Transaction Number'] || row['Transactio Name'] || '';
    const date = row['Date'] || row['Date of Sale'] || '';
    const statusNo = row['Status Number'] || '';
    const name = row['Purchasers Name'] || 'UNKNOWN';
    let litres = parseFloat(row['Litres Purchased']) || 0;
    const fuelType = (row['Type of Fuel'] || '').toString().toUpperCase();
    let taxExempt = parseFloat(row['Total Fuel Tax Exempt']) || 0;
    let saleAmount = parseFloat(row['Total Sale Amount']) || 0;

    return {
      transactionNo,
      date,
      statusNo,
      name,
      fuelType,
      litres,
      taxExempt,
      saleAmount
    };
  });

  // GROUP/SORT BY STATUS NUMBER (Account #)
  processedRecords.sort((a, b) => a.statusNo.localeCompare(b.statusNo, undefined, { numeric: true }));

  // Initialize PDF Document
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 36, // 0.5 inch margins
    bufferPages: true
  });

  const writeStream = fs.createWriteStream(outputPdfPath);
  doc.pipe(writeStream);

  // Layout positions (Expanded Name column to 120px, trimmed end columns)
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
    name: 115,    // <--- Expanded name space matching Admin Fee report layout
    date: 55,
    product: 45,
    litres: 55,
    discount: 60,
    amount: 60
  };

  // Function to render Header block on all pages
  function renderHeader(currentPage, totalPages) {
    // Title in ALL CAPS
    doc.font('Helvetica-Bold').fontSize(14).text(reportTitle.toUpperCase(), 36, 36, { underline: true });

    // Company Information in ALL CAPS
    doc.font('Helvetica-Bold').fontSize(8.5)
       .text('WAVERS OF BROKENHEAD', 340, 36, { align: 'right', width: 160 })
       .font('Helvetica').fontSize(8)
       .text('SCANTERBURY, MB, R0E 1W0', 340, 58, { align: 'right', width: 160 });

    // Page Number
    doc.font('Helvetica-Bold').fontSize(8.5)
       .text('PAGE', 520, 36, { align: 'right', width: 56 })
       .font('Helvetica')
       .text(`${currentPage} / ${totalPages}`, 520, 48, { align: 'right', width: 56 });

    // Metadata details in ALL CAPS
    let metaY = 65;
    doc.font('Helvetica-Bold').fontSize(8.5).text('FROM: ', 60, metaY, { continued: true })
       .font('Helvetica').text('JULY 01, 2026');

    metaY += 12;
    doc.font('Helvetica-Bold').text('TO: ', 74, metaY, { continued: true })
       .font('Helvetica').text('JULY 15, 2026');

    metaY += 12;
    doc.font('Helvetica-Bold').text('PERIOD: ', 56, metaY, { continued: true })
       .font('Helvetica').text('DAILY');

    // Table Header Bar
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

  // Totals accumulators
  let totalLitres = 0;
  let totalDiscount = 0;
  let totalAmount = 0;

  let y = 168;
  const pageHeight = 740;

  renderHeader(1, 1);

  // Iterate over records
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
    
    // Formatted values (2 decimals + commas)
    doc.text(formatNumber(rec.litres), colX.litres, y, { align: 'right', width: colWidths.litres });
    doc.text(formatCurrency(rec.taxExempt), colX.discount, y, { align: 'right', width: colWidths.discount });
    doc.text(formatCurrency(rec.saleAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

    // Accumulate sums
    totalLitres += rec.litres;
    totalDiscount += rec.taxExempt;
    totalAmount += rec.saleAmount;

    y += 14;
  });

  // Round cumulative totals to 2 decimal places to prevent float precision drift
  totalLitres = Math.round((totalLitres + Number.EPSILON) * 100) / 100;
  totalDiscount = Math.round((totalDiscount + Number.EPSILON) * 100) / 100;
  totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;

  // Render Totals Row
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
  doc.text(formatCurrency(totalDiscount), colX.discount, y, { align: 'right', width: colWidths.discount });
  doc.text(formatCurrency(totalAmount), colX.amount, y, { align: 'right', width: colWidths.amount });

  y += 12;
  doc.lineWidth(1).lineCap('butt').moveTo(36, y).lineTo(576, y).stroke();

  // Apply Headers & Page Numbers across all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    renderHeader(i + 1, range.count);
  }

  doc.end();

  writeStream.on('finish', () => {
    console.log(`Successfully generated PDF report: ${outputPdfPath}`);
  });
}

function generatePdfReports() {
  const inputExcelPath = path.join(__dirname, 'infonet_flatten.xlsx');

  console.log(`Reading flattened Excel file from: ${inputExcelPath}`);

  if (!fs.existsSync(inputExcelPath)) {
    console.error(`Error: File not found at ${inputExcelPath}`);
    return;
  }

  const workbook = XLSX.readFile(inputExcelPath);
  const sheetName = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const fuelGrades = [
    { type: 'REGULAR', fileName: 'Infonet Report by Client - Regular - WAVERS OF BROKENHEAD.pdf', title: 'INFONET REPORT BY CLIENT - REGULAR' },
    { type: 'DIESEL', fileName: 'Infonet Report by Client - Diesel - WAVERS OF BROKENHEAD.pdf', title: 'INFONET REPORT BY CLIENT - DIESEL' },
    { type: 'PREMIUM', fileName: 'Infonet Report by Client - Premium - WAVERS OF BROKENHEAD.pdf', title: 'INFONET REPORT BY CLIENT - PREMIUM' }
  ];

  fuelGrades.forEach(grade => {
    const outputPdfPath = path.join(__dirname, grade.fileName);
    generateReportForFuelType(rawRows, grade.type, outputPdfPath, grade.title);
  });
}

generatePdfReports();