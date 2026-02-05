const { Transform } = require('json2csv');
const { BlobServiceClient } = require("@azure/storage-blob");
const { PassThrough } = require('stream');
const mongoose = require('mongoose');

/**
 * Transforms multi-dimensional objects into a flat structure
 * e.g. { a: { b: 1 } } -> { "a.b": 1 }
 */
// const flattenData = (doc) => {
//     const flattened = {};
//     const worker = (obj, prefix = '') => {
//         for (const key in obj) {
//             const propName = prefix ? `${prefix}_${key}` : key;
//             if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
//                 worker(obj[key], propName);
//             } else if (Array.isArray(obj[key])) {
//                 flattened[propName] = obj[key].join('|'); // SQL friendly array string
//             } else {
//                 flattened[propName] = obj[key];
//             }
//         }
//     };
//     worker(doc);
//     return flattened;
// };

/**
 * A truly generalized flattener that works for any collection
 */
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
    { modelName: 'Location', fileName: 'locations_master' },
    { modelName: 'User', fileName: 'users_master' },
    { modelName: 'AuditIssue', fileName: 'audit_report_master' },
    // Add more as needed...
];

async function runSelectedExports() {
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

            console.log(`➤ Processing: ${config.modelName} -> ${config.fileName}.csv`);

            // Call the export function with our custom filename
            await exportToAzureCSV(Model, config.fileName);
            
            console.log(`✔ Successfully uploaded ${config.fileName}`);
        }

    } catch (err) {
        hadError = true;
        console.error('❌ Batch Export Failed:', err);
    }
    
    return hadError;
}

module.exports = { exportToAzureCSV };