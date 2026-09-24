const mongoose = require("mongoose");
const Location = require("../models/Location");
const ItemBk = require("../pg/models/itemBk"); // Assumed structure
const Event = require("../models/Event");
const { pushNotification } = require('../services/notificationService');
const { getPg } = require("../config/pg");
const { format, addDays, nextMonday, getMonth } = require("date-fns");
const cron = require("node-cron");

// ----------------------------------------------------------------------
// 🗓️ STORE SCHEDULE CONFIGURATION MAPPING
// ----------------------------------------------------------------------
// Maps store stationName / legalName identifiers to their scheduled count day.
const STORE_SCHEDULE_MAP = {
  "rankin": "Sunday",
  "walpole": "Sunday",
  "couchiching": "Sunday",
  "wavers west": "Sunday",
  "wavers east": "Sunday",
  "silver grizzly": "Wednesday",
  "oliver": "Thursday",
  "osoyoos": "Thursday",
  "charlies": "Thursday"
};

const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000");

/**
 * Resolves the scheduled count day for a given store model instance.
 * Defaults to Sunday if unmapped.
 */
function getStoreScheduledDay(store) {
  const name = (store.stationName || store.legalName || "").toLowerCase().trim();
  for (const [key, day] of Object.entries(STORE_SCHEDULE_MAP)) {
    if (name.includes(key)) return day;
  }
  return "Sunday"; // Fallback default
}

/**
 * Checks whether a given target date is the last occurrence of its day-of-week in that month.
 * 
 * @param {Date} targetDate 
 * @returns {boolean}
 */
function isLastDayOfWeekInMonth(targetDate) {
  const currentMonth = getMonth(targetDate);
  const nextWeekSameDay = addDays(targetDate, 7);
  return getMonth(nextWeekSameDay) !== currentMonth;
}

