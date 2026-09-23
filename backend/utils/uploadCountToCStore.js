const { getPg } = require("../config/pg");
const Location = require('../models/Location');
const { generateInventoryCsvBuffer } = require('./generateCsoCountCsv');
const { petrosoftQueue } = require('../queues/petrosoftQueue');

/**
 * Main orchestration engine to pull counts from Postgres, compile the memory CSV buffer,
 * and dispatch execution blocks to the background BullMQ worker instance.
 */
async function syncPostgresCountsToPetrosoft(locationId, targetDate) {
  try {
    console.log(`🚀 Starting synchronization sequence for Location: ${locationId} on Date: ${targetDate}`);
    
    // 1. Fetch location data from MongoDB
    const locationDoc = await Location.findById(locationId).lean();
    if (!locationDoc) {
      throw new Error(`Location record not identified for internal ID parameter: ${locationId}`);
    }

    const siteMongoIdStr = locationDoc._id.toString();
    const csoCode = locationDoc.csoCode;

    if (!csoCode) {
      throw new Error(`Missing crucial 'csoCode' properties on MongoDB profile for location: ${locationDoc.stationName}`);
    }

    // 2. Query target cycle count elements out of Postgres (including manager fields & is_scheduled flag)
    const db = getPg();
    const rows = await db('cycle_count_instance as cci')
      .join('cycle_count_items as cci_items', 'cci.id', 'cci_items.instance_id')
      .join('item_bk as ibk', 'cci_items.product_id', 'ibk.id')
      .where('cci.site_mongo_id', siteMongoIdStr)
      .where('cci.date', targetDate.toString())
      .select([
        'cci.is_scheduled', // 💡 Selected is_scheduled from cci
        'ibk.gtin',
        'cci_items.foh',
        'cci_items.boh',
        'cci_items.foh_crt',
        'cci_items.boh_crt',
        'cci_items.manager_foh',     // 💡 Selected manager count fields
        'cci_items.manager_boh',
        'cci_items.manager_foh_crt',
        'cci_items.manager_boh_crt',
        'ibk.pk_in_crt'
      ]);

    if (!rows || rows.length === 0) {
      console.log(`🏁 Sync terminated: 0 inventory records found matching Date/Site arguments.`);
      return { success: false, reason: "NO_POSTGRES_RECORDS" };
    }

    // 3. Filter and Process records into normalized unit packs
    const compiledItems = [];

    for (const row of rows) {
      const isScheduled = Boolean(row.is_scheduled);

      // Determine final FOH and BOH (Manager override if isScheduled is true and manager counts exist)
      let finalFoh = row.foh;
      let finalBoh = row.boh;
      let finalFohCrt = row.foh_crt;
      let finalBohCrt = row.boh_crt;

      if (isScheduled) {
        if (row.manager_foh !== null && row.manager_foh !== undefined) {
          finalFoh = row.manager_foh;
        }
        if (row.manager_boh !== null && row.manager_boh !== undefined) {
          finalBoh = row.manager_boh;
        }
        if (row.manager_foh_crt !== null && row.manager_foh_crt !== undefined) {
          finalFohCrt = row.manager_foh_crt;
        }
        if (row.manager_boh_crt !== null && row.manager_boh_crt !== undefined) {
          finalBohCrt = row.manager_boh_crt;
        }
      }

      // Ensure counts are completed
      if (finalFoh === null || finalBoh === null) continue;

      const pksInCrt = Number(row.pk_in_crt || 0);

      // If item is configured to support crates, verify crate counts exist
      if (pksInCrt > 0) {
        if (finalFohCrt === null || finalBohCrt === null) continue;
      }

      // Calculate total pack quantities (base loose packs + crate packs)
      const basePacks = (finalFoh ?? 0) + (finalBoh ?? 0);
      const cratePacks = (pksInCrt * (finalFohCrt ?? 0)) + (pksInCrt * (finalBohCrt ?? 0));

      const totalCalculatedPacks = basePacks + cratePacks;

      compiledItems.push({
        gtin: row.gtin,
        totalCalculatedPacks
      });
    }

    if (compiledItems.length === 0) {
      console.log(`🏁 Sync terminated: 0 fully completed records remained after filtering.`);
      return { success: false, reason: "NO_COMPLETED_POSTGRES_RECORDS" };
    }

    // 4. Transform inventory collection arrays into an in-memory CSV stream buffer
    console.log(`📊 Processing ${compiledItems.length} valid completed records into structural ExcelJS CSV layout...`);
    const csvFileBuffer = await generateInventoryCsvBuffer({
      items: compiledItems,
      instanceDate: targetDate
    });

    // 💡 5. Convert memory buffer to a base64 string layout to safely transport it via Redis/BullMQ
    console.log("✈️ Enqueueing execution job to the background processing grid...");
    const csvBase64 = csvFileBuffer.toString("base64");

    await petrosoftQueue.add(
      `petrosoft-sync-${locationId}-${Date.now()}`,
      {
        targetStationCsoCode: csoCode,
        csvBase64: csvBase64
      },
      {
        removeOnComplete: true,
        removeOnFail: true // Retain failed instances for your dashboard telemetry views
      }
    );

    console.log(`🤖 Petrosoft browser synchronization job safely structured and queued.`);
    return { success: true, queued: true };

  } catch (err) {
    console.error("❌ Orchestration Engine Execution Pipeline Faulted:", err);
    throw err;
  }
}

module.exports = { syncPostgresCountsToPetrosoft };