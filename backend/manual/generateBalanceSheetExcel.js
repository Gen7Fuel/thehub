// const path = require('path');
// const fs = require('fs');
// const ExcelJS = require('exceljs');
// const mongoose = require('mongoose');
// const connectDB = require('../config/db');

// // Models
// const Location = require('../models/Location');

// // Import exact EOD generator helpers
// const {
//   fetchEodDataForDate,
//   combineEodData
// } = require('../utils/eodReportWavers'); // Adjust path as needed

// /**
//  * Date range generator helper (YYYY-MM-DD strings)
//  */
// function getDateRange(startStr, endStr) {
//   const dates = [];
//   let current = new Date(`${startStr}T00:00:00`);
//   const end = new Date(`${endStr}T00:00:00`);

//   while (current <= end) {
//     const yyyy = current.getFullYear();
//     const mm = String(current.getMonth() + 1).padStart(2, '0');
//     const dd = String(current.getDate()).padStart(2, '0');
//     dates.push(`${yyyy}-${mm}-${dd}`);
//     current.setDate(current.getDate() + 1);
//   }
//   return dates;
// }

// /**
//  * Generates an Excel Balance Sheet for a given site and date range.
//  */
// async function generateBalanceSheetExcel({ site, startDate, endDate, outputDirPath = __dirname }) {
//   const location = await Location.findOne({ site }).lean();
//   const isManitoba = location?.province === 'MB' || location?.province === 'Manitoba';

//   const dates = getDateRange(startDate, endDate);

//   // 1️⃣ Fetch daily EOD data for every single date in range
//   const dailyDataList = [];
//   for (const date of dates) {
//     const dailyEod = await fetchEodDataForDate({ site, date, isManitoba });
//     dailyDataList.push(dailyEod);
//   }

//   // 2️⃣ Combine all daily data using your robust combineEodData helper
//   const cumulativeData = combineEodData(dailyDataList);

//   if (!cumulativeData) {
//     throw new Error(`Failed to combine EOD data for site ${site}`);
//   }

//   // Extract Tenders
//   const tenders = cumulativeData.tenders || {};
//   const debitClearing = tenders['DEBIT'] || 0;
//   const visaClearing = tenders['VISA'] || 0;
//   const mcClearing = tenders['MASTERCARD'] || tenders['MC'] || 0;
//   const amexClearing = tenders['AMEX'] || 0;

//   // Extract A/R Details
//   let chargeAccountsIncurred = 0;
//   let chargeAccountsPaid = 0;
//   Object.values(cumulativeData.arCustomers || {}).forEach((cust) => {
//     chargeAccountsIncurred += cust.incurred || 0;
//     chargeAccountsPaid += cust.paid || 0;
//   });

//   // Cash Over / Short & Fuel Adjustment Logic
//   // Sign adjustment: If short (< 0), display positive on Debit; if over (> 0), display negative.
//   const cashOverShortVal = -cumulativeData.overShortCash;
//   const fuelAdjustmentVal = -cumulativeData.adjFuelVariance;
//   const updatedCpl = -cumulativeData.fuelPriceOverrides;

//   // 3️⃣ Construct Excel Sheet
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Balance Sheet');

//   worksheet.columns = [
//     { header: '', key: 'label', width: 26 },
//     { header: '', key: 'debit', width: 18 },
//     { header: '', key: 'credit', width: 18 },
//     { header: '', key: 'empty', width: 10 },
//     { header: '', key: 'variance', width: 18 }
//   ];

//   const rows = [
//     { label: 'Debit Clearing', debit: debitClearing, credit: null },
//     { label: 'Visa Clearing', debit: visaClearing, credit: null },
//     { label: 'MC Clearing', debit: mcClearing, credit: null },
//     { label: 'Amex Clearing', debit: amexClearing, credit: null },
//     { label: 'Charge Accounts', debit: chargeAccountsIncurred, credit: null },
//     { label: 'Charge Accounts Paid', debit: null, credit: chargeAccountsPaid },
//     { label: 'Cash collected', debit: cumulativeData.totalCanadianCashCollected, credit: null },
//     { label: 'Cheques Collected', debit: cumulativeData.chequesCashedOut, credit: null },
//     { label: 'Fuel Sales', debit: null, credit: cumulativeData.fuelSales },
//     { label: 'CPL', debit: updatedCpl, credit: null },
//     { label: 'Item Sales', debit: null, credit: cumulativeData.itemSales },
//     { label: 'GST Collected', debit: null, credit: cumulativeData.gst },
//     { label: 'PST Collected', debit: null, credit: cumulativeData.pst },
//     { label: 'Cash Over', debit: cashOverShortVal, credit: null },
//     { label: 'Fuel Sales Adjustment', debit: null, credit: fuelAdjustmentVal },
//     { label: 'Penny Rounding', debit: null, credit: cumulativeData.pennyRounding },
//     { label: '', debit: null, credit: null },                                     // Row 17 (Blank)
//     { label: 'lotto payout', debit: null, credit: cumulativeData.lottoPayout },  // Row 18
//     { label: '', debit: null, credit: null }                                      // Row 19 (Blank)
//   ];

