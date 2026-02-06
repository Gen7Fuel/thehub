const { Transform } = require('json2csv');
const { BlobServiceClient } = require("@azure/storage-blob");
const { PassThrough } = require('stream');
const cron = require("node-cron");
const mongoose = require('mongoose');
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


const generalizedFlattener = (doc) => {
  const flattened = {};

  const worker = (obj, prefix = '') => {
    // Handle null/undefined immediately
    if (obj === null || obj === undefined) return;

    Object.keys(obj).forEach(key => {
      // 1. Skip internal Mongoose versioning
      if (key === '__v') return;

      const value = obj[key];
      const propName = prefix ? `${prefix}_${key}` : key;

      // 2. Handle Special MongoDB Types (The "Fix")
      if (value instanceof mongoose.Types.ObjectId || (value && value._bsontype === 'ObjectID')) {
        flattened[propName] = value.toString();
      }
      else if (value instanceof Date) {
        flattened[propName] = value.toISOString();
      }
      // 3. Handle Nested Objects (Recursion)
      // We check if it's a "plain" object and not a special type
      else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        worker(value, propName);
      }
      // 4. Handle Arrays
      else if (Array.isArray(value)) {
        // Check if array contains objects; if so, stringify it
        if (value.length > 0 && typeof value[0] === 'object') {
          flattened[propName] = JSON.stringify(value);
        } else {
          flattened[propName] = value.join('|');
        }
      }
      // 5. Primitives (String, Number, Boolean)
      else {
        flattened[propName] = value;
      }
    });
  };

  worker(doc);
  return flattened;
};

async function exportToAzureCSV(model, collectionName) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_CONTAINER;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // 1. Create a cursor
  const cursor = model.find().lean().cursor();

  // 2. CSV Transform
  const schemaFields = Object.keys(model.schema.paths).filter(path => path !== '__v');

  const json2csv = new Transform({
    fields: schemaFields, // This forces these headers to appear in the CSV
    defaultValue: '',   // Handles missing values gracefully
    transforms: [(item) => generalizedFlattener(item)]
  }, { objectMode: true });

  // 3. STATIC FILE NAME (No timestamp)
  // This will overwrite the existing file in Azure every time it runs.
  const blobName = `hub_csv_exports/${collectionName}/${collectionName}_master.csv`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const uploadStream = new PassThrough();

  // uploadStream will replace the blob if it already exists
  const uploadPromise = blockBlobClient.uploadStream(uploadStream,
    4 * 1024 * 1024, // 4MB buffer size
    20,              // concurrency
    { blobHTTPHeaders: { blobContentType: "text/csv" } }
  );

  console.log(`➤ Overwriting ${blobName} with fresh data...`);
  cursor.pipe(json2csv).pipe(uploadStream);

  await uploadPromise;
  return blobName;
}

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

async function runMongoCsvExport() {
  let hadError = false;


  try {
    console.log(`🚀 Starting targeted export for ${exportConfig.length} collections...`);

    for (const config of exportConfig) {
      // Get the model from Mongoose's registry
      const Model = mongoose.model(config.modelName);

      if (!Model) {
        console.error(`⚠️ Model ${config.modelName} not found. Skipping...`);
        continue;
      }
      console.log(`➤ Processing: ${Model.modelName} -> ${config.collectionName}.csv`);

      // Call the export function with our custom filename
      const blobName = await exportToAzureCSV(Model, config.collectionName);

      console.log(`✔ Successfully uploaded ${config.collectionName} to ${blobName}`);
    }
  } catch (err) {
    hadError = true;
    console.error('❌ Export Failed:', err);
  } finally {
    try {
      console.log('Export Completed.');
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

/**
 * CRON SCHEDULER
 * Runs daily at 10:00 AM EST/EDT
 * 0  - Minute (0)
 * 10 - Hour (10 AM)
 * * - Day of Month (Every)
 * * - Month (Every)
 * * - Day of Week (Every)
 */
cron.schedule("* 6 * * *", async () => {
    console.log(`[${new Date().toISOString()}] ⏰ Starting Scheduled Daily Export...`);
    try {
        await runMongoCsvExport();
        console.log(`[${new Date().toISOString()}] ✅ Scheduled Export Completed Successfully.`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ Scheduled Export Failed:`, err);
    }
}, {
    scheduled: true,
    timezone: "America/New_York" // Handles Daylight Savings (EST/EDT) automatically
});

module.exports = { runMongoCsvExport };