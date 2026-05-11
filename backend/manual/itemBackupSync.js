const connectDB = require("../config/db");
const mongoose = require("mongoose");

const { getPg } = require("../config/pg");
const ItemBk = require("../pg/models/itemBk");
const Location = require("../models/Location");
const CycleCount = require("../models/CycleCount");
const { getFullItemBackupData } = require("../services/sqlService");

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();

async function runItemBackupSync() {
  console.log("--- Starting Azure SQL -> Postgres item_bk sync ---");

  const [azureData, mongoLocations, mongoGrades] = await Promise.all([
    getFullItemBackupData(),
    Location.find({}, "csoCode stationName _id"),
    CycleCount.find({}, "gtin grade site"),
  ]);

  console.log(`Fetched ${azureData.length} records from Azure SQL.`);

  const locationMap = new Map(
    mongoLocations.map((loc) => [String(loc.csoCode), loc._id.toString()])
  );

  const locationResolver = new Map();
  for (const loc of mongoLocations) {
    const mongoId = loc._id.toString();
    locationResolver.set(normalizeKey(mongoId), mongoId);
    locationResolver.set(normalizeKey(loc.csoCode), mongoId);
    locationResolver.set(normalizeKey(loc.stationName), mongoId);
  }

  const gradeMap = new Map();
  let unmappedGradeCount = 0;
  for (const gradeRow of mongoGrades) {
    if (!gradeRow?.site || !gradeRow?.gtin) continue;

    const mongoSiteId = locationResolver.get(normalizeKey(gradeRow.site));
    if (!mongoSiteId) {
      unmappedGradeCount += 1;
      continue;
    }

    gradeMap.set(`${mongoSiteId}_${String(gradeRow.gtin)}`, gradeRow.grade);
  }

  if (unmappedGradeCount > 0) {
    console.warn(`Skipped ${unmappedGradeCount} CycleCount grade rows with unmapped sites.`);
  }

  const db = getPg();

  const rows = [];
  for (const item of azureData) {
    const upc = item?.UPC != null ? String(item.UPC) : null;
    const stationSk = item?.Station_SK != null ? String(item.Station_SK) : null;
    if (!upc || !stationSk) continue;

    const mongoSiteId = locationMap.get(stationSk);
    if (!mongoSiteId) continue;

    const gtin = item?.GTIN != null ? String(item.GTIN) : null;
    const gradeKey = gtin ? `${mongoSiteId}_${gtin}` : null;
    const grade = (gradeKey && gradeMap.get(gradeKey)) || "B";

    rows.push({
      site: mongoSiteId,
      upc,
      gtin,
      upc_barcode: item?.upc_barcode != null ? String(item.upc_barcode) : null,
      description: item?.Description ?? null,
      retail: item?.Retail != null ? String(item.Retail) : null,
      vendor_id: item?.vendorId != null ? String(item.vendorId) : null,
      vendor_name: item?.vendorName ?? null,
      category_id: toNullableNumber(item?.categoryId),
      department_id: item?.departmentId != null ? String(item.departmentId) : null,
      department: item?.Department ?? null,
      price_group_id: item?.priceGroupId != null ? String(item.priceGroupId) : null,
      price_group: item?.priceGroup ?? null,
      promo_group_id: item?.promoGroupId != null ? String(item.promoGroupId) : null,
      promo_group: item?.promoGroup ?? null,
      on_hand_qty: toNullableNumber(item?.onHandQty),
      last_inv_date: item?.last_inv_date ? new Date(item.last_inv_date) : null,
      grade,
      active: true,
      sync_date: db.fn.now(),
    });
  }

  console.log(`Prepared ${rows.length} rows for upsert (skipped ${azureData.length - rows.length}).`);

  const chunkSize = Number(process.env.ITEM_BK_SYNC_CHUNK || 200);
  const chunks = chunk(rows, chunkSize);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    await ItemBk.upsertMany(c);

    console.log(`Synced ${Math.min((i + 1) * chunkSize, rows.length)} / ${rows.length}`);
  }

  console.log("item_bk sync completed successfully.");
}

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await runItemBackupSync();
  } catch (err) {
    hadError = true;
    console.error("Sync failed:", err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Mongo disconnected.");
    } catch (e) {}
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
