const cron = require("node-cron");
const { emailQueue } = require("../queues/emailQueue");
const ProductCategory = require('../models/ProductCategory');
const CycleCount = require('../models/CycleCount');
const sqlService = require('../services/sqlService');
const Location = require('../models/Location');
const OrderRec = require('../models/OrderRec');

const BATCH_SIZE = 2000;

/**
 * Synchronize ProductCategory collection with SQL category list.
 * Then update CycleCount.categoryNumber using SQL GTIN->Category mapping.
 * Logs each scheduling and execution step (so you can call this from the manual runner).
 *
 * Returns a report object describing changes and any errors encountered.
 */
async function syncCategoryProductMapping() {
  const report = {
    timestamp: new Date().toISOString(),
    productCategory: { added: [], updated: [], deleted: [] },
    cycleCount: { updatedGTINs: [], notFoundGTINs: [], updatedCount: 0 },
    orderRec: { movedItems: [], skippedItems: [], ordersUpdated: 0 },
    inactiveFlags: { markedInactive: [], hadInventory: [] },
    errors: []
  };

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
      try {
        const res = await ProductCategory.bulkWrite(ops, { ordered: false });
        console.log('ProductCategory.bulkWrite result:', res);
      } catch (err) {
        console.error('ProductCategory.bulkWrite error', err);
        report.errors.push({ stage: 'ProductCategory.bulkWrite', message: err.message });
      }
    } else {
      console.log('No ProductCategory changes detected; skipping bulkWrite.');
    }

    if (addedItems.length) console.log('Added ProductCategories:', addedItems);
    if (updatedItems.length) console.log('Updated ProductCategories:', updatedItems);
    if (deletedItems.length) console.log('Deleted ProductCategories:', deletedItems);

    report.productCategory.added = addedItems;
    report.productCategory.updated = updatedItems;
    report.productCategory.deleted = deletedItems;

    // ------------------ CycleCount updates using SQL GTIN -> Category ------------------
    console.log('Starting CycleCount categoryNumber update using SQL GTIN mapping...');

    const allGtins = await CycleCount.distinct('gtin', { gtin: { $ne: null } });
    const filteredGtins = (allGtins || []).map(g => String(g).trim()).filter(Boolean);
    console.log(`Found ${filteredGtins.length} unique GTINs in CycleCount.`);

    const notFoundGTINs = [];
    const updatedGTINs = [];
    const updatedMap = {};
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
        report.errors.push({ stage: 'getCategoriesFromSQL', batch: batchIndex, message: err.message });
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
          updatedMap[String(gtin)] = newCatNum;
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
          report.errors.push({ stage: 'CycleCount.bulkWrite', batch: batchIndex, message: err.message });
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

    report.cycleCount.updatedGTINs = updatedGTINs;
    report.cycleCount.notFoundGTINs = notFoundGTINs;
    report.cycleCount.updatedCount = cyclecountUpdatedCount;

    // OrderRec updates for changed GTIN categories
    if (updatedGTINs.length) {
      console.log('Updating OrderRec documents for changed GTIN categories...', updatedGTINs.length);

      // Find order recs that reference any of the changed GTINs
      const orders = await OrderRec.find({ 'categories.items.gtin': { $in: updatedGTINs } });
      console.log(`Found ${orders.length} OrderRec documents to inspect.`);

      for (const order of orders) {
        let changedOrder = false;

        // Build quick lookup of categories by number (string keys)
        const catByNumber = new Map((order.categories || []).map(c => [String(c.number), c]));

        // Iterate categories and their items (iterate backwards when removing)
        for (const srcCat of [...order.categories]) {
          for (let i = (srcCat.items || []).length - 1; i >= 0; i--) {
            const item = srcCat.items[i];
            const gtin = String(item.gtin || '').trim();
            const newCatNum = updatedMap[gtin];
            if (!newCatNum) continue; // GTIN not part of changed set

            // If item already in correct category, skip
            if (String(srcCat.number) === String(newCatNum)) continue;

            // Try to find existing target category in this order
            let targetCat = catByNumber.get(String(newCatNum));

            if (targetCat) {
              // Move item into existing category
              targetCat.items.push(item);
              srcCat.items.splice(i, 1);
              changedOrder = true;
              report.orderRec.movedItems.push({ orderId: order._id, gtin, from: srcCat.number, to: newCatNum, createdNewCategory: false });
              console.log(`Order ${order._id}: moved item GTIN=${gtin} from category ${srcCat.number} -> existing category ${newCatNum}`);
            } else {
              // Check master ProductCategory collection for existence of the new category number
              try {
                const pc = await ProductCategory.findOne({ Number: newCatNum }).lean();
                if (pc) {
                  // Deep-clone the item so we don't accidentally keep references or mutate original fields
                  const itemCopy = JSON.parse(JSON.stringify(item));

                  // Create the new category copying the `completed` flag from the source category
                  const newCategory = {
                    number: newCatNum,
                    completed: Boolean(srcCat.completed),
                    items: [itemCopy]
                  };

                  order.categories.push(newCategory);
                  catByNumber.set(String(newCatNum), newCategory);

                  // Remove the original item from the source category
                  srcCat.items.splice(i, 1);

                  changedOrder = true;
                  report.orderRec.movedItems.push({ orderId: order._id, gtin, from: srcCat.number, to: newCatNum, createdNewCategory: true });
                  console.log(`Order ${order._id}: moved item GTIN=${gtin} from category ${srcCat.number} -> created new category ${newCatNum} in order (copied completed=${newCategory.completed})`);
                } else {
                  // Master category not found — skip update for this item
                  report.orderRec.skippedItems.push({ orderId: order._id, gtin, missingProductCategory: newCatNum });
                  console.log(`Order ${order._id}: skipping GTIN=${gtin} because ProductCategory ${newCatNum} not found`);
                }
              } catch (err) {
                console.error(`Error checking ProductCategory for ${newCatNum}:`, err);
                report.errors.push({ stage: 'ProductCategory.findOne', message: err.message, newCatNum });
              }
            }
          }
        }

        // Remove empty categories (optional - keeps orders cleaner)
        order.categories = (order.categories || []).filter(c => Array.isArray(c.items) && c.items.length > 0);

        if (changedOrder) {
          try {
            await order.save();
            report.orderRec.ordersUpdated += 1;
            console.log(`Saved updated OrderRec ${order._id}`);
          } catch (err) {
            console.error(`Failed to save OrderRec ${order._id}:`, err);
            report.errors.push({ stage: 'OrderRec.save', orderId: order._id, message: err.message });
          }
        }
      } // end orders loop

      console.log('OrderRec category updates complete.');
    }

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
              report.errors.push({ stage: 'getInventoryOnHandForUPCAndStation', upc, stationSk, message: err.message });
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
            report.errors.push({ stage: 'CycleCount.bulkWrite(inactive)', site, message: err.message });
          }
        } else {
          console.log(`No active/inventoryExists updates needed for site='${site}' batch.`);
        }
      } // end batch loop

      // ------------------ Active items inventoryExists check (bulk SQL version) ------------------
      console.log(`Checking inventoryExists for ACTIVE items at site='${site}'`);

      const activeItems = await CycleCount.find(
        {
          site,
          active: true,
          upc: { $ne: null },
        },
        { gtin: 1, upc: 1 }
      ).lean();

      if (!activeItems.length) {
        console.log(`No active items with UPC found for site='${site}'`);
      } else {
        const ACTIVE_BATCH_SIZE = 1000; // can increase because bulk SQL handles it

        for (let i = 0; i < activeItems.length; i += ACTIVE_BATCH_SIZE) {
          const batch = activeItems.slice(i, i + ACTIVE_BATCH_SIZE);
          console.log(
            `Site='${site}': processing ACTIVE inventory batch ${i / ACTIVE_BATCH_SIZE + 1} (${batch.length} items)`
          );

          // Extract UPCs for the batch
          const upcs = batch.map((item) => String(item.upc).trim()).filter(Boolean);

          // Bulk SQL call to get On_hand values for all UPCs
          let inventoryMap = {};
          try {
            inventoryMap = await sqlService.getInventoryOnHandForActiveUPCsAndStation(
              upcs,
              stationSk
            );
          } catch (err) {
            console.error(
              `Error fetching bulk inventory for ACTIVE batch at site='${site}':`,
              err
            );
            report.errors.push({
              stage: 'getInventoryOnHandForActiveUPCsAndStation',
              site,
              message: err.message,
            });
          }

          // Prepare bulkWrite operations for items missing inventory
          const ops = batch
            .filter((item) => {
              const onHand = inventoryMap[item.upc];
              return onHand == null || Number(onHand) <= 0;
            })
            .map((item) => ({
              updateMany: {
                filter: { site, gtin: item.gtin },
                update: { $set: { inventoryExists: false } },
              },
            }));

          // Execute bulkWrite if needed
          if (ops.length) {
            try {
              const res = await CycleCount.bulkWrite(ops, {
                timestamps: false,
                ordered: false,
              });
              const modified =
                res.modifiedCount != null ? res.modifiedCount : res.nModified || 0;
              console.log(
                `Updated inventoryExists=false for ${modified} ACTIVE items (batch ${i / ACTIVE_BATCH_SIZE + 1})`
              );
            } catch (err) {
              console.error(
                `Error updating inventoryExists for ACTIVE items (batch ${i / ACTIVE_BATCH_SIZE + 1}):`,
                err
              );
              report.errors.push({
                stage: 'CycleCount.bulkWrite(activeInventoryCheck)',
                site,
                message: err.message,
              });
            }
          } else {
            console.log(
              `No ACTIVE inventoryExists updates needed for batch ${i / ACTIVE_BATCH_SIZE + 1}`
            );
          }
        }
      }
    } // end site loop

    report.inactiveFlags.markedInactive = inactiveMarked;
    report.inactiveFlags.hadInventory = inventoryFlagged;

    console.log(`Inactive-flagging complete. Marked ${inactiveMarked.length} GTIN/site pairs as inactive.`);
    if (inventoryFlagged.length) console.log(`Marked ${inventoryFlagged.length} GTIN/site pairs as having inventory (inventoryExists=true).`);
    console.log('syncCategoryProductMapping finished all tasks.');
  } catch (err) {
    console.error('Error syncing product categories and updating CycleCount:', err);
    report.errors.push({ stage: 'syncCategoryProductMapping', message: err.message, stack: err.stack });
  }

  return report;
}

