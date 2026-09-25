const cron = require("node-cron");
const { DateTime } = require("luxon");
const { getPg } = require("../config/pg");
const Location = require("../models/Location"); // Source of truth for timezones
const { getOnHandBulkCSOData } = require("../services/sqlService");

// Helper: Get date string formatted for site local timezone
const getLocalDateString = (timezone, daysOffset = 0) => {
  return DateTime.now().setZone(timezone).plus({ days: daysOffset }).toFormat("yyyy-MM-dd");
};

const updateCycleCountCSO = async () => {
  console.log("--- Relational Cycle Count CSO Snapshot Sync Started ---", new Date().toISOString());
  const db = getPg();

  try {
    const excludedSites = ["Sarnia", "Jocko Point"];

    // 1. Fetch active monitoring store list from Mongo
    const locations = await Location.find({
      site: { $nin: excludedSites },
      type: "store"
    }).lean();

    for (const loc of locations) {
      const { site: siteName, timezone, _id: siteMongoId, csoCode } = loc;
      if (!timezone || !siteMongoId) continue;

      const mongoSiteIdStr = siteMongoId.toString();
      const yesterdayStr = getLocalDateString(timezone, -1);
      const todayStr = getLocalDateString(timezone, 0);

      console.log(`Processing [${siteName}] | Yesterday (${yesterdayStr}) & Today (${todayStr})`);

      // 2a. Query Postgres for completed cycle count items from YESTERDAY
      const yesterdayCompletedItems = await db("cycle_count_items as cci")
        .join("cycle_count_instance as cci_inst", "cci.instance_id", "cci_inst.id")
        .join("item_bk as ib", "cci.product_id", "ib.id")
        .where({
          "cci_inst.site_mongo_id": mongoSiteIdStr,
          "cci_inst.date": yesterdayStr,
          "cci.count_completed": true
        })
        .select(
          "cci.id as itemId",
          "cci.product_id as productId",
          "ib.gtin",
          "ib.upc",
          "ib.retail as currentRetail"
        );

      // 2b. Query Postgres for scheduled cycle count items for TODAY
      const todayScheduledItems = await db("cycle_count_items as cci")
        .join("cycle_count_instance as cci_inst", "cci.instance_id", "cci_inst.id")
        .join("item_bk as ib", "cci.product_id", "ib.id")
        .where({
          "cci_inst.site_mongo_id": mongoSiteIdStr,
          "cci_inst.date": todayStr
        })
        .select(
          "cci.id as itemId",
          "cci.product_id as productId",
          "ib.gtin",
          "ib.upc",
          "ib.retail as currentRetail"
        );

      if (!yesterdayCompletedItems.length && !todayScheduledItems.length) {
        console.log(`-> No items found for ${siteName} on ${yesterdayStr} or ${todayStr}. Skipping.`);
        continue;
      }

      // Collect distinct GTINs across both datasets to query SQL in a single batch
      const allTargetGtins = [
        ...new Set([
          ...yesterdayCompletedItems.map(i => i.gtin),
          ...todayScheduledItems.map(i => i.gtin)
        ].filter(Boolean))
      ];

      if (!allTargetGtins.length) continue;

      console.log(`-> Querying Azure SQL for ${allTargetGtins.length} GTINs at ${siteName} as of ${yesterdayStr}...`);

      // Query Azure SQL using yesterdayStr to fetch the latest available inventory snapshot
      const csoDataMap = await getOnHandBulkCSOData(csoCode, allTargetGtins, yesterdayStr);

      let yesterdayUpdateCount = 0;
      let todayUpdateCount = 0;

      // 3. Execute DB mutations inside a single site transaction
      await db.transaction(async (trx) => {

        // A. PROCESS YESTERDAY'S COMPLETED ITEMS -> update on_hand_at_count for variance report
        for (const item of yesterdayCompletedItems) {
          const sqlSnapshot = csoDataMap[item.gtin];
          if (!sqlSnapshot) continue;

          const updateFields = {};

          // Safely extract and check closing inventory levels
          if (sqlSnapshot.qty !== undefined) {
            updateFields.on_hand_at_count = sqlSnapshot.qty;
          }

          if (
            sqlSnapshot.unitPrice != null &&
            sqlSnapshot.unitPrice > 0 &&
            Number(sqlSnapshot.unitPrice) !== Number(item.currentRetail)
          ) {
            updateFields.retail = sqlSnapshot.unitPrice;
          }

          if (Object.keys(updateFields).length > 0) {
            updateFields.sync_date = trx.fn.now();
            updateFields.last_inv_date = yesterdayStr;

            await trx("item_bk")
              .where({ id: item.productId })
              .update(updateFields);

            yesterdayUpdateCount++;
          }
        }

        // B. PROCESS TODAY'S SCHEDULED ITEMS -> update on_hand_qty for counter display
        for (const item of todayScheduledItems) {
          const sqlSnapshot = csoDataMap[item.gtin];
          if (!sqlSnapshot) continue;

          const updateFields = {};

          if (sqlSnapshot.qty !== undefined) {
            updateFields.on_hand_qty = sqlSnapshot.qty; // Latest available CSO updated here
          }

          if (
            sqlSnapshot.unitPrice != null &&
            sqlSnapshot.unitPrice > 0 &&
            Number(sqlSnapshot.unitPrice) !== Number(item.currentRetail)
          ) {
            updateFields.retail = sqlSnapshot.unitPrice;
          }

          if (Object.keys(updateFields).length > 0) {
            updateFields.sync_date = trx.fn.now();

            await trx("item_bk")
              .where({ id: item.productId })
              .update(updateFields);

            todayUpdateCount++;
          }
        }
      });

      console.log(`[${siteName}] Synchronization Summary -> Yesterday Snapshots Updated: ${yesterdayUpdateCount} | Today Live On-Hand Updated: ${todayUpdateCount}`);
    }

    console.log("--- Relational Cycle Count CSO Snapshot Sync Completed Successfully ---");
  } catch (err) {
    console.error("Critical Failure in Cycle Count Snapshot Cron:", err);
  }
};

// Execute Cron job at 07:00 AM Toronto time
cron.schedule("0 7 * * *", () => {
  console.log("Triggering scheduled morning updateCycleCountCSO invocation...");
  updateCycleCountCSO();
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { updateCycleCountCSO };