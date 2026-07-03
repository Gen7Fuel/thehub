const { getPg } = require("../config/pg");
const Location = require('../models/Location');
const { generateInventoryCsvBuffer } = require('./generateCsoCountCsv');
const { petrosoftQueue } = require('../queues/petrosoftQueue'); // 💡 Import your new queue here

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

    // 2. Query target cycle count elements out of Postgres
    const db = getPg();
    const rows = await db('cycle_count_instance as cci')
      .join('cycle_count_items as cci_items', 'cci.id', 'cci_items.instance_id')
      .join('item_bk as ibk', 'cci_items.product_id', 'ibk.id')
      .where('cci.site_mongo_id', siteMongoIdStr)
      .where('cci.date', targetDate.toString())
      .select([
        'ibk.gtin',
        'cci_items.foh',
        'cci_items.boh',
        'cci_items.foh_crt',
        'cci_items.boh_crt',
        'cci_items.foh_case',
        'cci_items.boh_case',
        'ibk.pk_in_crt',
        'ibk.crt_in_case'
      ]);

    if (!rows || rows.length === 0) {
      console.log(`🏁 Sync terminated: 0 inventory records found matching Date/Site arguments.`);
      return { success: false, reason: "NO_POSTGRES_RECORDS" };
    }

    // 3. Filter and Process records into normalized unit packs
    const compiledItems = [];

    for (const row of rows) {
      if (row.foh === null || row.boh === null) continue;

      const pksInCrt = Number(row.pk_in_crt || 0);

      if (pksInCrt > 0) {
        if (row.foh_crt === null || row.boh_crt === null) continue;
      }

      const crtsInCase = Number(row.crt_in_case || 0);
      const pksInCase = pksInCrt * crtsInCase; 

      const basePacks = (row.foh ?? 0) + (row.boh ?? 0);
      const cratePacks = (pksInCrt * (row.foh_crt ?? 0)) + (pksInCrt * (row.boh_crt ?? 0));
      const casePacks = (pksInCase * (row.foh_case ?? 0)) + (pksInCase * (row.boh_case ?? 0));

      const totalCalculatedPacks = basePacks + cratePacks + casePacks;

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