//   rows.forEach((r) => worksheet.addRow(r));

//   // Row 20: Grand Totals
//   const totalRow = worksheet.addRow({
//     label: '',
//     debit: { formula: 'SUM(B1:B19)' },
//     credit: { formula: 'SUM(C1:C19)' },
//     empty: null,
//     variance: null
//   });

//   // Row 21: Blank Separator
//   worksheet.addRow({ label: '', debit: null, credit: null, empty: null, variance: null });

//   // Row 22: Final Variance Comparison (Row 20 Debit - Row 20 Credit)
//   const comparisonRow = worksheet.addRow({
//     label: '',
//     debit: null,
//     credit: null,
//     empty: null,
//     variance: { formula: 'B21-C21' }
//   });

//   // 4️⃣ Formatting & Styling
//   const currencyFormat = '$#,##0.00;-$#,##0.00;"$"0.00';

//   worksheet.eachRow((row) => {
//     row.getCell(1).font = { name: 'Calibri', size: 11 };

//     ['B', 'C', 'E'].forEach((colLetter) => {
//       const cell = row.getCell(colLetter);
//       if (cell.value !== null && cell.value !== undefined) {
//         cell.numberFormat = currencyFormat;
//         cell.alignment = { horizontal: 'right' };
//         cell.font = { name: 'Calibri', size: 11 };
//       }
//     });
//   });

//   // Row 20 Totals Styling
//   totalRow.getCell('B').font = { name: 'Calibri', size: 11, bold: true };
//   totalRow.getCell('C').font = { name: 'Calibri', size: 11, bold: true };
//   ['B', 'C'].forEach((colLetter) => {
//     totalRow.getCell(colLetter).border = {
//       top: { style: 'thin' },
//       bottom: { style: 'double' }
//     };
//   });

//   // Row 22 Variance Styling
//   comparisonRow.getCell('E').font = { name: 'Calibri', size: 11, bold: true };

//   // 5️⃣ Write to Disk
//   const filename = `Balance_Sheet_${site}_${startDate}_to_${endDate}.xlsx`;
//   const filePath = path.join(outputDirPath, filename);

//   await workbook.xlsx.writeFile(filePath);
//   console.log(`Successfully generated balance sheet excel file at: ${filePath}`);

//   return filePath;
// }

// // Configuration & CLI Runner
// const SITE = 'Wavers West';
// const START_DATE = '2026-07-01';
// const END_DATE = '2026-07-31';
// const OUTPUT_DIR = path.join(__dirname, '../output_excel_west_01to31_july');

// async function run() {
//   let hadError = false;
//   try {
//     await connectDB();
//     console.log('--- 🛠️ Balance Sheet Excel Generation Started ---');

//     if (!fs.existsSync(OUTPUT_DIR)) {
//       fs.mkdirSync(OUTPUT_DIR, { recursive: true });
//     }

//     console.log(`🚀 Processing Balance Sheet for site "${SITE}" from ${START_DATE} to ${END_DATE}...`);

//     const generatedFilePath = await generateBalanceSheetExcel({
//       site: SITE,
//       startDate: START_DATE,
//       endDate: END_DATE,
//       outputDirPath: OUTPUT_DIR
//     });

//     console.log(`✅ Finished! Excel saved to: ${generatedFilePath}`);
//   } catch (error) {
//     hadError = true;
//     console.error('❌ Balance Sheet Excel Generation failed:', error);
//   } finally {
//     try {
//       await mongoose.disconnect();
//       console.log('🔌 Disconnected from MongoDB');
//     } catch (e) {
//       // Ignore disconnect error
//     }
//     process.exit(hadError ? 1 : 0);
//   }
// }

// if (require.main === module) run();

