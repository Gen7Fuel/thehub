const cron = require("node-cron");
const { DateTime } = require("luxon");

const CycleCount = require("../models/CycleCount");
const Location = require("../models/Location");
const { getBulkOnHandQtyCSO } = require('../services/sqlService');

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
      const { stationName: siteName, timezone } = loc;
      if (!timezone) continue;

      const { start, end } = getYesterdayRange(timezone);

      // Fetch yesterday's cycle count items for this site
      const items = await CycleCount.find({
        site: siteName,
        updatedAt: { $gte: start, $lte: end },
      }).lean();

      if (!items.length) continue;

      // Prepare UPC list
      const upcs = items.map((i) => i.upc_barcode).filter(Boolean);
      if (!upcs.length) continue;

      // Fetch bulk on-hand quantities from SQL
      const csoData = await getBulkOnHandQtyCSO(siteName, upcs);

      // Update cycle count records in bulk
      const bulkOps = [];

      // For items WITH SQL data
      items
        .filter((i) => i.upc_barcode && csoData[i.upc_barcode] !== undefined)
        .forEach((i) => {
          bulkOps.push({
            updateOne: {
              filter: { _id: i._id },
              update: {
                $set: {
                  onHandCSO: csoData[i.upc_barcode],
                  comments: [] // always clear comments
                }
              },
            },
          });
        });

      // For items WITHOUT SQL data
      items
        .filter((i) => i.upc_barcode && csoData[i.upc_barcode] === undefined)
        .forEach((i) => {
          bulkOps.push({
            updateOne: {
              filter: { _id: i._id },
              update: {
                $set: {
                  comments: []  // clear comments even though onHandCSO isn't updated
                },
              },
            },
          });
        });

      if (bulkOps.length) {
        await CycleCount.bulkWrite(bulkOps, { timestamps: false });
        console.log(`Updated ${bulkOps.length} items for site ${siteName}`);
      }
    }

    console.log("Cycle count CSO cron finished:", new Date().toISOString());
  } catch (err) {
    console.error("Error in cycle count cron:", err);
  }
};

// Schedule cron at 6 AM ET → 10:00 UTC
cron.schedule("0 10 * * *", () => {
  updateCycleCountCSO();
});

// cron_jobs/cycleCountCron.js
module.exports = { updateCycleCountCSO };