/**
 * Run sync and send a summary email report via the emailQueue.
 */
async function runAndEmailReport() {
  const start = new Date();
  let report;
  try {
    report = await syncCategoryProductMapping();
  } catch (err) {
    report = {
      timestamp: new Date().toISOString(),
      errors: [{ stage: 'runAndEmailReport', message: err.message, stack: err.stack }]
    };
  }

  // Build subject and text report
  const subject = `Category Sync Report — added:${report.productCategory?.added?.length ?? 0} updated:${report.productCategory?.updated?.length ?? 0} deleted:${report.productCategory?.deleted?.length ?? 0} ccgtins:${report.cycleCount?.updatedGTINs?.length ?? 0}`;
  const lines = [];

  lines.push(`Report generated: ${report.timestamp}`);
  lines.push('');
  lines.push('ProductCategory:');
  lines.push(`  Added: ${report.productCategory?.added?.length ?? 0}`);
  lines.push(`  Updated: ${report.productCategory?.updated?.length ?? 0}`);
  lines.push(`  Deleted: ${report.productCategory?.deleted?.length ?? 0}`);
  lines.push('');
  lines.push('CycleCount:');
  lines.push(`  GTINs updated: ${report.cycleCount?.updatedGTINs?.length ?? 0}`);
  lines.push(`  GTINs not found: ${report.cycleCount?.notFoundGTINs?.length ?? 0}`);
  lines.push('');
  lines.push('OrderRec:');
  lines.push(`  Orders updated: ${report.orderRec?.ordersUpdated ?? 0}`);
  lines.push(`  Items moved: ${report.orderRec?.movedItems?.length ?? 0}`);
  lines.push(`  Items skipped (missing master category): ${report.orderRec?.skippedItems?.length ?? 0}`);
  lines.push('');
  lines.push('Inactive flagging:');
  lines.push(`  Marked inactive: ${report.inactiveFlags?.markedInactive?.length ?? 0}`);
  lines.push(`  Had inventory (inventoryExists=true): ${report.inactiveFlags?.hadInventory?.length ?? 0}`);
  lines.push('');
  if (report.errors && report.errors.length) {
    lines.push('Errors:');
    for (const e of report.errors) {
      lines.push(`  - [${e.stage || 'unknown'}] ${e.message || JSON.stringify(e)}`);
    }
  } else {
    lines.push('No errors recorded.');
  }

  const text = lines.join('\n');

  // Enqueue email job
  // if HOST=VPS, only then send email
  if (process.env.HOST === "VPS") {
    try {
      await emailQueue.add("sendCategoryProductMappingReport", {
        to: "daksh@gen7fuel.com",
        subject,
        text,
        html: `<pre>${text.replace(/</g, "&lt;")}</pre>`
      });
      console.log('Category sync report queued to emailQueue.');
    } catch (err) {
      console.error('Failed to enqueue category sync report email:', err);
    }
  } else {
    console.log("Skipping email - not running on VPS host.");
  }

  const end = new Date();
  console.log(`Category sync run completed in ${(end - start) / 1000}s`);
  return report;
}

// Schedule cron: Sunday 6:00 AM America/New_York (handles EST/EDT)
function scheduleWeeklyCron() {
  // cron pattern: minute hour day month weekday  -> Sunday is 0
  cron.schedule("0 6 * * 0", () => {
    console.log('Scheduled categoryProductMapping job triggered by cron.');
    runAndEmailReport().catch(err => console.error('Scheduled run failed:', err));
  }, { timezone: "America/New_York" });

  console.log('CategoryProductMapping cron scheduled: Sundays at 06:00 America/New_York');
}

// Auto-schedule when this module is loaded
scheduleWeeklyCron();

module.exports = {
  syncCategoryProductMapping,
  runAndEmailReport,
  scheduleWeeklyCron
};