// module.exports = { run, generateBalanceSheetExcel };
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const Location = require('../models/Location');

// Import exact EOD generator helpers
const {
  fetchEodDataForDate,
  combineEodData
} = require('../utils/eodReportWavers'); // Adjust path as needed

/**
 * Date range generator helper (YYYY-MM-DD strings)
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
 * Core Helper: Creates an Excel sheet from a formatted EOD Data object.
 * Returns both the generated file path and the calculated variance.
 */
async function buildAndSaveExcelFile({ site, dateLabel, eodData, outputDirPath }) {
  const tenders = eodData.tenders || {};
  const debitClearing = tenders['DEBIT'] || 0;
  const visaClearing = tenders['VISA'] || 0;
  const mcClearing = tenders['MASTERCARD'] || tenders['MC'] || 0;
  const amexClearing = tenders['AMEX'] || 0;

  // Extract A/R Details
  let chargeAccountsIncurred = 0;
  let chargeAccountsPaid = 0;
  Object.values(eodData.arCustomers || {}).forEach((cust) => {
    chargeAccountsIncurred += cust.incurred || 0;
    chargeAccountsPaid += cust.paid || 0;
  });

  // Calculations
  const cashOverShortVal = -eodData.overShortCash;
  const fuelAdjustmentVal = -eodData.adjFuelVariance;
  const updatedCpl = -eodData.fuelPriceOverrides;

  // Construct Excel Sheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Balance Sheet');

  worksheet.columns = [
    { header: '', key: 'label', width: 26 },
    { header: '', key: 'debit', width: 18 },
    { header: '', key: 'credit', width: 18 },
    { header: '', key: 'empty', width: 10 },
    { header: '', key: 'variance', width: 18 }
  ];

  const rows = [
    { label: 'Debit Clearing', debit: debitClearing, credit: null },
    { label: 'Visa Clearing', debit: visaClearing, credit: null },
    { label: 'MC Clearing', debit: mcClearing, credit: null },
    { label: 'Amex Clearing', debit: amexClearing, credit: null },
    { label: 'Charge Accounts', debit: chargeAccountsIncurred, credit: null },
    { label: 'Charge Accounts Paid', debit: null, credit: chargeAccountsPaid },
    { label: 'Cash collected', debit: eodData.totalCanadianCashCollected, credit: null },
    { label: 'Cheques Collected', debit: eodData.chequesCashedOut, credit: null },
    { label: 'Fuel Sales', debit: null, credit: eodData.fuelSales },
    { label: 'CPL', debit: updatedCpl, credit: null },
    { label: 'Item Sales', debit: null, credit: eodData.itemSales },
    { label: 'GST Collected', debit: null, credit: eodData.gst },
    { label: 'PST Collected', debit: null, credit: eodData.pst },
    { label: 'Cash Over/Short', debit: cashOverShortVal, credit: null },
    { label: 'Fuel Sales Adjustment', debit: null, credit: fuelAdjustmentVal },
    { label: 'Penny Rounding', debit: null, credit: eodData.pennyRounding },
    { label: '', debit: null, credit: null },                                     // Row 17 (Blank)
    { label: 'lotto payout', debit: eodData.lottoPayout, credit: null },         // Row 18
    { label: '', debit: null, credit: null }                                      // Row 19 (Blank)
  ];

  rows.forEach((r) => worksheet.addRow(r));

  // Row 20: Grand Totals
  const totalRow = worksheet.addRow({
    label: '',
    debit: { formula: 'SUM(B1:B19)' },
    credit: { formula: 'SUM(C1:C19)' },
    empty: null,
    variance: null
  });

  // Row 21: Blank Separator
  worksheet.addRow({ label: '', debit: null, credit: null, empty: null, variance: null });

  // Row 22: Final Variance Comparison (Row 20 Debit - Row 20 Credit -> B21 - C21 in 1-based indexing)
  const comparisonRow = worksheet.addRow({
    label: '',
    debit: null,
    credit: null,
    empty: null,
    variance: { formula: 'B21-C21' }
  });

  // Formatting & Styling
  const currencyFormat = '$#,##0.00;-$#,##0.00;"$"0.00';

  worksheet.eachRow((row) => {
    row.getCell(1).font = { name: 'Calibri', size: 11 };

    ['B', 'C', 'E'].forEach((colLetter) => {
      const cell = row.getCell(colLetter);
      if (cell.value !== null && cell.value !== undefined) {
        cell.numberFormat = currencyFormat;
        cell.alignment = { horizontal: 'right' };
        cell.font = { name: 'Calibri', size: 11 };
      }
    });
  });

  // Row 20 Totals Styling
  totalRow.getCell('B').font = { name: 'Calibri', size: 11, bold: true };
  totalRow.getCell('C').font = { name: 'Calibri', size: 11, bold: true };
  ['B', 'C'].forEach((colLetter) => {
    totalRow.getCell(colLetter).border = {
      top: { style: 'thin' },
      bottom: { style: 'double' }
    };
  });

  // Row 22 Variance Styling
  comparisonRow.getCell('E').font = { name: 'Calibri', size: 11, bold: true };

  // JS calculation of the comparison variance for logging purposes
  const calculatedDebitTotal =
    debitClearing + visaClearing + mcClearing + amexClearing +
    chargeAccountsIncurred + eodData.totalCanadianCashCollected +
    eodData.chequesCashedOut + updatedCpl + cashOverShortVal;

  const calculatedCreditTotal =
    chargeAccountsPaid + eodData.fuelSales + eodData.itemSales +
    eodData.gst + eodData.pst + fuelAdjustmentVal +
    eodData.pennyRounding + eodData.lottoPayout;

  const numericComparisonVariance = calculatedDebitTotal - calculatedCreditTotal;

  // Write file to disk
  const filename = `Balance_Sheet_${site}_${dateLabel}.xlsx`;
  const filePath = path.join(outputDirPath, filename);
  await workbook.xlsx.writeFile(filePath);

  return { filePath, varianceVal: numericComparisonVariance };
}

