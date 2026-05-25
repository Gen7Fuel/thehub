const { getPg } = require("../config/pg");
const Location = require("../models/Location");
const ProductCategory = require("../models/ProductCategory");
const { getSanitizationBackupData } = require("../services/sqlService");
const { format } = require("date-fns");
const cron = require("node-cron");

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

async function runSanitizeItemBk() {
  console.log("--- Starting Saturday Morning Item Sanitization Protocol ---");
  const db = getPg();
  const todayDateStr = format(new Date(), "yyyy-MM-dd");

  // 1. Fetch Azure SQL, Mongo Locations, and Product Categories concurrently
  const [azureData, mongoLocations, mongoCategories] = await Promise.all([
    getSanitizationBackupData(),
    Location.find({}, "csoCode stationName _id"),
    ProductCategory.find({}),
  ]);

  console.log(`Fetched ${azureData.length} records from Azure SQL.`);

  // 2. Build Location Mappings
  const locationMap = new Map(mongoLocations.map(loc => [String(loc.csoCode), loc._id.toString()]));

  // 3. Build Mongo Category Map Dictionary 
  const categoryDictionary = new Map(mongoCategories.map(cat => [Number(cat.Number), cat.Name]));

  // 4. Fetch all current Postgres records into memory
  console.log("Downloading active Postgres backup map...");
  const pgItems = await db("item_bk").select("id", "site", "upc", "gtin", "upc_barcode", "description", "retail", "vendor_id", "vendor_name", "category_id", "department_id", "department", "price_group_id", "price_group", "promo_group_id", "promo_group", "on_hand_qty", "last_inv_date");

  // Create lookup key composite string: "siteMongoId_upc"
  const pgMap = new Map(pgItems.map(item => [`${item.site}_${item.upc}`, item]));

  const rowsToInsert = [];
  const rowsToUpdate = [];
  const trackedAzureKeys = new Set();

  // 5. Process Azure SQL dataset against Postgres records map
  for (const item of azureData) {
    const upc = item?.UPC != null ? String(item.UPC) : null;
    const stationSk = item?.Station_SK != null ? String(item.Station_SK) : null;
    if (!upc || !stationSk) continue;

    const mongoSiteId = locationMap.get(stationSk);
    if (!mongoSiteId) continue;

    const azureKey = `${mongoSiteId}_${upc}`;
    trackedAzureKeys.add(azureKey);

    const gtin = item?.GTIN != null ? String(item.GTIN) : null;
    const categoryId = toNullableNumber(item?.categoryId);

    let lastInvDate = null;
    if (item?.last_inv_date) {
      try { lastInvDate = format(new Date(item.last_inv_date), "yyyy-MM-dd"); } catch (e) { lastInvDate = null; }
    }

    // --- MONGO PRODUCT CATEGORY CHECKSUM ---
    if (categoryId !== null && item.categoryName) {
      const existingName = categoryDictionary.get(categoryId);
      if (existingName !== item.categoryName) {
        console.log(`[CATEGORY MISMATCH] ID ${categoryId}: Syncing Mongo value to "${item.categoryName}"`);

        // FIX: Using exact schema paths 'Number' and 'Name'
        await ProductCategory.updateOne(
          { Number: categoryId },
          { $set: { Name: item.categoryName } },
          { upsert: true }
        );

        categoryDictionary.set(categoryId, item.categoryName);
      }
    }

    const match = pgMap.get(azureKey);

    if (!match) {
      // SCENARIO A: Item exists in SQL but is missing in Postgres -> ADD IT
      rowsToInsert.push({
        site: mongoSiteId, upc, gtin,
        upc_barcode: item?.upc_barcode != null ? String(item.upc_barcode) : null,
        description: item?.Description ?? null,
        retail: item?.Retail != null ? String(item.Retail) : null,
        vendor_id: item?.vendorId != null ? String(item.vendorId) : null,
        vendor_name: item?.vendorName ?? null,
        category_id: categoryId,
        department_id: item?.departmentId != null ? String(item.departmentId) : null,
        department: item?.Department ?? null,
        price_group_id: item?.priceGroupId != null ? String(item.priceGroupId) : null,
        price_group: item?.priceGroup ?? null,
        promo_group_id: item?.promoGroupId != null ? String(item.promoGroupId) : null,
        promo_group: item?.promoGroup ?? null,
        on_hand_qty: toNullableNumber(item?.onHandQty),
        last_inv_date: lastInvDate,
        last_counted_at: lastInvDate, // Seeds clean tracking baseline
        // 'grade' column is omitted here, allowing Postgres schema DEFAULT ('B') to handle it initially
        active: true,
        allow_cycle_count: true,
        image_url: item?.image_url ?? null,
        sync_date: db.fn.now()
      });
    } else {
      // SCENARIO B: Item exists in both -> VERIFY AND CORRECT SHIFTS
      // We explicitly leave 'grade' and 'last_counted_at' untouched to protect the system data
      const hasChanged =
        match.gtin !== gtin ||
        match.upc_barcode !== (item?.upc_barcode != null ? String(item.upc_barcode) : null) ||
        match.description !== (item?.Description ?? null) ||
        match.retail !== (item?.Retail != null ? String(item.Retail) : null) ||
        match.vendor_id !== (item?.vendorId != null ? String(item.vendorId) : null) ||
        match.vendor_name !== (item?.vendorName ?? null) ||
        match.category_id !== categoryId ||
        match.department_id !== (item?.departmentId != null ? String(item.departmentId) : null) ||
        match.department !== (item?.Department ?? null) ||
        match.price_group_id !== (item?.priceGroupId != null ? String(item.priceGroupId) : null) ||
        match.price_group !== (item?.priceGroup ?? null) ||
        match.promo_group_id !== (item?.promoGroupId != null ? String(item.promoGroupId) : null) ||
        match.promo_group !== (item?.promoGroup ?? null) ||
        Number(match.on_hand_qty) !== toNullableNumber(item?.onHandQty) ||
        match.last_inv_date !== lastInvDate ||
        match.image_url !== (item?.image_url ?? null);

      if (hasChanged) {
        rowsToUpdate.push({
          id: match.id,
          gtin,
          upc_barcode: item?.upc_barcode != null ? String(item.upc_barcode) : null,
          description: item?.Description ?? null,
          retail: item?.Retail != null ? String(item.Retail) : null,
          vendor_id: item?.vendorId != null ? String(item.vendorId) : null,
          vendor_name: item?.vendorName ?? null,
          category_id: categoryId,
          department_id: item?.departmentId != null ? String(item.departmentId) : null,
          department: item?.Department ?? null,
          price_group_id: item?.priceGroupId != null ? String(item.priceGroupId) : null,
          price_group: item?.priceGroup ?? null,
          promo_group_id: item?.promoGroupId != null ? String(item.promoGroupId) : null,
          promo_group: item?.promoGroup ?? null,
          on_hand_qty: toNullableNumber(item?.onHandQty),
          last_inv_date: lastInvDate,
          image_url: item?.image_url ?? null,
          sync_date: db.fn.now()
        });
      }
    }
  }

  // SCENARIO C: Exists in Postgres but missing from Azure SQL -> SOFT-DELETE & LOG IT
  const idsToRemove = [];
  const logEntriesToInsert = [];

  for (const [key, pgItem] of pgMap.entries()) {
    // Only target items that are currently active
    if (!trackedAzureKeys.has(key) && pgItem.active !== false) {
      idsToRemove.push(pgItem.id);
      logEntriesToInsert.push({
        upc: pgItem.upc,
        upc_barcode: pgItem.upc_barcode,
        description: pgItem.description,
        gtin: pgItem.gtin,
        site: pgItem.site,
        removed_at: todayDateStr
      });
    }
  }

  // Execution Batch update:
  if (idsToRemove.length > 0) {
    await db.transaction(async (trx) => {
      // ✅ FIX: Swap out .del() for a safe soft-delete update statement
      await trx("item_bk")
        .whereIn("id", idsToRemove)
        .update({ active: false, sync_date: db.fn.now() });

      // Still write to the historical audit log
      const logChunks = chunkArray(logEntriesToInsert, 200);
      for (const batch of logChunks) {
        await trx("deleted_items_log").insert(batch);
      }
    });
    console.log(` Successfully soft-deleted ${idsToRemove.length} records and wrote to logs.`);
  }

  // 6. Execution Batches
  console.log(`Summary: Inserts: ${rowsToInsert.length} | Updates: ${rowsToUpdate.length} | Deletions & Logs: ${idsToRemove.length}`);

  if (rowsToInsert.length > 0) {
    const insertChunks = chunkArray(rowsToInsert, 200);
    for (const batch of insertChunks) {
      await db("item_bk").insert(batch);
    }
  }

  if (rowsToUpdate.length > 0) {
    for (const row of rowsToUpdate) {
      const { id, ...data } = row;
      await db("item_bk").where({ id }).update(data);
    }
  }

  // Execution Batch update:
  if (idsToRemove.length > 0) {
    await db.transaction(async (trx) => {
      // ✅ FIX: Swap out .del() for a safe soft-delete update statement
      await trx("item_bk")
        .whereIn("id", idsToRemove)
        .update({ active: false, sync_date: db.fn.now() });

      // Still write to the historical audit log
      const logChunks = chunkArray(logEntriesToInsert, 200);
      for (const batch of logChunks) {
        await trx("deleted_items_log").insert(batch);
      }
    });
    console.log(` Successfully soft-deleted ${idsToRemove.length} records and wrote to logs.`);
  }

  console.log("Sanitization complete.");
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Runs every Saturday at exactly 03:00 AM
cron.schedule("0 3 * * 6", async () => {
  console.log(`[${new Date().toISOString()}] Triggering scheduled Saturday morning Item Book Sanitization Protocol...`);
  try {
    await runSanitizeItemBk();
    console.log(`[${new Date().toISOString()}] Saturday morning Item Book Sanitization completed successfully.`);
  } catch (error) {
    console.error("Critical Failure running Saturday Item Book Sanitization:", error);
  }
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { runSanitizeItemBk };