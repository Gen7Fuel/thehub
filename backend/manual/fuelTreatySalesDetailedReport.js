const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Import SQL query function directly from sqlService
const { getFuelSalesRollupReportRange } = require('../services/sqlService');

// Helper to safely parse and split "YYYY-MM-DD HH:mm:ss.000" into separate Date and Time
function formatDateTimeSplit(rawDateTime) {
  if (!rawDateTime) return { dateStr: '', timeStr: '' };

  const str = rawDateTime instanceof Date 
    ? rawDateTime.toISOString().replace('T', ' ')
    : String(rawDateTime);

  const parts = str.trim().split(' ');
  const dateStr = parts[0] || '';
  
  // Format Time to HH:mm
  let timeStr = parts[1] || '';
  if (timeStr.includes(':')) {
    const timeParts = timeStr.split(':');
    timeStr = `${timeParts[0]}:${timeParts[1]}`;
  }

  return { dateStr, timeStr };
}

// --- Main Execution & PDF Generator Function ---
async function generateTreatySalesPDFReport(csoCode, startDate, endDate) {
  try {
    // 1. Fetch data from DB
    console.log(`Fetching data for CSO: ${csoCode} (${startDate} to ${endDate})...`);
    const records = await getFuelSalesRollupReportRange(csoCode, startDate, endDate);

    if (!records || records.length === 0) {
      console.log('No treaty transactions found for the specified criteria.');
      return;
    }

    // 2. Set output file path
    const outputDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filePath = path.join(
      outputDir,
      `Treaty_Sales_Report_Brokenhead_Community_Store_June_2026.pdf`
    );

    // 3. Initialize PDFKit document (A4 Landscape)
    const pageOptions = { size: 'A4', layout: 'landscape', margin: 30 };
    const doc = new PDFDocument(pageOptions);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // 4. Report Header
    doc
      .fontSize(16)
      .fillColor('#0f172a')
      .text('Treaty Fuel Sales Detailed Report', { align: 'left' });

    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(`Station: Brokenhead Community Store  |  Period: 10th June - 30th June 2026`, {
        align: 'left',
      });

    doc.moveDown(0.8);

    // 5. Calculate Summary Totals
    const totalAmount = records.reduce((sum, r) => sum + Number(r.sales_amount || 0), 0);
    const totalVolume = records.reduce((sum, r) => sum + Number(r.sales_quantity || 0), 0);

    // Summary Header Box
    doc
      .fontSize(9)
      .fillColor('#1e293b')
      .text(
        `Total Transactions: ${records.length}   |   Total Sales: $${totalAmount.toFixed(
          2
        )}   |   Total Volume: ${totalVolume.toFixed(4)} L`
      );

    doc.moveDown(0.8);

    // 6. Table Coordinates & Updated Column Definitions (Total Width: 782px)
    const startX = 30;
    let currentY = doc.y + 5;
    const rowHeight = 20;

    const columns = [
      { label: 'Date', width: 90, align: 'left' },
      { label: 'Time', width: 65, align: 'left' },
      { label: 'Register ID', width: 90, align: 'left' },
      { label: 'Transaction ID', width: 130, align: 'left' },
      { label: 'Category', width: 110, align: 'left' },
      { label: 'Fuel Grade', width: 117, align: 'left' },
      { label: 'Sales Amount', width: 90, align: 'right' },
      { label: 'Sales Volume', width: 90, align: 'right' },
    ];

    const drawHeaders = (y) => {
      doc.rect(startX, y, 782, rowHeight).fill('#f1f5f9');
      let xOffset = startX;

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
      columns.forEach((col) => {
        doc.text(col.label, xOffset + 4, y + 6, {
          width: col.width - 8,
          align: col.align,
        });
        xOffset += col.width;
      });
    };

    drawHeaders(currentY);
    currentY += rowHeight;

    // 7. Render Data Rows
    doc.font('Helvetica').fontSize(8);

    records.forEach((row, index) => {
      // Dynamic Page Break Check (Landscape vertical limit)
      if (currentY > 520) {
        doc.addPage(pageOptions); // Explicitly pass pageOptions to enforce landscape layout
        currentY = 30;
        drawHeaders(currentY);
        currentY += rowHeight;
        doc.font('Helvetica').fontSize(8);
      }

      // Alternating row background
      if (index % 2 === 1) {
        doc.rect(startX, currentY, 782, rowHeight).fill('#f8fafc');
      }

      const { dateStr, timeStr } = formatDateTimeSplit(row.DateTime);

      const rowValues = [
        dateStr,
        timeStr,
        String(row.Register_ID || row['Register ID'] || ''),
        String(row.Transaction_ID || row['Transaction ID'] || ''),
        String(row.sale_category || ''),
        String(row.fuel_grade || ''),
        `$${Number(row.sales_amount || 0).toFixed(2)}`,
        Number(row.sales_quantity || 0).toFixed(4),
      ];

      let xOffset = startX;
      doc.fillColor('#334155');

      columns.forEach((col, i) => {
        doc.text(rowValues[i], xOffset + 4, currentY + 6, {
          width: col.width - 8,
          align: col.align,
        });
        xOffset += col.width;
      });

      currentY += rowHeight;
    });

    // 8. Render Grand Total Footer Row
    if (currentY > 520) {
      doc.addPage(pageOptions);
      currentY = 30;
    }

    doc.rect(startX, currentY, 782, rowHeight).fill('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);

    doc.text('GRAND TOTALS:', startX + 4, currentY + 6, { width: 602, align: 'right' });
    doc.text(`$${totalAmount.toFixed(2)}`, startX + 602, currentY + 6, {
      width: 82,
      align: 'right',
    });
    doc.text(totalVolume.toFixed(4), startX + 684, currentY + 6, {
      width: 82,
      align: 'right',
    });

    doc.end();

    writeStream.on('finish', () => {
      console.log(`PDF generated successfully at: ${filePath}`);
      process.exit(0);
    });

  } catch (error) {
    console.error('Error generating PDF report:', error);
    process.exit(1);
  }
}

// --- Execute Script ---
generateTreatySalesPDFReport('78207', '20260601', '20260630');

// const fs = require('fs');
// const path = require('path');
// const PDFDocument = require('pdfkit');

// // Import both functions from sqlService
// const { 
//   getFuelSalesRollupReportRange, 
//   getFuelSalesTransactions25June 
// } = require('../services/sqlService');

// function formatDateTimeSplit(rawDateTime) {
//   if (!rawDateTime) return { dateStr: '', timeStr: '' };

//   const str = rawDateTime instanceof Date 
//     ? rawDateTime.toISOString().replace('T', ' ')
//     : String(rawDateTime);

//   const parts = str.trim().split(' ');
//   const dateStr = parts[0] || '';
  
//   let timeStr = parts[1] || '';
//   if (timeStr.includes(':')) {
//     const timeParts = timeStr.split(':');
//     timeStr = `${timeParts[0]}:${timeParts[1]}`;
//   }

//   return { dateStr, timeStr };
// }

// async function generateTreatySalesPDFReport(csoCode, startDate, endDate) {
//   try {
//     console.log(`Fetching partitioned data for CSO: ${csoCode} (${startDate} to ${endDate})...`);

//     let records = [];

//     // Check if range spans across June 25th & 26th exception window
//     if (startDate <= '20260624' && endDate >= '20260627') {
//       console.log(' -> Querying Part 1: 2026-06-01 to 2026-06-24 (Strict Matching)...');
//       const part1 = await getFuelSalesRollupReportRange(csoCode, '20260601', '20260624');

//       console.log(' -> Querying Part 2: 2026-06-25 to 2026-06-26 (Legacy Combined Matching)...');
//       const part2 = await getFuelSalesTransactions25June(csoCode, '20260625');

//       console.log(' -> Querying Part 3: 2026-06-27 to 2026-06-30 (Strict Matching)...');
//       const part3 = await getFuelSalesRollupReportRange(csoCode, '20260627', '20260630');

//       records = [...part1, ...part2, ...part3];
//     } else {
//       // Fallback for custom ranges outside June 2026 full-month execution
//       records = await getFuelSalesRollupReportRange(csoCode, startDate, endDate);
//     }

//     if (!records || records.length === 0) {
//       console.log('No treaty transactions found for the specified criteria.');
//       return;
//     }

//     const outputDir = path.join(__dirname, 'reports');
//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }
//     const filePath = path.join(
//       outputDir,
//       `Treaty_Sales_Report_${csoCode}_${startDate}_${endDate}.pdf`
//     );

//     const pageOptions = { size: 'A4', layout: 'landscape', margin: 30 };
//     const doc = new PDFDocument(pageOptions);
//     const writeStream = fs.createWriteStream(filePath);
//     doc.pipe(writeStream);

//     // Report Header
//     doc
//       .fontSize(16)
//       .fillColor('#0f172a')
//       .text('Treaty Fuel Sales Detailed Report', { align: 'left' });

//     doc
//       .fontSize(9)
//       .fillColor('#64748b')
//       .text(`Station: Wavers of Brokenhead  |  Period: 11th June - 30th June 2026`, {
//         align: 'left',
//       });

//     doc.moveDown(0.8);

//     // Calculate Combined Summary Totals
//     const totalAmount = records.reduce((sum, r) => sum + Number(r.sales_amount || 0), 0);
//     const totalVolume = records.reduce((sum, r) => sum + Number(r.sales_quantity || 0), 0);

//     doc
//       .fontSize(9)
//       .fillColor('#1e293b')
//       .text(
//         `Total Transactions: ${records.length}   |   Total Sales: $${totalAmount.toFixed(
//           2
//         )}   |   Total Volume: ${totalVolume.toFixed(4)} L`
//       );

//     doc.moveDown(0.8);

//     const startX = 30;
//     let currentY = doc.y + 5;
//     const rowHeight = 20;

//     const columns = [
//       { label: 'Date', width: 90, align: 'left' },
//       { label: 'Time', width: 65, align: 'left' },
//       { label: 'Register ID', width: 90, align: 'left' },
//       { label: 'Transaction ID', width: 130, align: 'left' },
//       { label: 'Category', width: 110, align: 'left' },
//       { label: 'Fuel Grade', width: 117, align: 'left' },
//       { label: 'Sales Amount', width: 90, align: 'right' },
//       { label: 'Sales Volume', width: 90, align: 'right' },
//     ];

//     const drawHeaders = (y) => {
//       doc.rect(startX, y, 782, rowHeight).fill('#f1f5f9');
//       let xOffset = startX;

//       doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
//       columns.forEach((col) => {
//         doc.text(col.label, xOffset + 4, y + 6, {
//           width: col.width - 8,
//           align: col.align,
//         });
//         xOffset += col.width;
//       });
//     };

//     drawHeaders(currentY);
//     currentY += rowHeight;

//     doc.font('Helvetica').fontSize(8);

//     records.forEach((row, index) => {
//       if (currentY > 520) {
//         doc.addPage(pageOptions);
//         currentY = 30;
//         drawHeaders(currentY);
//         currentY += rowHeight;
//         doc.font('Helvetica').fontSize(8);
//       }

//       if (index % 2 === 1) {
//         doc.rect(startX, currentY, 782, rowHeight).fill('#f8fafc');
//       }

//       const { dateStr, timeStr } = formatDateTimeSplit(row.DateTime);

//       const rowValues = [
//         dateStr,
//         timeStr,
//         String(row.Register_ID || row['Register ID'] || ''),
//         String(row.Transaction_ID || row['Transaction ID'] || ''),
//         String(row.sale_category || ''),
//         String(row.fuel_grade || ''),
//         `$${Number(row.sales_amount || 0).toFixed(2)}`,
//         Number(row.sales_quantity || 0).toFixed(4),
//       ];

//       let xOffset = startX;
//       doc.fillColor('#334155');

//       columns.forEach((col, i) => {
//         doc.text(rowValues[i], xOffset + 4, currentY + 6, {
//           width: col.width - 8,
//           align: col.align,
//         });
//         xOffset += col.width;
//       });

//       currentY += rowHeight;
//     });

//     if (currentY > 520) {
//       doc.addPage(pageOptions);
//       currentY = 30;
//     }

//     doc.rect(startX, currentY, 782, rowHeight).fill('#e2e8f0');
//     doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);

//     doc.text('GRAND TOTALS:', startX + 4, currentY + 6, { width: 602, align: 'right' });
//     doc.text(`$${totalAmount.toFixed(2)}`, startX + 602, currentY + 6, {
//       width: 82,
//       align: 'right',
//     });
//     doc.text(totalVolume.toFixed(4), startX + 684, currentY + 6, {
//       width: 82,
//       align: 'right',
//     });

//     doc.end();

//     writeStream.on('finish', () => {
//       console.log(`PDF generated successfully at: ${filePath}`);
//       process.exit(0);
//     });

//   } catch (error) {
//     console.error('Error generating PDF report:', error);
//     process.exit(1);
//   }
// }

// // Execute Script
// generateTreatySalesPDFReport('78205', '20260601', '20260630');