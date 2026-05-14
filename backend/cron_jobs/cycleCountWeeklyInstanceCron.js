const connectDB = require("../config/db");
const mongoose = require("mongoose");
const Location = require("../models/Location");
const ItemBk = require("../pg/models/itemBk");
const { getPg } = require("../config/pg");
const { format, addDays, nextMonday } = require("date-fns");

async function generateWeeklyCycleCounts() {
  try {
    await connectDB();
    const db = getPg();
    console.log("--- Starting Weekly Cycle Count Generation ---");

    // 1. Get all Store locations
    const stores = await Location.find({ type: "store" });
    console.log(`Found ${stores.length} stores to process.`);

    // 2. Setup Date Range (Next Monday to Sunday)
    const startDate = nextMonday(new Date());

    for (const store of stores) {
      const siteId = store._id.toString();
      console.log(`\nProcessing Store: ${store.stationName} (${siteId})`);

      // 3. Get Pool for this site (Ranked by last_inv_date, grade, and qty)
      const allItems = await ItemBk.getRankedItemsForSite(siteId);
      const pool = {
        A: allItems.filter(i => i.grade === 'A'),
        B: allItems.filter(i => i.grade === 'B'),
        C: allItems.filter(i => i.grade === 'C')
      };

      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(startDate, i);
        const dateStr = format(targetDate, "yyyy-MM-dd");
        const dayName = format(targetDate, "EEEE");

        // 4. Duplicate Check
        const existing = await db("cycle_count_instance")
          .where({ site_mongo_id: siteId, date: dateStr })
          .first();

        if (existing) {
          console.log(`   [SKIP] ${dateStr} already exists.`);
          continue;
        }

        // 5. Check for Manual Schedule
        const schedule = await db("cycle_count_schedule as s")
          .join("cycle_count_groups as g", "s.group_id", "g.id")
          .where("s.site_mongo_id", siteId)
          .andWhere(function() {
            this.where("s.date", dateStr).orWhere("s.day", dayName);
          })
          .select("g.filter_column", "g.id as group_id")
          .first();

        let dailySelection = [];
        let isScheduled = false;

        if (schedule) {
          isScheduled = true;
          const groupValues = await db("cycle_count_group_values")
            .where("group_id", schedule.group_id)
            .pluck("value");

          // Filter from pool based on the specific group column
          dailySelection = allItems.filter(item => 
            groupValues.includes(String(item[schedule.filter_column]))
          );
          
          // Remove from local pools so they aren't used in auto-sort later this week
          const selectedIds = new Set(dailySelection.map(item => item.id));
          pool.A = pool.A.filter(item => !selectedIds.has(item.id));
          pool.B = pool.B.filter(item => !selectedIds.has(item.id));
          pool.C = pool.C.filter(item => !selectedIds.has(item.id));

          console.log(`   [SCHEDULED] ${dateStr}: Found ${dailySelection.length} items for group filter.`);
        } else {
          // 6. Auto-Sort Algorithm (10A, 7B, 3C)
          isScheduled = false;
          const rawSelection = [
            ...pool.A.splice(0, 10),
            ...pool.B.splice(0, 7),
            ...pool.C.splice(0, 3)
          ];

          // Re-sort the 20 items by Category for User Walking Efficiency
          dailySelection = rawSelection.sort((a, b) => {
            if (a.category_id !== b.category_id) {
              return (a.category_id || 0) - (b.category_id || 0);
            }
            return a.grade.localeCompare(b.grade);
          });
          console.log(`   [AUTO] ${dateStr}: Selected top 20 items.`);
        }

        // 7. Transactional Insert
        if (dailySelection.length > 0) {
          try {
            await db.transaction(async (trx) => {
              const [instance] = await trx("cycle_count_instance")
                .insert({
                  date: dateStr,
                  day: dayName,
                  is_scheduled: isScheduled,
                  site_mongo_id: siteId
                })
                .returning("id");

              const itemRows = dailySelection.map(item => ({
                instance_id: instance.id,
                product_id: item.id,
                foh: null,
                boh: null,
                count_completed: false,
                priority: false
              }));

              await trx("cycle_count_items").insert(itemRows);
            });
          } catch (trxErr) {
            console.error(`   [ERROR] Failed to save ${dateStr}:`, trxErr.message);
          }
        }
      }
    }

    console.log("\n--- Cycle Count Generation Finished ---");
  } catch (err) {
    console.error("Generation failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

generateWeeklyCycleCounts();