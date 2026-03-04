const connectDB = require('../config/db');
const mongoose = require('mongoose');
const CycleCount = require("../models/CycleCount");

/**
 * Replicates inventory structure from Site A to Site B
 * 1. Clears existing Site B data
 * 2. Fetches Site A data
 * 3. Maps Site A data to new Site B documents with specific defaults
 */
async function syncSiteInventory(sourceSite, targetSite) {
  try {
    console.log(`Cleaning up stale data for site: ${targetSite}...`);
    // Step 1: Delete all existing records for Site B
    await CycleCount.deleteMany({ site: targetSite });

    console.log(`Fetching source data from site: ${sourceSite}...`);
    // Step 2: Get all records from Site A
    const sourceItems = await CycleCount.find({ site: sourceSite }).lean();

    if (sourceItems.length === 0) {
      console.log(`No items found in ${sourceSite}. Nothing to copy.`);
      return;
    }

    // Step 3: Transform Site A items into the new Site B structure
    const newItems = sourceItems.map(item => {
      return {
        site: targetSite,
        upc: item.upc,
        name: item.name,
        categoryNumber: item.categoryNumber,
        active: item.active,
        inventoryExists: item.inventoryExists,
        grade: item.grade,
        gtin: item.gtin,
        upc_barcode: item.upc_barcode,
        updatedAt: new Date('2025-09-18T00:00:00Z'),
      };
    });

    console.log(`Inserting ${newItems.length} items into site: ${targetSite}...`);
    // Step 4: Bulk insert into the collection
    await CycleCount.insertMany(newItems);

    console.log('Site replication completed successfully.');
  } catch (error) {
    console.error('Error during site inventory sync:', error);
    throw error;
  }
}

async function run() {
  let hadError = false;

  try {
    // Assuming connectDB is defined elsewhere in your script
    await connectDB(); 
    console.log('Starting Site Replicator...\n');

    // Run the function: Copy from 'A' to 'B'
    await syncSiteInventory('Silver Grizzly', 'Charlies');

    console.log('Sync completed successfully.');
  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch {}
    process.exit(hadError ? 1 : 0);
  }
}


if (require.main === module) run();
module.exports = { run };