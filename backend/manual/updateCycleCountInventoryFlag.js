// const connectDB = require('../config/db');
// const mongoose = require('mongoose');
// // const { runAndEmailReport } = require('../cron_jobs/productCategoryMappingCron');
// const { getPool } = require('../services/sqlService');
// const CycleCount = require("../models/CycleCount");
// const ProductCategory = require("../models/ProductCategory");
// const Location = require("../models/Location");

// const DEFAULT_UPDATED_AT = new Date("2025-09-18");

// function printSyncLogs(logs) {
//   for (const [site, siteLogs] of Object.entries(logs)) {
//     console.log('\n===================================================');
//     console.log(`SITE: ${site}`);
//     console.log('===================================================');

//     // SCENARIO 1
//     if (siteLogs.matchedAndUpdated.length) {
//       console.log('\n[1] MATCHED & UPDATED');
//       console.table(
//         siteLogs.matchedAndUpdated.map(l => ({
//           GTIN: l.gtin,
//           UPC: l.upc_barcode,
//           NameChanged: l.before?.name ? 'YES' : 'NO',
//           CategoryChanged: l.before?.categoryNumber ? 'YES' : 'NO'
//         }))
//       );
//     }

//     // SCENARIO 2
//     if (siteLogs.markedNotInInventory.length) {
//       console.log('\n[2] MARKED inventoryExists = false');
//       console.table(
//         siteLogs.markedNotInInventory.map(l => ({
//           GTIN: l.gtin,
//           UPC: l.upc_barcode
//         }))
//       );
//     }

//     // SCENARIO 3
//     if (siteLogs.createdFromInventory.length) {
//       console.log('\n[3] CREATED FROM CURRENT INVENTORY');
//       console.table(
//         siteLogs.createdFromInventory.map(l => ({
//           GTIN: l.gtin,
//           UPC: l.upc_barcode,
//           Name: l.created.name,
//           CategoryNumber: l.created.categoryNumber
//         }))
//       );
//     }

//     // SKIPPED / WARNINGS
//     if (siteLogs.skipped?.length) {
//       console.log('\n[!] SKIPPED / WARNINGS');
//       console.table(
//         siteLogs.skipped.map(l => ({
//           Reason: l.reason || 'Unknown',
//           GTIN: l.inv?.GTIN,
//           UPC: l.inv?.['UPC-A (12 digits)']
//         }))
//       );
//     }

//     if (
//       !siteLogs.matchedAndUpdated.length &&
//       !siteLogs.markedNotInInventory.length &&
//       !siteLogs.createdFromInventory.length
//     ) {
//       console.log('\nNo changes for this site.');
//     }
//   }

//   console.log('\n===================================================');
//   console.log('SYNC COMPLETE');
//   console.log('===================================================');
// }

// async function getCurrentSiteInventory(site) {
//   try {
//     // await sql.connect(sqlConfig);
//     const pool = await getPool();
//     let query = `
//       SELECT *
//       FROM [CSO].[Current_Inventory]
//       WHERE [Station] = '${site}'
//     `;

//     const result = await pool.request().query(query);
//     // await sql.close();
//     return result.recordset;
//   } catch (err) {
//     console.error('SQL error:', err);
//     return [];
//   }
// }

// async function syncCycleCountWithCurrentInventory() {
//   const logs = {};

//   const locations = await Location.find({ type: "store" }).lean();

//   // Preload product categories
//   const categories = await ProductCategory.find().lean();
//   const categoryCache = new Map();
//   for (const c of categories) {
//     categoryCache.set(c.Name.toLowerCase(), c.Number);
//   }

//   for (const loc of locations) {
//     const site = loc.stationName;

//     logs[site] = {
//       matchedAndUpdated: [],
//       markedNotInInventory: [],
//       createdFromInventory: [],
//       skipped: []
//     };

//     // Truth source
//     const inventory = await getCurrentSiteInventory(site);
//     const cycleItems = await CycleCount.find({ site }).lean();

//     /** ---------- BUILD MAPS ---------- */

//     const inventoryByGTIN = new Map();
//     for (const inv of inventory) {
//       if (!inv.GTIN) {
//         logs[site].skipped.push({
//           reason: "Missing GTIN in inventory",
//           inv
//         });
//         continue;
//       }
//       inventoryByGTIN.set(inv.GTIN, inv);
//     }

//     const cycleByGTIN = new Map();
//     for (const cc of cycleItems) {
//       if (!cc.gtin) continue;
//       cycleByGTIN.set(cc.gtin, cc);
//     }

//     /** ---------- BULK OPS ---------- */

//     const bulkOps = [];

//     /** ---------- SCENARIO 1 & 2 ---------- */

//     for (const cc of cycleItems) {
//       if (!cc.gtin) continue;

//       const inv = inventoryByGTIN.get(cc.gtin);

//       if (inv) {
//         // 🟢 Exists in both
//         const updates = {};
//         const before = {};

//         // Name
//         if (
//           cc.name?.trim().toLowerCase() !==
//           inv.Item_Name?.trim().toLowerCase()
//         ) {
//           before.name = cc.name;
//           updates.name = inv.Item_Name;
//         }

