const cron = require("node-cron");
const { DateTime } = require("luxon");
const { getPg } = require("../config/pg");
const Location = require("../models/Location"); // Keeping Mongo Location collection as source of truth for timezones
const { getOnHandBulkCSOData } = require("../services/sqlService");

// Helper: Get yesterday's date string configured for the specific site's local time zone
const getYesterdayDateString = (timezone) => {
  return DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat("yyyy-MM-dd");
};

const updateCycleCountCSO = async () => {
  console.log("--- Relational Cycle Count CSO Snapshot Sync Started ---", new Date().toISOString());
  const db = getPg();

  try {
    const excludedSites = ["Sarnia", "Jocko Point"];

    // 1. Fetch active monitoring store list from Mongo to handle specific timezones
    const locations = await Location.find({
      stationName: { $nin: excludedSites },
      type: "store"
    }).lean();

    for (const loc of locations) {
      const { stationName: siteName, timezone, _id: siteMongoId } = loc;
      if (!timezone || !siteMongoId) continue;

      const mongoSiteIdStr = siteMongoId.toString();
      const yesterdayStr = getYesterdayDateString(timezone);

      console.log(`Processing [${siteName}] for Target Audit Date: ${yesterdayStr}`);

      // 2. Query Postgres for completed cycle counts submitted yesterday for this site
      const completedItems = await db("cycle_count_items as cci")
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

      if (!completedItems.length) {
        console.log(`-> No completed counts found for ${siteName} on ${yesterdayStr}. Skipping.`);
        continue;
      }

      // Filter and isolate unique valid GTINs to build batch request
      const gtinMap = new Map();
      completedItems.forEach(item => {
        if (item.gtin) gtinMap.set(item.gtin, item.productId);
      });

      const uniqueGtins = Array.from(gtinMap.keys());
      if (!uniqueGtins.length) continue;

      // 3. Hit Azure SQL to gather yesterday's closing snapshots
      console.log(`-> Querying Azure SQL for ${uniqueGtins.length} metrics at ${siteName}...`);
      const csoDataMap = await getOnHandBulkCSOData(siteName, uniqueGtins);

      let updateCount = 0;

      // 4. Update item_bk logs systematically
      // Using an isolated transaction loop block per site to prevent network lockouts
      await db.transaction(async (trx) => {
        for (const item of completedItems) {
          const sqlSnapshot = csoDataMap[item.gtin];
          if (!sqlSnapshot) continue;

          const updateFields = {};

          // Safely extract and check closing inventory levels
          if (sqlSnapshot.qty !== undefined) {
            updateFields.on_hand_qty = sqlSnapshot.qty;
          }

          // Update product base retail price if it has updated on the POS system
          if (
            sqlSnapshot.unitPrice != null &&
            sqlSnapshot.unitPrice > 0 &&
            Number(sqlSnapshot.unitPrice) !== Number(item.currentRetail)
          ) {
            updateFields.retail = sqlSnapshot.unitPrice;
          }

          // If changes need to be made, execute the write statement
          if (Object.keys(updateFields).length > 0) {
            updateFields.sync_date = trx.fn.now();
            updateFields.last_inv_date = yesterdayStr; // Snapshot date stamp reference marker

            await trx("item_bk")
              .where({ id: item.productId })
              .update(updateFields);

            updateCount++;
          }
        }
      });

      console.log(`Successfully completed snapshot synchronization. Updated ${updateCount} records for ${siteName}.`);
    }

    console.log("--- Relational Cycle Count CSO Snapshot Sync Completed Successfully ---");
  } catch (err) {
    console.error("Critical Failure in Cycle Count Snapshot Cron:", err);
  }
};

// Execute Cron job at exactly 6:00 AM local Server Time
cron.schedule("0 6 * * *", () => {
  console.log("Triggering scheduled morning updateCycleCountCSO invocation...");
  updateCycleCountCSO();
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { updateCycleCountCSO };