const connectDB = require("../config/db");
const mongoose = require("mongoose");
const Location = require("../models/Location");
const ItemBk = require("../pg/models/itemBk");
const { getPg } = require("../config/pg");
const { format, addDays, nextMonday } = require("date-fns");

// async function generateWeeklyCycleCounts() {
//   try {
//     await connectDB();
//     const db = getPg();
//     console.log("--- Starting Weekly Cycle Count Generation ---");

//     // 1. Get all Store locations
//     const stores = await Location.find({ type: "store" });
//     console.log(`Found ${stores.length} stores to process.`);

//     // 2. Setup Date Range (Next Monday to Sunday)
//     const startDate = nextMonday(new Date());

//     for (const store of stores) {
//       const siteId = store._id.toString();
//       console.log(`\nProcessing Store: ${store.stationName} (${siteId})`);

//       // 3. Get Pool for this site (Ranked by last_inv_date, grade, and qty)
//       const allItems = await ItemBk.getRankedItemsForSite(siteId);
//       const pool = {
//         A: allItems.filter(i => i.grade === 'A'),
//         B: allItems.filter(i => i.grade === 'B'),
//         C: allItems.filter(i => i.grade === 'C')
//       };

//       for (let i = 0; i < 7; i++) {
//         const targetDate = addDays(startDate, i);
//         const dateStr = format(targetDate, "yyyy-MM-dd");
//         const dayName = format(targetDate, "EEEE");

//         // 4. Duplicate Check
//         const existing = await db("cycle_count_instance")
//           .where({ site_mongo_id: siteId, date: dateStr })
//           .first();

//         if (existing) {
//           console.log(`   [SKIP] ${dateStr} already exists.`);
//           continue;
//         }

//         // 5. Check for Manual Schedule
//         const schedule = await db("cycle_count_schedule as s")
//           .join("cycle_count_groups as g", "s.group_id", "g.id")
//           .where("s.site_mongo_id", siteId)
//           .andWhere(function () {
//             this.where("s.date", dateStr).orWhere("s.day", dayName);
//           })
//           .select("g.filter_column", "g.id as group_id")
//           .first();

//         let dailySelection = [];
//         let isScheduled = false;

//         if (schedule) {
//           isScheduled = true;

//           // 1. Pluck values and ensure they are an array of strings
//           const groupValues = await db("cycle_count_group_values")
//             .where("group_id", schedule.group_id)
//             .pluck("value")
//             .then(values => values.map(v => String(v))); // Normalize pool to strings

//           // 2. Filter using string-to-string comparison
//           dailySelection = allItems.filter(item => {
//             const itemValue = item[schedule.filter_column];

//             // Handle null/undefined values safely
//             if (itemValue === null || itemValue === undefined) return false;

//             // Force item value to string to match groupValues type
//             return groupValues.includes(String(itemValue));
//           });

//           // 3. Remove from local pools...
//           const selectedIds = new Set(dailySelection.map(item => item.id));
//           pool.A = pool.A.filter(item => !selectedIds.has(item.id));
//           pool.B = pool.B.filter(item => !selectedIds.has(item.id));
//           pool.C = pool.C.filter(item => !selectedIds.has(item.id));

//           console.log(`   [SCHEDULED] ${dateStr}: Found ${dailySelection.length} items for group filter.`);
//         } else {
//           // 6. Auto-Sort Algorithm (10A, 7B, 3C)
//           isScheduled = false;
//           const rawSelection = [
//             ...pool.A.splice(0, 10),
//             ...pool.B.splice(0, 7),
//             ...pool.C.splice(0, 3)
//           ];

//           // Re-sort the 20 items by Category for User Walking Efficiency
//           dailySelection = rawSelection.sort((a, b) => {
//             if (a.category_id !== b.category_id) {
//               return (a.category_id || 0) - (b.category_id || 0);
//             }
//             return a.grade.localeCompare(b.grade);
//           });
//           console.log(`   [AUTO] ${dateStr}: Selected top 20 items.`);
//         }

//         // 7. Transactional Insert
//         if (dailySelection.length > 0) {
//           try {
//             await db.transaction(async (trx) => {
//               const [instance] = await trx("cycle_count_instance")
//                 .insert({
//                   date: dateStr,
//                   day: dayName,
//                   is_scheduled: isScheduled,
//                   site_mongo_id: siteId
//                 })
//                 .returning("id");

//               const itemRows = dailySelection.map(item => ({
//                 instance_id: instance.id,
//                 product_id: item.id,
//                 foh: null,
//                 boh: null,
//                 count_completed: false,
//                 priority: false
//               }));

//               await trx("cycle_count_items").insert(itemRows);
//             });
//           } catch (trxErr) {
//             console.error(`   [ERROR] Failed to save ${dateStr}:`, trxErr.message);
//           }
//         }
//       }
//     }

//     console.log("\n--- Cycle Count Generation Finished ---");
//   } catch (err) {
//     console.error("Generation failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     process.exit(0);
//   }
// }

async function generateWeeklyCycleCounts() {
  try {
    await connectDB();
    const db = getPg();
    console.log("--- Starting Weekly Cycle Count Generation ---");

    const stores = await Location.find({ type: "store" });
    const startDate = nextMonday(new Date());

    for (const store of stores) {
      const siteId = store._id.toString();
      console.log(`\nProcessing Store: ${store.stationName} (${siteId})`);

      // --- CHANGE 1: Move getRankedItems inside the loop, but only for Auto-Sort ---
      // We initialize pool as null and only fetch it if we hit a non-scheduled day
      let pool = null;

      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(startDate, i);
        const dateStr = format(targetDate, "yyyy-MM-dd");
        const dayName = format(targetDate, "EEEE");

        const existing = await db("cycle_count_instance")
          .where({ site_mongo_id: siteId, date: dateStr })
          .first();

        if (existing) {
          console.log(`   [SKIP] ${dateStr} already exists.`);
          continue;
        }

        const schedule = await db("cycle_count_schedule as s")
          .join("cycle_count_groups as g", "s.group_id", "g.id")
          .where("s.site_mongo_id", siteId)
          .andWhere(function () {
            this.where("s.date", dateStr).orWhere("s.day", dayName);
          })
          .select("g.filter_column", "g.id as group_id")
          .first();

        let dailySelection = [];
        let isScheduled = false;

        if (schedule) {
          isScheduled = true;

          // --- CHANGE 2: Query DIRECTLY from item_bk to bypass EXCLUDED_CATEGORIES ---
          const groupValues = await db("cycle_count_group_values")
            .where("group_id", schedule.group_id)
            .pluck("value")
            .then(values => values.map(v => String(v)));

          dailySelection = await db("item_bk")
            .where({
              site: siteId,
              active: true,
              allow_cycle_count: true
            })
            // Use WHERE IN with a cast to ensure string/int compatibility
            .whereIn(db.raw(`CAST(?? AS TEXT)`, [schedule.filter_column]), groupValues);

          console.log(`   [SCHEDULED] ${dateStr}: Found ${dailySelection.length} items for group filter.`);
        } else {
          isScheduled = false;

          // --- CHANGE 3: Lazy-load the Ranked Pool only when needed ---
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

          dailySelection = rawSelection.sort((a, b) => {
            if (a.category_id !== b.category_id) {
              return (a.category_id || 0) - (b.category_id || 0);
            }
            return a.grade.localeCompare(b.grade);
          });
          console.log(`   [AUTO] ${dateStr}: Selected top 20 items.`);
        }

        // 7. Transactional Insert (Same as before)
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