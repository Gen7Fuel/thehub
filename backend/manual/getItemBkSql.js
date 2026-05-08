const connectDB = require('../config/db');
const mongoose = require('mongoose');
const prisma = require('../lib/prisma');
const Location = require('../models/Location');
const CycleCount = require('../models/CycleCount');
const { getFullItemBackupData } = require('../services/sqlService');

async function runItemBackupSync() {
  console.log('--- Starting Azure to Postgres Sync ---');

  // 1. Fetch data with 'store' filter and .lean() for performance
  // const [azureData, mongoLocations, mongoGrades] = await Promise.all([
  //   getFullItemBackupData(),
  //   Location.find({ type: 'store' }).lean(),
  //   CycleCount.find({}).lean()
  // ]);

  const azureData = await getFullItemBackupData();
  const mongoLocations = await Location.find({ type: 'store' }).lean();
  const mongoGrades = await CycleCount.find({}).lean();

  // --- DEEP DEBUG LOGS ---
  console.log(`Fetched ${azureData.length} records from Azure.`);
  console.log(`Fetched ${mongoLocations.length} Store Locations from Mongo.`);
  console.log(`Fetched ${mongoGrades.length} Grades from Mongo.`);
  if (mongoLocations.length === 0) {
    const allDocsCount = await Location.countDocuments({});
    const distinctTypes = await Location.distinct('type');

    console.error(`
    ❌ MAPPING FAILED: No Locations found with type: 'store'.
    - Total docs in Location collection (any type): ${allDocsCount}
    - Available 'type' values in DB: ${distinctTypes.join(', ')}
    - Current DB Name: ${mongoose.connection.name}
    - Collection Name Mongoose is using: ${Location.collection.name}
    `);
    return;
  }
  // --- END DEBUG ---
  // 2. Create Maps for O(1) lookup performance
  // Force the Map keys to be Strings
  const locationMap = new Map(
    mongoLocations.map(loc => [String(loc.csoCode).trim(), loc._id.toString()])
  ); console.log(`Constructed locationMap with ${locationMap.size} entries.`);
  // Grade map key: site_gtin (since GTINs might repeat across sites)
  const gradeMap = new Map(mongoGrades.map(g => [`${g.site}_${g.gtin}`, g.grade]));
  console.log(`Constructed gradeMap with ${gradeMap.size} entries.`);
  const sampleAzureKey = String(azureData[0].Station_SK);
  console.log(`Checking Map for Azure key: "${sampleAzureKey}" (Type: ${typeof sampleAzureKey})`);
  console.log(`Map contains this key? ${locationMap.has(sampleAzureKey)}`);
  // 3. Transform and Upsert
  const operations = azureData.map(item => {
    const azureSiteKey = item.Station_SK ? String(item.Station_SK).trim() : null;
    const mongoSiteId = locationMap.get(azureSiteKey);

    if (!mongoSiteId) return null;

    const gradeKey = `${mongoSiteId}_${item.GTIN}`;
    const itemGrade = gradeMap.get(gradeKey) || "B";

    // Safe parsing for Category ID (Handle Null/Undefined/Empty String)
    const parsedCategoryId = (item.categoryId && item.categoryId !== "")
      ? parseInt(item.categoryId, 10)
      : null;

    return prisma.itemBk.upsert({
      where: {
        site_upc: {
          site: mongoSiteId,
          upc: item.UPC.toString()
        }
      },
      update: {
        gtin: item.GTIN,
        upc_barcode: item.upc_barcode,
        description: item.Description,
        retail: item.Retail?.toString(),
        vendorId: item.vendorId?.toString(),
        vendorName: item.vendorName,
        categoryId: parsedCategoryId, // Now an Int or Null
        departmentId: item.departmentId?.toString(),
        department: item.Department,
        priceGroupId: item.priceGroupId?.toString(),
        priceGroup: item.priceGroup,
        promoGroupId: item.promoGroupId?.toString(),
        promoGroup: item.promoGroup,
        onHandQty: item.onHandQty || 0,
        last_inv_date: item.last_inv_date ? new Date(item.last_inv_date) : null,
        grade: itemGrade,
        syncDate: new Date()
      },
      create: {
        site: mongoSiteId,
        upc: item.UPC.toString(),
        gtin: item.GTIN,
        upc_barcode: item.upc_barcode,
        description: item.Description,
        retail: item.Retail?.toString(),
        vendorId: item.vendorId?.toString(),
        vendorName: item.vendorName,
        categoryId: parsedCategoryId, // Now an Int or Null
        departmentId: item.departmentId?.toString(),
        department: item.Department,
        priceGroupId: item.priceGroupId?.toString(),
        priceGroup: item.priceGroup,
        promoGroupId: item.promoGroupId?.toString(),
        promoGroup: item.promoGroup,
        onHandQty: item.onHandQty || 0,
        last_inv_date: item.last_inv_date ? new Date(item.last_inv_date) : null,
        grade: itemGrade,
        active: true
      }
    });
  }).filter(op => op !== null); // Remove skipped items

  // 4. Batch Execute
  console.log(`Processing ${operations.length} upserts...`);

  // We chunk these because Postgres might struggle with 10,000+ operations in one transaction
  const chunkSize = 500;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    await prisma.$transaction(chunk);
    console.log(`Synced ${i + chunk.length} / ${operations.length}`);
  }

  console.log('✅ Sync Completed Successfully');
}

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await runItemBackupSync();
  } catch (err) {
    hadError = true;
    console.error('❌ Sync Failed:', err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Mongo disconnected.');
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();