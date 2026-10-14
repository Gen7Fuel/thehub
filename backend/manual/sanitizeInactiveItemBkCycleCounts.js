/**
 * One-off script: sanitize inactive item_bk rows and remove them from future
 * cycle count instances.
 *
 * Dry run by default; nothing is written unless --apply is passed.
 *   node manual/sanitizeInactiveItemBkCycleCounts.js
 *   node manual/sanitizeInactiveItemBkCycleCounts.js --apply
 *   node manual/sanitizeInactiveItemBkCycleCounts.js --as-of=2026-10-07 --apply
 *
 * Rules:
 * - item_bk rows where active=false get allow_cycle_count=false and on_hand_qty=0.
 * - cycle_count_items rows are deleted when their product_id points at an
 *   inactive item_bk row and their instance date is after the as-of date.
 */

require("dotenv").config();

const { DateTime } = require("luxon");
const { getPg } = require("../config/pg");

const apply = process.argv.includes("--apply");
const asOfArg = process.argv.find((arg) => arg.startsWith("--as-of="));
const asOfDate = asOfArg
  ? asOfArg.split("=")[1]
  : DateTime.now().setZone("America/Toronto").toISODate();

function assertValidDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid --as-of date "${dateString}". Expected YYYY-MM-DD.`);
  }
}

async function countInactiveItemsNeedingSanitization(db) {
  const row = await db("item_bk")
    .where("active", false)
    .andWhere(function () {
      this.where("allow_cycle_count", true)
        .orWhereNull("on_hand_qty")
        .orWhere("on_hand_qty", "<>", 0);
    })
    .count({ count: "*" })
    .first();

  return Number(row?.count || 0);
}

async function countFutureInactiveCycleCountItems(db, todayDateStr) {
  const row = await db("cycle_count_items as cci")
    .join("cycle_count_instance as inst", "cci.instance_id", "inst.id")
    .join("item_bk as ib", "cci.product_id", "ib.id")
    .where("inst.date", ">", todayDateStr)
    .where("ib.active", false)
    .count({ count: "*" })
    .first();

  return Number(row?.count || 0);
}

async function sanitizeInactiveItemBkCycleCounts({ shouldApply = false, todayDateStr = asOfDate } = {}) {
  assertValidDate(todayDateStr);

  const db = getPg();
  console.log("--- Inactive item_bk / future cycle count sanitization ---");
  console.log(`Mode: ${shouldApply ? "APPLY" : "dry run"}`);
  console.log(`As-of date: ${todayDateStr}`);

  const inactiveItemsToSanitize = await countInactiveItemsNeedingSanitization(db);
  const futureRowsToDelete = await countFutureInactiveCycleCountItems(db, todayDateStr);

  console.log(`Inactive item_bk rows needing allow_cycle_count=false/on_hand_qty=0: ${inactiveItemsToSanitize}`);
  console.log(`Future cycle_count_items rows pointing to inactive products: ${futureRowsToDelete}`);

  if (!shouldApply) {
    console.log("Dry run complete. Re-run with --apply to write these changes.");
    return {
      itemBkUpdated: inactiveItemsToSanitize,
      cycleCountItemsDeleted: futureRowsToDelete,
      applied: false,
    };
  }

  let itemBkUpdated = 0;
  let cycleCountItemsDeleted = 0;

  await db.transaction(async (trx) => {
    itemBkUpdated = await trx("item_bk")
      .where("active", false)
      .andWhere(function () {
        this.where("allow_cycle_count", true)
          .orWhereNull("on_hand_qty")
          .orWhere("on_hand_qty", "<>", 0);
      })
      .update({
        allow_cycle_count: false,
        on_hand_qty: 0,
        sync_date: trx.fn.now(),
      });

    cycleCountItemsDeleted = await trx("cycle_count_items as cci")
      .whereExists(function () {
        this.select(1)
          .from("cycle_count_instance as inst")
          .whereRaw("inst.id = cci.instance_id")
          .where("inst.date", ">", todayDateStr);
      })
      .whereExists(function () {
        this.select(1)
          .from("item_bk as ib")
          .whereRaw("ib.id = cci.product_id")
          .where("ib.active", false);
      })
      .del();
  });

  console.log(`Updated item_bk rows: ${itemBkUpdated}`);
  console.log(`Deleted future cycle_count_items rows: ${cycleCountItemsDeleted}`);
  console.log("Sanitization complete.");

  return {
    itemBkUpdated,
    cycleCountItemsDeleted,
    applied: true,
  };
}

async function run() {
  let hadError = false;
  const db = getPg();

  try {
    await sanitizeInactiveItemBkCycleCounts({ shouldApply: apply, todayDateStr: asOfDate });
  } catch (err) {
    hadError = true;
    console.error("Sanitization failed:", err);
  } finally {
    try {
      await db.destroy();
      console.log("Postgres disconnected.");
    } catch (e) {}
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = {
  sanitizeInactiveItemBkCycleCounts,
  countInactiveItemsNeedingSanitization,
  countFutureInactiveCycleCountItems,
};
