const xlsx = require('xlsx');
const mongoose = require('mongoose');
const CycleCount = require('../models/CycleCount');
const connectDB = require('../config/db');

async function syncInventoryFromExcel() {
  // 1. Load the Excel Data
  const workbook = xlsx.readFile('items_to_remove.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  if (data.length === 0) {
    console.log("Excel sheet is empty.");
    return;
  }

  // 2. Prepare Bulk Operations
  const bulkOps = data.map((row) => {
    const upcExcel = String(row['UPC-A (12 digits)'] || '').trim();
    const stationExcel = String(row['Station Name'] || '').trim();
    const descriptionExcel = String(row['Description'] || '').trim();
    const categoryIdExcel = String(row['Category ID'] || '').trim();

    if (!upcExcel) return null;

    // Get the first word for the name match
    const firstWord = descriptionExcel.split(/\s+/)[0];

    return {
      updateMany: {
        filter: {
          upc_barcode: { $regex: new RegExp(`^${upcExcel}$`, 'i') }, // Direct match from Excel
          // site: stationExcel,
          categoryNumber: categoryIdExcel,
          name: { $regex: new RegExp(`^${firstWord}`, 'i') }, // Starts with first word
          inventoryExists: true // Only target items that are currently true
        },
        update: {
          $set: { inventoryExists: false }
        }
      }
    };
  }).filter(op => op !== null); // Remove empty rows

  // 3. Counting & Verification (Replacing the Bulk Write block)
  if (bulkOps.length > 0) {
    console.log(`--- Pre-Sync Analysis ---`);
    console.log(`Total rows in Excel with a UPC: ${bulkOps.length}`);

    let totalFoundInSystem = 0;
    let totalNeedingUpdate = 0;

    // We iterate through the filters we built to check the DB state
    for (const op of bulkOps) {
      const filter = op.updateMany.filter;

      // 1. Check if the item exists at all (ignoring inventoryExists status)
      const { inventoryExists, ...existenceFilter } = filter;
      const exists = await CycleCount.countDocuments(existenceFilter);
      if (exists > 0) totalFoundInSystem++;

      // 2. Check if it matches the full filter (including inventoryExists: true)
      const needsUpdate = await CycleCount.countDocuments(filter);
      if (needsUpdate > 0) totalNeedingUpdate++;
    }

    console.log(`Total products found in System: ${totalFoundInSystem}`);
    console.log(`Total products needing update (currently true): ${totalNeedingUpdate}`);

    /* // Commented out for now as requested
    console.log(`Executing bulk update...`);
    const result = await CycleCount.bulkWrite(bulkOps, { ordered: false });
    console.log('--- Sync Summary ---');
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    */

  } else {
    console.log("No valid rows found to process.");
  }
}

async function run() {
  let hadError = false;
  try {
    await connectDB(); 
    console.log('Starting Batch Category/Product Mapping Sync...');
    await syncInventoryFromExcel();
  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run };