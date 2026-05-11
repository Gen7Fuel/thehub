const cron = require("node-cron");
const { DateTime } = require("luxon");

const CycleCount = require("../models/CycleCount");
const Location = require("../models/Location");
const { getBulkCSOData } = require('../services/sqlService');

// Helper: get yesterday range in a specific timezone
const getYesterdayRange = (timezone) => {
  const yesterday = DateTime.now().setZone(timezone).minus({ days: 1 });
  return {
    start: yesterday.startOf("day").toJSDate(),
    end: yesterday.endOf("day").toJSDate(),
  };
};

// Main update function
const updateCycleCountCSO = async () => {
  console.log("Cycle count CSO cron started:", new Date().toISOString());

  try {
    // Sites to exclude
    const excludedSites = ["Sarnia", "Jocko Point"];

    // Fetch all locations/sites except the excluded ones
    const locations = await Location.find({
      name: { $nin: excludedSites },
      type: "store"
    }).lean();

    for (const loc of locations) {
      const { name: siteName, timezone } = loc;
      if (!timezone) continue;

      const { start, end } = getYesterdayRange(timezone);

      // Fetch yesterday's cycle count items for this site
      const items = await CycleCount.find({
        site: siteName,
        updatedAt: { $gte: start, $lte: end },
      }).lean();

      if (!items.length) continue;

      // Prepare UPC list
      const gtins = items.map((i) => i.gtin).filter(Boolean);
      if (!gtins.length) continue;

      // 2. Fetch Qty and Retail from SQL (Single Table)
      const csoDataMap = await getBulkCSOData(siteName, gtins);

      const bulkOps = items.map((item) => {
        const sqlData = csoDataMap[item.gtin];

        // Base update: Always clear comments per your requirement
        const updateFields = { comments: [] };

        if (sqlData) {
          // Update On Hand Qty if it exists in SQL
          if (sqlData.qty !== undefined) {
            updateFields.onHandCSO = sqlData.qty;
          }

          // Update Unit Price only if:
          // - It's not null/undefined
          // - It's greater than 0
          // - It's different from the existing price in MongoDB
          if (
            sqlData.unitPrice != null &&
            sqlData.unitPrice > 0 &&
            sqlData.unitPrice !== item.unitPrice
          ) {
            updateFields.unitPrice = sqlData.unitPrice;
          }
        }

        return {
          updateOne: {
            filter: { _id: item._id },
            update: { $set: updateFields },
          },
        };
      });

      if (bulkOps.length) {
        // { timestamps: false } ensures 'updatedAt' isn't changed, 
        // preserving your sorting order on the frontend.
        await CycleCount.bulkWrite(bulkOps, { timestamps: false });
        console.log(`Updated ${bulkOps.length} items for site ${siteName}`);
      }
    }
    console.log("Cycle count CSO cron finished.");
  } catch (err) {
    console.error("Error in cycle count cron:", err);
  }
};

// Schedule cron at 6 AM local (America/Toronto)
// This will stay at 6 AM even after the clocks changes!
cron.schedule("0 6 * * *", () => {
  console.log("Running updateCycleCountCSO...");
  updateCycleCountCSO();
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

// cron_jobs/cycleCountCron.js
module.exports = { updateCycleCountCSO };