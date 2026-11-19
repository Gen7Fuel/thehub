require("dotenv").config();
const connectDB = require("../config/db");
const { StationAuditRun } = require("../models/station-audits");

const apply = process.argv.includes("--apply");
const OLD_KEY = { section: 1, site: 1, frequency: 1, periodKey: 1, type: 1 };
const STORE_INDEX = "station_audit_store_run_unique";
const VISITOR_INDEX = "station_audit_visitor_run_unique";

function sameKey(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function run() {
  await connectDB();
  const collection = StationAuditRun.collection;
  const indexes = await collection.indexes();
  const oldIndex = indexes.find((index) =>
    sameKey(index.key, OLD_KEY)
    && index.unique === true
    && !index.partialFilterExpression
  );

  console.log(`Station Audit Visitor run index migration (${apply ? "APPLY" : "DRY RUN"})`);
  console.log(`  Existing legacy index: ${oldIndex?.name || "not found"}`);
  console.log(`  Store partial index:    ${indexes.some((index) => index.name === STORE_INDEX) ? "present" : "missing"}`);
  console.log(`  Visitor partial index:  ${indexes.some((index) => index.name === VISITOR_INDEX) ? "present" : "missing"}`);

  if (!apply) {
    console.log("No changes applied. Re-run with --apply to replace the legacy unique index.");
    return;
  }

  // Build the Visitor index first while the stricter legacy index still
  // protects all existing data. Existing Visitor runs already have startedBy.
  await collection.createIndex(
    { section: 1, site: 1, frequency: 1, periodKey: 1, type: 1, startedBy: 1 },
    { unique: true, name: VISITOR_INDEX, partialFilterExpression: { type: "visitor" } }
  );

  if (oldIndex) await collection.dropIndex(oldIndex.name);

  await collection.createIndex(
    OLD_KEY,
    { unique: true, name: STORE_INDEX, partialFilterExpression: { type: "store" } }
  );

  console.log("Visitor runs are now unique per user; Store runs remain shared per period.");
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Station Audit Visitor run index migration failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await require("mongoose").disconnect();
    });
}

module.exports = { run, sameKey };
