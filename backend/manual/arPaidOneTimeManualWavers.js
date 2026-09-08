require('dotenv').config();
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');
// Import models (adjust path if needed)
const { CashSummary } = require('../models/CashSummaryNew');

async function generateArReport() {
  const siteName = 'Wavers West';

  // Date boundaries: July 1, 2026 to August 31, 2026
  const startDate = new Date('2026-08-01T00:00:00.000Z');
  const endDate = new Date('2026-08-31T23:59:59.999Z');

  console.log(
    `Fetching A/R Paid records for site: "${siteName}" between ${startDate.toISOString().split('T')[0]} and ${endDate.toISOString().split('T')[0]}...`
  );

  // Query MongoDB
  const records = await CashSummary.find({
    site: siteName,
    date: { $gte: startDate, $lte: endDate },
    'arCustomers.paid': { $exists: true, $ne: null, $gt: 0 }
  })
    .sort({ date: 1, shift_number: 1 })
    .lean();

  // Group entries by Customer Name
  const groupedCustomers = {};

  records.forEach((doc) => {
    const formattedDate = doc.date ? new Date(doc.date).toISOString().split('T')[0] : 'N/A';

    if (Array.isArray(doc.arCustomers)) {
      doc.arCustomers.forEach((cust) => {
        if (cust.paid !== null && cust.paid !== undefined && cust.paid > 0) {
          const custName = (cust.name || 'Unknown Customer').trim();

          if (!groupedCustomers[custName]) {
            groupedCustomers[custName] = [];
          }

          groupedCustomers[custName].push({
            date: formattedDate,
            shift_number: doc.shift_number || '',
            name: custName,
            paid: cust.paid
          });
        }
      });
    }
  });

  // Create Excel Workbook and Sheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('A-R Paid Report');

  // Define Columns
  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Shift Number', key: 'shift_number', width: 15 },
    { header: 'Customer Name', key: 'customer_name', width: 35 },
    { header: 'A/R Paid Amount', key: 'paid_amount', width: 22 }
  ];

  // Header Styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F4E78' } // Dark Blue Header
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  let totalDetailRows = 0;
  const customerSummaryRows = [];

  // Sort customer names alphabetically
  const sortedCustomerNames = Object.keys(groupedCustomers).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Populate Worksheet Section by Section
  sortedCustomerNames.forEach((custName) => {
    const items = groupedCustomers[custName];
    const sectionStartRow = worksheet.lastRow.number + 2; // Row after section header
    const sectionEndRow = sectionStartRow + items.length - 1;

    // 1. Add Customer Section Header Row
    const sectionHeaderRow = worksheet.addRow({
      date: '',
      shift_number: '',
      customer_name: custName,
      paid_amount: { formula: `SUM(D${sectionStartRow}:D${sectionEndRow})` } // Formula calculating section total
    });

    // Style Customer Section Row
    sectionHeaderRow.font = { bold: true, size: 11, color: { argb: '000000' } };
    sectionHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D9E1F2' } // Light Accent Blue Fill
    };

    const sectionPaidCell = sectionHeaderRow.getCell('paid_amount');
    sectionPaidCell.numberFmt = '$#,##0.00';
    sectionPaidCell.font = { bold: true };

    customerSummaryRows.push(sectionHeaderRow.number);

    // 2. Add Detailed Transactions for this Customer
    items.forEach((item) => {
      const row = worksheet.addRow({
        date: item.date,
        shift_number: item.shift_number,
        customer_name: item.name,
        paid_amount: item.paid
      });

      row.getCell('paid_amount').numberFmt = '$#,##0.00';
      totalDetailRows++;
    });

    // Add an empty space between customer blocks
    worksheet.addRow([]);
  });

  // 3. Add Grand Total Row at the Bottom
  if (customerSummaryRows.length > 0) {
    // Formula adding up all customer section totals
    const grandTotalFormula = customerSummaryRows.map((rowNum) => `D${rowNum}`).join('+');

    const grandTotalRow = worksheet.addRow({
      date: '',
      shift_number: '',
      customer_name: 'GRAND TOTAL',
      paid_amount: { formula: grandTotalFormula }
    });

    grandTotalRow.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    grandTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E78' } // Dark Blue Fill
    };

    const grandTotalCell = grandTotalRow.getCell('paid_amount');
    grandTotalCell.numberFmt = '$#,##0.00';
    grandTotalCell.alignment = { horizontal: 'right' };
  }

  // Set number format for column D explicitly
  worksheet.getColumn('paid_amount').numFmt = '$#,##0.00';

  // Save Workbook
  const outputPath = path.join(__dirname, `AR_Paid_Report_Wavers_West_Aug_2026.xlsx`);
  await workbook.xlsx.writeFile(outputPath);

  console.log(`Report generated successfully!`);
  console.log(`Total customers: ${sortedCustomerNames.length}`);
  console.log(`Total transaction entries written: ${totalDetailRows}`);
  console.log(`Saved to: ${outputPath}`);
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    await generateArReport();

    process.exit(0);
  } catch (err) {
    console.error('Error generating report:', err);
    process.exit(1);
  }
}

run();