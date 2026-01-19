const connectDB = require('../config/db');
const mongoose = require('mongoose');

const CycleCount = require("../models/CycleCount");

/**
 * Synchronizes upc_barcode with GTIN-based scannable logic.
 * Only updates records where a mismatch is found based on retail standards.
 */
async function syncBarcodesWithGtin() {
  try {
    console.log('--- Starting Production Barcode Update ---\n');

    const items = await CycleCount.find({ gtin: { $exists: true, $ne: null } });

    const bulkOps = [];
    const updatedLogs = [];
    let matchCount = 0;
    let updateCount = 0;

    for (const item of items) {
      const fullGtin = item.gtin.toString();
      const currentBarcode = item.upc_barcode ? item.upc_barcode.toString() : '';
      let calculatedBarcode = '';

      // --- APPLY VALIDATED LOGIC ---
      if (fullGtin.startsWith('00000000')) {
        calculatedBarcode = currentBarcode; // Internal/PLU Exception
      }
      else if (fullGtin.startsWith('000000')) {
        if (currentBarcode.length === 12 || currentBarcode.length === 13) {
          calculatedBarcode = currentBarcode; // Padded EAN-8 Exception
        } else {
          calculatedBarcode = fullGtin.slice(-8); // Standard EAN-8
        }
      }
      else if (fullGtin.startsWith('00')) {
        if (currentBarcode.length === 13) {
          calculatedBarcode = currentBarcode; // EAN-13 Preservation
        } else {
          calculatedBarcode = fullGtin.slice(-12); // UPC-A Restoration (The Fix)
        }
      }
      else if (fullGtin.startsWith('0')) {
        calculatedBarcode = fullGtin.slice(-13); // Standard EAN-13
      }
      else {
        calculatedBarcode = fullGtin; // GTIN-14 Case
      }

      // --- CHECK FOR UPDATE NEEDED ---
      if (calculatedBarcode !== currentBarcode) {
        updateCount++;

        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            // 1. Remove updatedAt from here
            update: { $set: { upc_barcode: calculatedBarcode } },
            // 2. This tells MongoDB/Mongoose not to touch the updatedAt field automatically
            timestamps: false
          }
        });

        // Log for transparency
        if (updatedLogs.length < 200) {
          updatedLogs.push({
            GTIN: fullGtin,
            Name: item.name.substring(0, 25),
            Old: currentBarcode,
            New: calculatedBarcode
          });
        }
      } else {
        matchCount++;
      }
    }

    // --- EXECUTE BULK UPDATE ---
    if (bulkOps.length > 0) {
      console.log(`Applying updates to ${bulkOps.length} records...`);
      await CycleCount.bulkWrite(bulkOps);

      console.log('\n--- Sample of Updated Records (First 200) ---');
      console.table(updatedLogs);
    } else {
      console.log('No mismatches found. Database is already scannable.');
    }

    console.log('\n--- Final Sync Summary ---');
    console.log(`Total Items Evaluated: ${items.length}`);
    console.log(`Already Correct:       ${matchCount}`);
    console.log(`Successfully Updated:  ${updateCount}`);

  } catch (err) {
    console.error('CRITICAL ERROR during sync:', err);
  }
}

async function run() {
  let hadError = false;

  try {
    await connectDB();
    await syncBarcodesWithGtin();

  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
module.exports = { run };
