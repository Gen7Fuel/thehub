const ProductCategory = require('../models/ProductCategory');
const CycleCount = require('../models/CycleCount');
const sqlService = require('../services/sqlService');
const Location = require('../models/Location');

const BATCH_SIZE = 2000;

/**
 * Synchronize ProductCategory collection with SQL category list.
 * Then update CycleCount.categoryNumber using SQL GTIN->Category mapping.
 * Logs each scheduling and execution step (so you can call this from the manual runner).
 */
async function syncCategoryProductMapping() {
  try {
    console.log('Starting ProductCategory sync from SQL...');
    const result = await sqlService.getCategoryNumbersFromSQL();
    const rows = (result && result.recordset) ? result.recordset : [];

    const sqlMap = new Map();
    for (const r of rows) {
      const id = r['Category ID'];
      const name = r['Category Name'] != null ? String(r['Category Name']).trim() : '';
      if (id != null) sqlMap.set(String(id), name);
    }
    console.log(`Fetched ${sqlMap.size} categories from SQL.`);

    const existing = await ProductCategory.find().lean();
    const existingMap = new Map(existing.map(d => [String(d.Number), d]));

    const ops = [];
    const addedItems = [];
    const updatedItems = [];
    const deletedItems = [];

    // Schedule Inserts and Updates for ProductCategory
    for (const [numStr, name] of sqlMap.entries()) {
      const existingDoc = existingMap.get(numStr);
      if (!existingDoc) {
        const numberValue = isNaN(Number(numStr)) ? numStr : Number(numStr);
        console.log(`Scheduling ADD ProductCategory — Number: ${numberValue}, Name: "${name}"`);
        ops.push({
          insertOne: {
            document: {
              Name: name,
              Number: numberValue,
              CycleCountVariance: 1,
              OrderRecVariance: 1
            }
          }
        });
        addedItems.push({ Name: name, Number: numberValue });
      } else if ((existingDoc.Name || '') !== name) {
        console.log(`Scheduling UPDATE ProductCategory _id=${existingDoc._id} Number=${existingDoc.Number} — "${existingDoc.Name}" -> "${name}"`);
        ops.push({
          updateOne: {
            filter: { _id: existingDoc._id },
            update: { $set: { Name: name } }
          }
        });
        updatedItems.push({ _id: existingDoc._id, Number: existingDoc.Number, oldName: existingDoc.Name, newName: name });
      }
    }

    // Schedule Deletions
    for (const [numStr, doc] of existingMap.entries()) {
      if (!sqlMap.has(numStr)) {
        console.log(`Scheduling DELETE ProductCategory _id=${doc._id} Number=${doc.Number} Name="${doc.Name}"`);
        ops.push({ deleteOne: { filter: { _id: doc._id } } });
        deletedItems.push({ _id: doc._id, Number: doc.Number, Name: doc.Name });
      }
    }

    // Execute ProductCategory ops
    if (ops.length) {
      console.log(`Executing ProductCategory.bulkWrite with ${ops.length} operations...`);
      const res = await ProductCategory.bulkWrite(ops, { ordered: false });
      console.log('ProductCategory.bulkWrite result:', res);
      console.log(`ProductCategory changes applied — added: ${addedItems.length}, updated: ${updatedItems.length}, deleted: ${deletedItems.length}`);
    } else {
      console.log('No ProductCategory changes detected; skipping bulkWrite.');
    }

    if (addedItems.length) console.log('Added ProductCategories:', addedItems);
    if (updatedItems.length) console.log('Updated ProductCategories:', updatedItems);
    if (deletedItems.length) console.log('Deleted ProductCategories:', deletedItems);

    // ------------------ CycleCount updates using SQL GTIN -> Category ------------------
    console.log('Starting CycleCount categoryNumber update using SQL GTIN mapping...');

    const allGtins = await CycleCount.distinct('gtin', { gtin: { $ne: null } });
    const filteredGtins = (allGtins || []).map(g => String(g).trim()).filter(Boolean);
    console.log(`Found ${filteredGtins.length} unique GTINs in CycleCount.`);

    const notFoundGTINs = [];
    const updatedGTINs = [];
    let cyclecountUpdatedCount = 0;
    let batchIndex = 0;

    for (let i = 0; i < filteredGtins.length; i += BATCH_SIZE) {
      batchIndex += 1;
      const batch = filteredGtins.slice(i, i + BATCH_SIZE);
      console.log(`Processing GTIN batch ${batchIndex} (${batch.length} GTINs)...`);

      // Query SQL for this batch
      let categoryMap = {};
      try {
        categoryMap = await sqlService.getCategoriesFromSQL(batch); // { gtin: categoryId }
      } catch (err) {
        console.error(`Error fetching categories from SQL for batch ${batchIndex}:`, err);
        // mark all as not found in this batch
        notFoundGTINs.push(...batch);
        continue;
      }

      const returnedGtins = Object.keys(categoryMap || {});
      // Fetch existing docs for those returned GTINs so we can compare
      const existingDocs = await CycleCount.find({ gtin: { $in: returnedGtins } }, { gtin: 1, categoryNumber: 1 }).lean();
      const existingByGtin = new Map((existingDocs || []).map(d => [String(d.gtin), d]));

      const batchOps = [];

      for (const gtin of batch) {
        const sqlCat = categoryMap[gtin];
        if (sqlCat == null || sqlCat === '') {
          // SQL did not return a category for this GTIN
          console.log(`GTIN not found in SQL: ${gtin}`);
          notFoundGTINs.push(gtin);
          continue;
        }

        const newCatNum = Number(sqlCat);
        const doc = existingByGtin.get(String(gtin));
        const currentNum = doc && doc.categoryNumber != null ? Number(doc.categoryNumber) : null;

        if (currentNum !== newCatNum) {
          console.log(`Scheduling CycleCount update for GTIN ${gtin}: categoryNumber ${currentNum} -> ${newCatNum}`);
          batchOps.push({
            updateMany: {
              filter: { gtin },
              update: { $set: { categoryNumber: newCatNum } }
            }
          });
          updatedGTINs.push(gtin);
        } else {
          // no change
        }
      }

      if (batchOps.length) {
        console.log(`Executing CycleCount.bulkWrite for batch ${batchIndex} with ${batchOps.length} ops...`);
        try {
          const res = await CycleCount.bulkWrite(batchOps, { timestamps: false, ordered: false });
          const modified = res.modifiedCount != null ? res.modifiedCount : (res.nModified || 0);
          cyclecountUpdatedCount += modified;
          console.log(`CycleCount.bulkWrite batch ${batchIndex} applied, modified: ${modified}`);
        } catch (err) {
          console.error(`CycleCount.bulkWrite error for batch ${batchIndex}:`, err);
        }
      } else {
        console.log(`No CycleCount updates needed for batch ${batchIndex}.`);
      }
    }

    // Final summary logging for CycleCount
    console.log('CycleCount update complete:');
    console.log(`- Total GTINs checked: ${filteredGtins.length}`);
    console.log(`- Total GTINs updated: ${cyclecountUpdatedCount} (scheduled updates: ${updatedGTINs.length})`);
    console.log(`- GTINs not found in SQL: ${notFoundGTINs.length}`);
    if (updatedGTINs.length) console.log('Updated GTINs (sample/first 500):', updatedGTINs.slice(0, 500));
    if (notFoundGTINs.length) console.log('GTINs not found in SQL (sample/first 500):', notFoundGTINs.slice(0, 500));

    console.log('syncCategoryProductMapping finished.');

    // ------------------ Inactive check & mark CycleCount.active / inventoryExists ------------------
    console.log('Starting inactive-product check and active/inventoryExists updates...');
    // Get unique sites present in CycleCount
    const sites = await CycleCount.distinct('site');
    const inactiveMarked = [];
    const inventoryFlagged = [];

    for (const site of sites || []) {
      if (!site) continue;

      // find Location to get station code (csoCode)
      const loc = await Location.findOne({ stationName: site }).lean();
      if (!loc || !loc.csoCode) {
        console.log(`No Location.csoCode found for site '${site}', skipping inactive check for this site.`);
        continue;
      }
      const stationSk = String(loc.csoCode);
      console.log(`Checking inactive GTINs for site='${site}' (stationSk=${stationSk})`);

      // collect GTINs for this site
      const siteGtins = await CycleCount.distinct('gtin', { site, gtin: { $ne: null } });
      const filteredSiteGtins = (siteGtins || []).map(g => String(g).trim()).filter(Boolean);
      if (!filteredSiteGtins.length) {
        console.log(`No GTINs found for site='${site}'.`);
        continue;
      }

      // process in batches
      for (let i = 0; i < filteredSiteGtins.length; i += BATCH_SIZE) {
        const batch = filteredSiteGtins.slice(i, i + BATCH_SIZE);
        console.log(`Site='${site}': processing inactive-master batch ${i / BATCH_SIZE + 1} (${batch.length} GTINs)`);

        const inactiveMap = await sqlService.getInactiveMasterItems(batch); // { gtin: [upc,...] }
        const ops = [];

        for (const gtin of batch) {
          const upcs = inactiveMap[gtin] || [];
          if (!upcs.length) {
            // Not marked inactive in Master_Item — skip
            continue;
          }

          // Item is marked INACTIVE in Master_Item -> active should always be false
          // Determine inventoryExists by checking yesterday's On_hand across UPCs
          let hasInventory = false;
          for (const upc of upcs) {
            try {
              const onHand = await sqlService.getInventoryOnHandForUPCAndStation(upc, stationSk);
              if (onHand != null && Number(onHand) > 0) {
                hasInventory = true;
                break;
              }
            } catch (err) {
              console.error(`Error checking inventory for UPC '${upc}' at station ${stationSk}:`, err);
            }
          }

          // active: always false for items flagged inactive in Master_Item
          // inventoryExists: true iff yesterday's On_hand > 0
          console.log(`Scheduling active=false for GTIN='${gtin}' at site='${site}' (inventoryExists=${hasInventory})`);
          ops.push({
            updateMany: {
              filter: { site, gtin },
              update: { $set: { active: false, inventoryExists: Boolean(hasInventory) } }
            }
          });

          inactiveMarked.push({ site, gtin, inventoryExists: hasInventory });
          if (hasInventory) inventoryFlagged.push({ site, gtin });
        }

        if (ops.length) {
          try {
            const res = await CycleCount.bulkWrite(ops, { timestamps: false, ordered: false });
            const modified = res.modifiedCount != null ? res.modifiedCount : (res.nModified || 0);
            console.log(`Applied active/inventoryExists updates for site='${site}' batch, modified: ${modified}`);
          } catch (err) {
            console.error(`Error applying active/inventoryExists updates for site='${site}' batch:`, err);
          }
        } else {
          console.log(`No active/inventoryExists updates needed for site='${site}' batch.`);
        }
      } // end batch loop
    } // end site loop

    console.log(`Inactive-flagging complete. Marked ${inactiveMarked.length} GTIN/site pairs as inactive.`);
    if (inventoryFlagged.length) console.log(`Marked ${inventoryFlagged.length} GTIN/site pairs as having inventory (inventoryExists=true).`);
    console.log('syncCategoryProductMapping finished all tasks.');
  } catch (err) {
    console.error('Error syncing product categories and updating CycleCount:', err);
    throw err;
  }
}

module.exports = {
  syncCategoryProductMapping,
};