//         // Category
//         const invCatName = inv["Category Name"]?.toLowerCase();
//         const catNumber = categoryCache.get(invCatName);

//         if (catNumber != null && catNumber !== cc.categoryNumber) {
//           before.categoryNumber = cc.categoryNumber;
//           updates.categoryNumber = catNumber;
//         }

//         // inventoryExists must be true
//         if (cc.inventoryExists !== true) {
//           before.inventoryExists = cc.inventoryExists;
//           updates.inventoryExists = true;
//         }

//         if (Object.keys(updates).length) {
//           bulkOps.push({
//             updateOne: {
//               filter: { _id: cc._id },
//               update: { $set: updates }
//             }
//           });

//           logs[site].matchedAndUpdated.push({
//             gtin: cc.gtin,
//             before,
//             after: updates
//           });
//         }
//       } else {
//         // 🔴 Exists only in CycleCount
//         if (cc.inventoryExists !== false) {
//           bulkOps.push({
//             updateOne: {
//               filter: { _id: cc._id },
//               update: { $set: { inventoryExists: false } }
//             }
//           });

//           logs[site].markedNotInInventory.push({
//             gtin: cc.gtin
//           });
//         }
//       }
//     }

//     /** ---------- SCENARIO 3 ---------- */

//     for (const [gtin, inv] of inventoryByGTIN.entries()) {
//       if (cycleByGTIN.has(gtin)) continue;

//       const catNumber =
//         categoryCache.get(inv["Category Name"]?.toLowerCase()) ?? null;

//       const doc = {
//         site,
//         gtin,
//         upc: inv.UPC,
//         upc_barcode: inv["UPC-A (12 digits)"],
//         name: inv.Item_Name,
//         categoryNumber: catNumber,
//         inventoryExists: true,
//         grade: "B",
//         foh: 0,
//         boh: 0,
//         active: true,
//         updatedAt: DEFAULT_UPDATED_AT
//       };

//       bulkOps.push({
//         insertOne: {
//           document: doc
//         }
//       });

//       logs[site].createdFromInventory.push({
//         gtin,
//         created: doc
//       });
//     }

//     /** ---------- EXECUTE BULK ---------- */

//     if (bulkOps.length) {
//       await CycleCount.bulkWrite(bulkOps, { ordered: false });
//     }
//   }

//   return logs;
// }



// async function run() {
//   let hadError = false;

//   try {
//     await connectDB();
//     console.log('Starting CycleCount ⇄ Current Inventory sync...\n');

//     const logs = await syncCycleCountWithCurrentInventory();

//     printSyncLogs(logs);

//   } catch (err) {
//     hadError = true;
//     console.error('Sync failed:', err);
//   } finally {
//     try { await mongoose.disconnect(); } catch (e) { }
//     process.exit(hadError ? 1 : 0);
//   }
// }

// if (require.main === module) run();

// module.exports = { run };
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { getPool } = require('../services/sqlService');

const CycleCount = require("../models/CycleCount");
const ProductCategory = require("../models/ProductCategory");
const Location = require("../models/Location");

const DEFAULT_UPDATED_AT = new Date("2025-09-18");

/* ======================= SQL ======================= */

