const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Import your refactored PDF generator helpers
const {
  fetchEodDataForDate,
  combineEodData,
  generateEodReportBuffer
} = require('../utils/eodReportWavers');

// ==========================================
// CONFIGURATION VARIABLES (UPDATE AS NEEDED)
// ==========================================
const SITE = 'Wavers West';
const START_DATE = '2026-07-01'; // YYYY-MM-DD
const END_DATE = '2026-07-15';   // YYYY-MM-DD
const IS_MANITOBA = true;
const OUTPUT_DIR = path.join(__dirname, '../output_pdfs');
// ==========================================

// Date range loop helper
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

async function run() {
  let hadError = false;
  try {
    // 1. Connect using your shared db config helper
    await connectDB();
    console.log('--- 🛠️ Batch EOD PDF Generation Started ---');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const dates = getDateRange(START_DATE, END_DATE);
    console.log(`🚀 Starting batch processing for site "${SITE}" across ${dates.length} days...`);

    const dailyDataList = [];

    // 2. Loop through dates, fetch data, and write individual PDFs
    for (const date of dates) {
      console.log(`📄 Generating PDF for ${date}...`);
      const dailyData = await fetchEodDataForDate({ site: SITE, date, isManitoba: IS_MANITOBA });
      dailyDataList.push(dailyData);

      const pdfBuffer = await generateEodReportBuffer({ site: SITE, date, data: dailyData });
      const filePath = path.join(OUTPUT_DIR, `${SITE}_${date}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
    }

    // 3. Generate Cumulative PDF
    console.log(`📊 Generating Cumulative PDF for range ${START_DATE} to ${END_DATE}...`);
    const cumulativeData = combineEodData(dailyDataList);
    const cumulativeDateLabel = `${START_DATE} to ${END_DATE}`;

    const cumulativePdfBuffer = await generateEodReportBuffer({
      site: SITE,
      date: cumulativeDateLabel,
      data: cumulativeData
    });

    const cumulativePath = path.join(OUTPUT_DIR, `${SITE}_CUMULATIVE_${START_DATE}_to_${END_DATE}.pdf`);
    fs.writeFileSync(cumulativePath, cumulativePdfBuffer);

    console.log(`✅ Finished! All PDFs saved to: ${OUTPUT_DIR}`);
  } catch (error) {
    hadError = true;
    console.error('❌ Batch PDF Generation failed:', error);
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

module.exports = { run };