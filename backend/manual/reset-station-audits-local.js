require("dotenv").config();

const mongoose = require("mongoose");
const {
  StationAuditVisitorReportDispatch,
  StationAuditIssueActivity,
  StationAuditIssue,
  StationAuditResponse,
  StationAuditRun,
  StationAuditChecklistRevision,
  StationAuditChecklist,
  StationAuditSection,
  StationAuditDepartment,
  StationAuditStatusOptionSet,
} = require("../models/station-audits");

const collections = [
  StationAuditVisitorReportDispatch,
  StationAuditIssueActivity,
  StationAuditIssue,
  StationAuditResponse,
  StationAuditRun,
  StationAuditChecklistRevision,
  StationAuditChecklist,
  StationAuditSection,
  StationAuditDepartment,
  StationAuditStatusOptionSet,
].map((model) => model.collection.name);

async function run() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) {
    throw new Error("Usage: node manual/reset-station-audits-local.js [--apply]");
  }
  const apply = args.includes("--apply");
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not configured");
  const target = new URL(uri);
  if (process.env.HOST === "VPS" || target.protocol !== "mongodb:" ||
      !["mongo", "localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("This reset is restricted to local MongoDB and the dev Docker mongo service.");
  }

  await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
  const db = mongoose.connection.db;
  console.log(`Station Audits reset for "${db.databaseName}" (${apply ? "APPLY" : "DRY RUN"})`);
  for (const name of collections) {
    const collection = db.collection(name);
    if (apply) {
      const result = await collection.deleteMany({});
      console.log(`  ${name}: deleted ${result.deletedCount}`);
    } else {
      console.log(`  ${name}: ${await collection.countDocuments()} documents`);
    }
  }
  if (!apply) console.log("Re-run with --apply to clear these collections.");
}

run()
  .catch((error) => {
    console.error("Station Audits reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