async function getCurrentSiteInventory(site) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT *
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}'
    `);
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

/* ======================= SYNC ======================= */

async function syncCycleCountWithCurrentInventory() {
  const logs = {};

  const locations = await Location.find({ type: "store" }).lean();

  // preload categories
  const categories = await ProductCategory.find().lean();
  const categoryCache = new Map(
    categories.map(c => [c.Name.toLowerCase(), c.Number])
  );

  for (const loc of locations) {
    const site = loc.stationName;

    logs[site] = {
      matchedAndUpdated: [],
      markedNotInInventory: [],
      createdFromInventory: { count: 0, sample: null },
      skipped: []
    };

    const inventory = await getCurrentSiteInventory(site);
    const cycleItems = await CycleCount.find({ site }).lean();

    const inventoryByGTIN = new Map();
    for (const inv of inventory) {
      if (!inv.GTIN) {
        logs[site].skipped.push({ reason: "Missing GTIN", inv });
        continue;
      }
      inventoryByGTIN.set(inv.GTIN, inv);
    }

    const cycleByGTIN = new Map();
    for (const cc of cycleItems) {
      if (cc.gtin) cycleByGTIN.set(cc.gtin, cc);
    }

    const bulkOps = [];

    /** ---------- SCENARIO 1 & 2 ---------- */

    for (const cc of cycleItems) {
      if (!cc.gtin) continue;

      const inv = inventoryByGTIN.get(cc.gtin);

      if (inv) {
        const updates = {};
        const before = {};

        if (
          cc.name?.trim().toLowerCase() !==
          inv.Item_Name?.trim().toLowerCase()
        ) {
          before.name = cc.name;
          updates.name = inv.Item_Name;
        }

        const catNumber = categoryCache.get(
          inv["Category Name"]?.toLowerCase()
        );

        if (catNumber != null && catNumber !== cc.categoryNumber) {
          before.categoryNumber = cc.categoryNumber;
          updates.categoryNumber = catNumber;
        }

        if (cc.inventoryExists !== true) {
          before.inventoryExists = cc.inventoryExists;
          updates.inventoryExists = true;
        }

        if (Object.keys(updates).length) {
          bulkOps.push({
            updateOne: {
              filter: { _id: cc._id },
              update: { $set: updates }
            }
          });

          logs[site].matchedAndUpdated.push({
            gtin: cc.gtin,
            before,
            after: updates
          });
        }
      } else {
        if (cc.inventoryExists !== false) {
          bulkOps.push({
            updateOne: {
              filter: { _id: cc._id },
              update: { 
                $set: { inventoryExists: false },
                // Clear the display dates so it disappears from today's frontend list
                $unset: { displayDate: "", flaggedDisplayDate: "" }
              }
            }
          });

          logs[site].markedNotInInventory.push({ gtin: cc.gtin });
        }
      }
    }

    /** ---------- SCENARIO 3 ---------- */

    for (const [gtin, inv] of inventoryByGTIN.entries()) {
      if (cycleByGTIN.has(gtin)) continue;

      const doc = {
        site,
        gtin,
        upc: inv.UPC,
        upc_barcode: inv["UPC-A (12 digits)"],
        name: inv.Item_Name,
        categoryNumber:
          categoryCache.get(inv["Category Name"]?.toLowerCase()) ?? null,
        inventoryExists: true,
        grade: "B",
        foh: 0,
        boh: 0,
        active: true,
        updatedAt: DEFAULT_UPDATED_AT
      };

      bulkOps.push({ insertOne: { document: doc } });

      logs[site].createdFromInventory.count += 1;

      if (!logs[site].createdFromInventory.sample) {
        logs[site].createdFromInventory.sample = {
          gtin,
          name: doc.name,
          categoryNumber: doc.categoryNumber
        };
      }
    }

    if (bulkOps.length) {
      await CycleCount.bulkWrite(bulkOps, { ordered: false });
    }
  }

  return logs;
}

async function runDeletions() {
  const categories = [134, 121, 800, 998, 999, 1000, 5001, 5002, 5003, 10000];

  // 1️⃣ Delete all documents from the two sites
  await CycleCount.deleteMany({
    site: { $in: ["Jocko Point", "Sarnia"] }
  });

  // 2️⃣ Delete documents from other sites only if categoryNumber matches
  await CycleCount.deleteMany({
    categoryNumber: { $in: categories }
  });

  console.log("Deletions complete");
}

/* ======================= DOCUMENT REPORT ======================= */

// function writeSyncReport(logs) {
//   let md = `# CycleCount ⇄ Current Inventory Sync Report\n\n`;
//   md += `Generated: ${new Date().toISOString()}\n\n---\n\n`;

//   for (const [site, l] of Object.entries(logs)) {
//     md += `## Site: ${site}\n\n`;

//     md += `### 1️⃣ Matched & Updated\n\n`;
//     if (l.matchedAndUpdated.length) {
//       md += `| GTIN | Changes |\n|------|---------|\n`;
//       for (const r of l.matchedAndUpdated) {
//         md += `| ${r.gtin} | ${Object.keys(r.after).join(", ")} |\n`;
//       }
//     } else {
//       md += `_No matched updates._\n`;
//     }

//     md += `\n### 2️⃣ Marked inventoryExists = false\n\n`;
//     if (l.markedNotInInventory.length) {
//       md += `| GTIN |\n|------|\n`;
//       for (const r of l.markedNotInInventory) {
//         md += `| ${r.gtin} |\n`;
//       }
//     } else {
//       md += `_No items marked inactive._\n`;
//     }

//     md += `\n### 3️⃣ Created from Current Inventory\n\n`;
//     if (l.createdFromInventory.count > 0) {
//       md += `**Total created:** ${l.createdFromInventory.count}\n\n`;
//       if (l.createdFromInventory.sample) {
//         md += `**Sample:**\n`;
//         md += `- GTIN: ${l.createdFromInventory.sample.gtin}\n`;
//         md += `- Name: ${l.createdFromInventory.sample.name}\n`;
//         md += `- Category Number: ${l.createdFromInventory.sample.categoryNumber}\n`;
//       }
//     } else {
//       md += `_No new items created._\n`;
//     }

//     md += `\n---\n\n`;
//   }

//   fs.writeFileSync("cyclecount-sync-report.md", md, "utf8");
//   console.log("📄 Report written: cyclecount-sync-report.md");
// }

/* ======================= RUNNER ======================= */

async function run() {
  let hadError = false;

  try {
    await connectDB();
    console.log('Starting CycleCount ⇄ Current Inventory sync...\n');

    const logs = await syncCycleCountWithCurrentInventory();
    // writeSyncReport(logs);
    console.log('Sync completed successfully.');
    console.log('Starting deletions...\n');
    await runDeletions();
    console.log('Deletions completed successfully.');

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
