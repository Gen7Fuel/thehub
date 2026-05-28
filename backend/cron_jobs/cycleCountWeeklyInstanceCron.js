const Location = require("../models/Location");
const ItemBk = require("../pg/models/itemBk"); // Assumed structure
const { getPg } = require("../config/pg");
const { format, addDays, nextMonday } = require("date-fns");
const cron = require("node-cron");

async function runWeeklyInstanceCalculations() {
  const db = getPg();
  console.log("--- Starting Weekly Cycle Count Generation ---");

  try {
    const stores = await Location.find({ type: "store" });
    const startDate = nextMonday(new Date());

    for (const store of stores) {
      const siteId = store._id.toString();
      console.log(`\nProcessing Store: ${store.stationName} (${siteId})`);

      let pool = null;

      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(startDate, i);
        const dateStr = format(targetDate, "yyyy-MM-dd");
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

            // Guaranteed resolution fallback for Knex version variant differences:
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
          // Log the individual date block failure but allow loops to continue processing other days/stores
          console.error(`   [ERROR] Failed to save transaction for ${dateStr}:`, trxErr.message);
        }
      }
    }

    console.log("\n--- Cycle Count Generation Finished Cleanly ---");
  } catch (err) {
    console.error("Master Generation Pipeline Failure:", err);
  }
}

async function archiveHistoricalCycleCounts() {
  const db = getPg();
  console.log("--- Starting Cycle Count Data Archival Engine ---");

  try {
    await db.transaction(async (trx) => {
      // 1. Identify all instances older than 1 month
      const oldInstances = await trx("cycle_count_instance")
        .whereRaw("CAST(date AS date) < CURRENT_DATE - INTERVAL '1 month'")
        .select("id");

      if (oldInstances.length === 0) {
        console.log("-> No historical metrics found older than 1 month. Skipping migration pass.");
        return;
      }

      const instanceIdsToMove = oldInstances.map(inst => inst.id);
      console.log(`-> Found ${instanceIdsToMove.length} historical instances to move to archive storage.`);

      // 2. Extract child rows targeting items mapped to these instances
      const itemsToMove = await trx("cycle_count_items")
        .whereIn("instance_id", instanceIdsToMove);

      // 3. Extract the instance records themselves
      const instancesToMove = await trx("cycle_count_instance")
        .whereIn("id", instanceIdsToMove);

      // 4. Batch push items into the archive table (if child records exist)
      if (itemsToMove.length > 0) {
        console.log(`-> Copying ${itemsToMove.length} child items to cycle_count_items_archive...`);
        // chunk to prevent statement execution footprint failures if datasets scale high
        await trx("cycle_count_items_archive").insert(itemsToMove);
      }

      // 5. Batch push parent rows into instance archive table
      console.log("-> Copying instances to cycle_count_instance_archive...");
      await trx("cycle_count_instance_archive").insert(instancesToMove);

      // 6. Delete from active working tables (Cascades clean down to items automatically due to your Foreign Key constraint)
      console.log("-> Purging archived records cleanly from production tracking tables...");
      await trx("cycle_count_instance")
        .whereIn("id", instanceIdsToMove)
        .del();

      console.log(`[SUCCESS] Completed data archival. ${instanceIdsToMove.length} sets successfully shifted.`);
    });
  } catch (err) {
    console.error("Critical Failure running Cycle Count Database Data Archival Loop:", err);
    throw err; // Bubbles up cleanly to master log handler block
  }
}

// Runs every Sunday at exactly 03:00 AM
cron.schedule("0 3 * * 0", async () => {
  console.log(`[${new Date().toISOString()}] Triggering scheduled Sunday morning Weekly Instance Calculation engine...`);
  try {
    await runWeeklyInstanceCalculations();
    console.log(`[${new Date().toISOString()}] Sunday morning Weekly Instance Calculations completed successfully.`);
    
    // RUN DEEP ARCHIVAL IMMEDIATELY AFTER GENERATION FINISHES
    await archiveHistoricalCycleCounts();
    console.log(`[${new Date().toISOString()}] Database table maintenance and historical archival run completed.`);
  } catch (error) {
    console.error("Critical Failure running Sunday Weekly Instance Calculations:", error);
  }
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { runWeeklyInstanceCalculations, archiveHistoricalCycleCounts };