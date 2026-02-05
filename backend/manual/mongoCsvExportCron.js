const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { exportToAzureCSV } = require('../cron_jobs/mongoCsvExportCron');
// Import your Mongoose models here
const AuditTemplate = require("../models/audit/auditTemplate");
const AuditInstance = require("../models/audit/auditInstance");
const AuditItem = require("../models/audit/auditItem");
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')
const Safesheet = require('../models/Safesheet')
const Lottery = require('../models/Lottery')
const Location = require('../models/Location')
const Payable = require('../models/Payables');
const CycleCount = require('../models/CycleCount');
const OrderRec = require('../models/OrderRec');
const Vendor = require('../models/Vendor');
const Transaction = require("../models/Transactions");
const SelectTemplate = require("../models/audit/selectTemplate");
const WriteOff = require("../models/writeOff");

// 1. Define exactly which collections to export
const exportConfig = [
  { modelName: 'Location', collectionName: 'locations' },
  { modelName: 'AuditTemplate', collectionName: 'audit_template' },
  { modelName: 'AuditInstance', collectionName: 'audit_instance' },
  { modelName: 'AuditItem', collectionName: 'audit_item' },
  { modelName: 'CashSummary', collectionName: 'cash_summary' },
  { modelName: 'CashSummaryReport', collectionName: 'cash_summary_report' },
  { modelName: 'CycleCount', collectionName: 'cycle_count' },
  { modelName: 'Lottery', collectionName: 'lottery' },
  { modelName: 'OrderReconciliation', collectionName: 'order_reconciliation' },
  { modelName: 'Payable', collectionName: 'payable' },
  { modelName: 'Transaction', collectionName: 'transaction' },
  { modelName: 'Safesheet', collectionName: 'safesheet' },
  { modelName: 'SelectTemplate', collectionName: 'select_template' },
  { modelName: 'Vendor', collectionName: 'vendor' },
  { modelName: 'WriteOff', collectionName: 'write_off' }
];

async function runSelectedExports(Model, collectionName) {
  let hadError = false;

  try {
    console.log(`➤ Processing: ${Model.modelName} -> ${collectionName}.csv`);

    // Call the export function with our custom filename
    const blobName = await exportToAzureCSV(Model, collectionName);

    console.log(`✔ Successfully uploaded ${collectionName} to ${blobName}`);
    return blobName;


  } catch (err) {
    hadError = true;
    console.error('❌ Batch Export Failed:', err);
  }

  return hadError;
}

async function run() {
  let hadError = false;

  try {
    await connectDB();
    console.log(`🚀 Starting targeted export for ${exportConfig.length} collections...`);
    for (const config of exportConfig) {
      // Get the model from Mongoose's registry
      const Model = mongoose.model(config.modelName);

      if (!Model) {
        console.error(`⚠️ Model ${config.modelName} not found. Skipping...`);
        continue;
      }
      // You can loop through multiple models here if needed
      const blobName = await runSelectedExports(Model, config.collectionName);
      console.log(`✔ Export successful! File stored at: ${blobName}`);
    }
  } catch (err) {
    hadError = true;
    console.error('❌ Export Failed:', err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Database disconnected.');
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
module.exports = { run };