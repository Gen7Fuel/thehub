const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db'); // Adjust relative path to your DB config if needed

// Import Chicken Delight EOD module helpers
const {
  fetchChickenDelightEodDataForDate,
  combineChickenDelightEodData,
  generateChickenDelightEodReportBuffer
} = require('../utils/eodCDReportWavers'); // Adjust relative path as needed

// ==========================================
// CONFIGURATION VARIABLES (UPDATE AS NEEDED)
// ==========================================
const SITE = 'Wavers West';
const START_DATE = '2026-07-01'; // YYYY-MM-DD
const END_DATE = '2026-07-15';   // YYYY-MM-DD
const OUTPUT_DIR = path.join(__dirname, '../output_pdfs/chicken_delight');
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
    // 1. Connect to DB
    await connectDB();
    console.log('--- 🛠️ Chicken Delight Batch EOD Generation Started ---');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const dates = getDateRange(START_DATE, END_DATE);
    console.log(`🚀 Processing site "${SITE}" across ${dates.length} days (${START_DATE} to ${END_DATE})...`);

    const dailyDataList = [];

    // 2. Process each day: fetch data & write individual daily PDFs
    for (const date of dates) {
      console.log(`📄 Generating Chicken Delight PDF for ${date}...`);
      const dailyData = await fetchChickenDelightEodDataForDate({ site: SITE, date });
      dailyDataList.push(dailyData);

      const pdfBuffer = await generateChickenDelightEodReportBuffer({ 
        site: SITE, 
        date, 
        data: dailyData 
      });

      const filePath = path.join(OUTPUT_DIR, `Chicken-Delight-EOD-${SITE}_${date}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
    }

    // 3. Process Cumulative PDF across date range
    console.log(`📊 Generating Cumulative Chicken Delight PDF for ${START_DATE} to ${END_DATE}...`);
    const cumulativeData = combineChickenDelightEodData(dailyDataList);
    const cumulativeDateLabel = `${START_DATE} to ${END_DATE}`;

    const cumulativePdfBuffer = await generateChickenDelightEodReportBuffer({
      site: SITE,
      date: cumulativeDateLabel,
      data: cumulativeData
    });

    const cumulativePath = path.join(
      OUTPUT_DIR, 
      `Chicken-Delight-EOD-${SITE}_CUMULATIVE_${START_DATE}_to_${END_DATE}.pdf`
    );
    fs.writeFileSync(cumulativePath, cumulativePdfBuffer);

    console.log(`✅ Success! All Chicken Delight PDFs saved to: ${OUTPUT_DIR}`);
  } catch (error) {
    hadError = true;
    console.error('❌ Chicken Delight Batch PDF Generation failed:', error);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    } catch (e) {
      // Ignore disconnect errors
    }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run };