async function runWeeklyInstanceCalculations(io = null) {
  const db = getPg();
  console.log("--- Starting Weekly Cycle Count Generation ---");

  try {
    const stores = await Location.find({ type: "store" });
    const startDate = nextMonday(new Date());

    for (const store of stores) {
      const siteId = store._id.toString();
      const siteName = store.site || store.stationName || store.legalName;
      const scheduledDayName = getStoreScheduledDay(store);
      console.log(`\nProcessing Store: ${store.stationName} (${siteId}) | Target Day: ${scheduledDayName}`);

      let pool = null;
      let scheduledNegativeProductIds = new Set();

      // ==================================================================
      // PASS 1: CHECK FOR END-OF-MONTH SCHEDULED NEGATIVE INVENTORY COUNT
      // ==================================================================
      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(startDate, i);
        const dayName = format(targetDate, "EEEE");

        if (dayName.toLowerCase() === scheduledDayName.toLowerCase()) {
          if (isLastDayOfWeekInMonth(targetDate)) {
            const dateStr = format(targetDate, "yyyy-MM-dd");
            console.log(`   [END-OF-MONTH DETECTED] ${dateStr} (${dayName}) is the last ${dayName} of the month.`);

            // Query all active items for site with negative on_hand_qty sorted negative-first
            const negativeItems = await db("item_bk")
              .where({ site: siteId, active: true, allow_cycle_count: true })
              .where("on_hand_qty", "<", 0)
              .orderBy("on_hand_qty", "asc")
              .select("id", "on_hand_qty");

            if (negativeItems.length > 0) {
              console.log(`   [END-OF-MONTH] Found ${negativeItems.length} items with negative on-hand quantity.`);

              try {
                await db.transaction(async (trx) => {
                  // Check existing instance
                  let instance = await trx("cycle_count_instance")
                    .where({ site_mongo_id: siteId, date: dateStr })
                    .first();

                  let instanceId;

                  if (!instance) {
                    const [inserted] = await trx("cycle_count_instance")
                      .insert({
                        date: dateStr,
                        day: dayName,
                        is_scheduled: true,
                        site_mongo_id: siteId,
                        group_id: null
                      })
                      .returning("id");

                    instanceId = typeof inserted === 'object' ? inserted.id : inserted;
                  } else {
                    instanceId = instance.id;
                    await trx("cycle_count_instance")
                      .where({ id: instanceId })
                      .update({ is_scheduled: true, group_id: null });
                  }

                  // Prepare items for insertion
                  const childRows = negativeItems.map(item => ({
                    instance_id: instanceId,
                    product_id: item.id,
                    foh: null,
                    boh: null,
                    count_completed: false,
                    priority: false
                  }));

                  // Insert with conflict resolution to prevent duplicate entries
                  const chunkSize = 1000;
                  for (let c = 0; c < childRows.length; c += chunkSize) {
                    await trx("cycle_count_items")
                      .insert(childRows.slice(c, c + chunkSize))
                      .onConflict(["instance_id", "product_id"])
                      .ignore();
                  }

                  // Track negative item IDs to exclude them from standard auto-generated counts
                  negativeItems.forEach(item => scheduledNegativeProductIds.add(item.id));
                });

                console.log(`   [SUCCESS] Scheduled EOM negative instance created/updated for ${dateStr} with ${negativeItems.length} products.`);

                // =========================================================================
                // Asynchronous Background System Event Creation & Notification Dispatch
                // =========================================================================
                try {
                  const eventTitle = `Count Scheduled - Negative Inventory`;
                  const eventDescription = `Cycle Count Scheduled for ${dateStr} and Negative Inventory (~${negativeItems.length} items)`;

                  // 1. Create System Event with non-null Mongoose ObjectId
                  const event = await Event.create({
                    site: siteName,
                    title: eventTitle,
                    description: eventDescription,
                    date: String(dateStr),
                    type: 'system',
                    createdBy: {
                      id: SYSTEM_USER_ID,
                      firstName: 'System',
                      lastName: 'Generated',
                      email: 'system@gen7fuel.com',
                    },
                  });

                  // 2. Resolve Recipients from Location record (managerEmails or store email)
                  const managerEmails = (store.managerEmails || [])
                    .filter(e => Boolean(e) && typeof e === 'string')
                    .map(e => e.trim().toLowerCase());

                  const storeEmail = store.email ? store.email.trim().toLowerCase() : null;

                  let recipientEmails = managerEmails.length > 0
                    ? managerEmails
                    : (storeEmail ? [storeEmail] : []);

                  recipientEmails = [...new Set(recipientEmails)];

                  // 3. Queue / Push Notification
                  if (recipientEmails.length > 0) {
                    const senderName = 'System Generated';
                    const monthStr = String(dateStr).substring(0, 7);
                    const baseUrl = process.env.CLIENT_URL || 'http://app.gen7fuel.com';
                    const calendarUrl = `${baseUrl}/events?site=${encodeURIComponent(siteName)}&month=${monthStr}`;

                    await pushNotification({
                      io,
                      senderId: SYSTEM_USER_ID,
                      recipientEmails,
                      slug: 'new-event-created',
                      fieldValues: {
                        senderName,
                        site: siteName,
                        eventTitle: event.title,
                        eventDate: event.date,
                        calendarUrl,
                      },
                      subject: `New Event Created for ${siteName}: ${event.title}`,
                      type: 'system',
                    });
                    console.log(`   [NOTIFICATION] Dispatched notification for ${siteName} to: ${recipientEmails.join(", ")}`);
                  }
                } catch (bgError) {
                  console.error('Error creating background schedule event or sending notification:', bgError);
                }

              } catch (eomErr) {
                console.error(`   [ERROR] Failed creating EOM scheduled instance for ${dateStr}:`, eomErr.message);
              }
            } else {
              console.log(`   [END-OF-MONTH] No negative on-hand quantity items found for ${dateStr}.`);
            }
          }
          break; // Day matched for this week, exit Pass 1 loop
        }
      }

      // ==================================================================
      // PASS 2: REGULAR AUTO-SORT DAILY CYCLE COUNT GENERATION
      // ==================================================================
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
          
          // Filter out negative items already booked in the scheduled EOM count
          const filteredRanked = allRanked.filter(
            item => !scheduledNegativeProductIds.has(item.id)
          );

          pool = {
            A: filteredRanked.filter(i => i.grade === 'A'),
            B: filteredRanked.filter(i => i.grade === 'B'),
            C: filteredRanked.filter(i => i.grade === 'C')
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

/**
 * Initializer Function called from app.js
 */
function initWeeklyInstanceCron(io) {
  // Runs every Sunday at exactly 03:00 AM
  cron.schedule("0 3 * * 0", async () => {
    console.log(`[${new Date().toISOString()}] Triggering scheduled Sunday morning Weekly Instance Calculation engine...`);
    try {
      await runWeeklyInstanceCalculations(io);
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

  console.log("📅 Cycle Count Weekly Instance Cron Job Initialized.");
}

module.exports = { 
  initWeeklyInstanceCron,
  runWeeklyInstanceCalculations, 
  archiveHistoricalCycleCounts 
};