/**
 * Generates individual daily Balance Sheets and one Combined Balance Sheet.
 */
async function generateBalanceSheetExcel({ site, startDate, endDate, outputDirPath = __dirname }) {
  const location = await Location.findOne({ site }).lean();
  const isManitoba = location?.province === 'MB' || location?.province === 'Manitoba';

  const dates = getDateRange(startDate, endDate);
  const dailyDataList = [];

  console.log(`\n================ BALANCE SHEET GENERATION ================`);
  
  // 1️⃣ Loop through every day, fetch EOD data, build & save daily Excel files
  for (const date of dates) {
    const dailyEod = await fetchEodDataForDate({ site, date, isManitoba });
    dailyDataList.push(dailyEod);

    const { varianceVal } = await buildAndSaveExcelFile({
      site,
      dateLabel: date,
      eodData: dailyEod,
      outputDirPath
    });

    const formattedVariance = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(varianceVal);
    console.log(`📅 Date: ${date} | Comparison Row (B21-C21): ${formattedVariance}`);
  }

  // 2️⃣ Combine all daily data using combineEodData helper
  const cumulativeData = combineEodData(dailyDataList);

  if (!cumulativeData) {
    throw new Error(`Failed to combine EOD data for site ${site}`);
  }

  // 3️⃣ Build & Save Cumulative Excel file
  const cumulativeLabel = `${startDate}_to_${endDate}`;
  const { filePath: cumulativePath, varianceVal: cumulativeVariance } = await buildAndSaveExcelFile({
    site,
    dateLabel: cumulativeLabel,
    eodData: cumulativeData,
    outputDirPath
  });

  const formattedCumVariance = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cumulativeVariance);
  console.log(`----------------------------------------------------------`);
  console.log(`📊 COMBINED RANGE: ${startDate} to ${endDate} | Comparison Row (B21-C21): ${formattedCumVariance}`);
  console.log(`==========================================================\n`);

  return cumulativePath;
}

// Configuration & CLI Runner
const SITE = 'Wavers West';
const START_DATE = '2026-07-01';
const END_DATE = '2026-07-31';
const OUTPUT_DIR = path.join(__dirname, '../output_excel_west_01to31_july');

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('--- 🛠️ Balance Sheet Excel Generation Started ---');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log(`🚀 Processing Balance Sheets for site "${SITE}" from ${START_DATE} to ${END_DATE}...`);

    await generateBalanceSheetExcel({
      site: SITE,
      startDate: START_DATE,
      endDate: END_DATE,
      outputDirPath: OUTPUT_DIR
    });

    console.log(`✅ Finished! All daily & combined Excel files saved to: ${OUTPUT_DIR}`);
  } catch (error) {
    hadError = true;
    console.error('❌ Balance Sheet Excel Generation failed:', error);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    } catch (e) {
      // Ignore disconnect error
    }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run, generateBalanceSheetExcel };