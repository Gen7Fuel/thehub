const Location = require("../models/Location");
const ItemBk = require("../pg/models/itemBk");
const { getPg } = require("../config/pg");
const { format, parseISO, addDays, isAfter } = require("date-fns");
const connectDB = require("../config/db");
const mongoose = require("mongoose");

// To run this script manually for a specific date range (e.g., June 10 to June 14, 2026), use:
// node manual/createCycleCountDynamicSchedule.js 2026-06-10 2026-06-14
// Note: To target a single day, pass the same date twice: node manual/createCycleCountDynamicSchedule.js 2026-06-10 2026-06-10

// Helper function to dynamically build the array of string dates between From and To
function generateDateRange(fromStr, toStr) {
  const dates = [];
  let current = parseISO(fromStr);
  const end = parseISO(toStr);

  if (isNaN(current.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date format provided. Please use YYYY-MM-DD.");
  }

  if (isAfter(current, end)) {
    throw new Error("The 'from' date cannot be after the 'to' date.");
  }

  while (!isAfter(current, end)) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addDays(current, 1);
  }

  return dates;
}

async function runTemporaryInstanceCalculations(targetDates) {
  const db = getPg();
  console.log(`--- Starting TEMPORARY Cycle Count Generation for Range: ${targetDates[0]} to ${targetDates[targetDates.length - 1]} ---`);

  try {
    const stores = await Location.find({ type: "store" });

    for (const store of stores) {
      const siteId = store._id.toString();
      console.log(`\nProcessing Store: ${store.stationName} (${siteId})`);

      let pool = null;

      for (const dateStr of targetDates) {
        const targetDate = parseISO(dateStr);
        const dayName = format(targetDate, "EEEE");

        // --- CHECK EXISTING INSTANCE ---
        const existing = await db("cycle_count_instance")
          .where({ site_mongo_id: siteId, date: dateStr })
          .first();

        if (existing) {
          console.log(`   [SKIP] ${dateStr} already has a cycle count instance.`);
          continue;
        }

        // --- AUTO-SORT GENERATION ENGINE ---
        if (!pool) {
          const allRanked = await ItemBk.getRankedItemsForSite(siteId);
          pool = {
            A: allRanked.filter(i => i.grade === 'A'),
            B: allRanked.filter(i => i.grade === 'B'),
            C: allRanked.filter(i => i.grade === 'C')
          };
        }

        const rawSelection = [
          ...pool.A.splice(0, 10),
          ...pool.B.splice(0, 7),
          ...pool.C.splice(0, 3)
        ];

        if (rawSelection.length === 0) {
          console.log(`   [NOTICE] No items available in pool for ${dateStr}.`);
          continue;
        }

        const dailySelection = rawSelection.sort((a, b) => {
          if (a.category_id !== b.category_id) {
            return (a.category_id || 0) - (b.category_id || 0);
          }
          return a.grade.localeCompare(b.grade);
        });

        console.log(`   [AUTO] ${dateStr}: Selected top ${dailySelection.length} items.`);

        // --- TRANSACTIONAL INSERT ---
        try {
          await db.transaction(async (trx) => {
            const [insertedInstance] = await trx("cycle_count_instance")
              .insert({
                date: dateStr,
                day: dayName,
                is_scheduled: false,
                site_mongo_id: siteId
              })
              .returning("id");

            const instanceId = typeof insertedInstance === 'object' ? insertedInstance.id : insertedInstance;

            const itemRows = dailySelection.map(item => ({
              instance_id: instanceId,
              product_id: item.id,
              foh: null,
              boh: null,
              count_completed: false,
              priority: false
            }));

            await trx("cycle_count_items").insert(itemRows);
          });
          console.log(`   [SUCCESS] Saved cycle count instance for ${dateStr}`);
        } catch (trxErr) {
          console.error(`   [ERROR] Failed to save transaction for ${dateStr}:`, trxErr.message);
        }
      }
    }

    console.log("\n--- Temporary Cycle Count Generation Finished Cleanly ---");
  } catch (err) {
    console.error("Master Generation Pipeline Failure:", err);
  } finally {
    process.exit(0);
  }
}

async function run() {
  // Grab arguments: process.argv[2] is 'from', process.argv[3] is 'to'
  const fromDateArg = process.argv[2];
  const toDateArg = process.argv[3];

  if (!fromDateArg || !toDateArg) {
    console.error("🚨 Error: Missing arguments. Usage: node manual/createCycleCountDynamicSchedule.js <YYYY-MM-DD> <YYYY-MM-DD>");
    process.exit(1);
  }

  let targetDates = [];
  try {
    targetDates = generateDateRange(fromDateArg, toDateArg);
    console.log(`Generated schedule dates to run:`, targetDates);
  } catch (dateError) {
    console.error(`🚨 Configuration Error: ${dateError.message}`);
    process.exit(1);
  }

  try {
    await connectDB();
    await runTemporaryInstanceCalculations(targetDates);
  } catch (err) {
    console.error("Sync failed:", err);
    try {
      await mongoose.disconnect();
      console.log("Mongo disconnected.");
    } catch (e) { }
    process.exit(1);
  }
}

if (require.main === module) run();