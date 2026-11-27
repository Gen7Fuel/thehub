require("dotenv").config();

const mongoose = require("mongoose");
const OrderRec = require("../models/OrderRec");

const legacyIndexName = "stationAuditResponse_1";
const replacementIndexName = "station_audit_response_unique";

async function run() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) {
    throw new Error("Usage: node manual/migrate-order-rec-station-audit-response-index.js [--apply]");
  }
  const apply = args.includes("--apply");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  const [key, options] = OrderRec.schema.indexes().find(([, index]) => index.name === replacementIndexName);

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const collection = OrderRec.collection;
  const indexes = await collection.indexes();
  const legacy = indexes.find((index) => index.name === legacyIndexName);
  if (legacy && (Object.keys(legacy.key).length !== 1 ||
      legacy.key.stationAuditResponse !== 1 || legacy.unique !== true || legacy.partialFilterExpression)) {
    throw new Error(`Unexpected definition for ${legacyIndexName}; leaving it in place`);
  }

  console.log(`${mongoose.connection.name}.${collection.name} (${apply ? "APPLY" : "DRY RUN"})`);
  console.log(`Legacy index: ${legacy ? "present" : "absent"}`);
  console.log(`Replacement index: ${indexes.some((index) => index.name === replacementIndexName) ? "present" : "absent"}`);
  if (!apply) return;

  // Keep audit-generated orders protected against duplicates throughout the swap.
  await collection.createIndex(key, options);
  if (legacy) {
    try {
      await collection.dropIndex(legacyIndexName);
    } catch (error) {
      if (error.codeName !== "IndexNotFound") throw error;
    }
  }
  console.log("Order reconciliation index repaired.");
}

run()
  .catch((error) => {
    console.error("Index repair failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
