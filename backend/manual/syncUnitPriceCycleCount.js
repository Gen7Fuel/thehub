const mongoose = require('mongoose');
const CycleCount = require('../models/CycleCount'); // Path to your CycleCount model
const Location = require('../models/Location');     // Path to your Location model
const { getBulkUnitPriceCSO } = require('../services/sqlService');
const connectDB = require('../config/db');

async function syncUnitPrices() {
  console.log('--- Starting Unit Price Sync ---');

  // 1. Create a Map of name -> csoCode
  const locations = await Location.find({}, 'name csoCode').lean();
  const siteMap = {};
  locations.forEach(loc => {
    siteMap[loc.name] = loc.csoCode;
  });

  // 2. Get all unique sites in CycleCount to process them group by group
  const uniqueSites = await CycleCount.distinct('site');

  for (const siteName of uniqueSites) {
    const csoCode = siteMap[siteName];
    if (!csoCode) {
      console.warn(`No csoCode found for site: ${siteName}. Skipping...`);
      continue;
    }

    // 3. Find all GTINs for this site
    const items = await CycleCount.find({ site: siteName }, 'gtin').lean();
    const allGtins = items.map(i => i.gtin).filter(g => !!g);

    console.log(`Processing ${siteName} (${csoCode}) - Found ${allGtins.length} GTINs`);

    // 4. Chunk GTINs into batches of 2000 (SQL Parameter Limit)
    const chunkSize = 2000;
    for (let i = 0; i < allGtins.length; i += chunkSize) {
      const batch = allGtins.slice(i, i + chunkSize);

      // 5. Fetch prices from SQL
      const priceData = await getBulkUnitPriceCSO(csoCode, batch);

      // 6. Bulk Update MongoDB
      const bulkOps = Object.keys(priceData)
        .filter(gtin => priceData[gtin] !== null && priceData[gtin] > 0)
        .map(gtin => ({
          updateOne: {
            filter: { site: siteName, gtin: gtin },
            update: { $set: { unitPrice: priceData[gtin] } },
            // IMPORTANT: timestamps: false prevents updatedAt from changing
            options: { timestamps: false }
          }
        }));

      if (bulkOps.length > 0) {
        await CycleCount.bulkWrite(bulkOps);
        console.log(`Updated ${bulkOps.length} items for ${siteName}...`);
      }
    }
  }
  console.log('--- Unit Price Sync Completed ---');
}

async function run() {
  let hadError = false;

  try {
    // Assuming connectDB is defined elsewhere in your utils
    await connectDB();

    console.log('Starting CycleCount Unit Price Update...\n');

    // Run the new sync logic
    await syncUnitPrices();

    console.log('\nSync completed successfully.');

  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
