const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const parquet = require("parquetjs-lite");
const { BlobServiceClient } = require("@azure/storage-blob");
const { getPg } = require("../config/pg");

// List of tables to EXCLUDE from export
const EXCLUDED_TABLES = [
  "item_bk",
  "deleted_items_log",
  "knex_migrations",
  "knex_migrations_lock",
];

/**
 * Maps PostgreSQL data types to Parquet primitive types.
 */
function mapPgTypeToParquet(pgTypeRaw) {
  const type = (pgTypeRaw || "").toLowerCase();

  if (type.includes("int") || type.includes("serial")) {
    return { type: "INT64", optional: true };
  }
  if (
    type.includes("float") ||
    type.includes("double") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("real")
  ) {
    return { type: "DOUBLE", optional: true };
  }
  if (type.includes("bool")) {
    return { type: "BOOLEAN", optional: true };
  }
  if (
    type.includes("timestamp") ||
    type.includes("date") ||
    type.includes("time")
  ) {
    return { type: "TIMESTAMP_MILLIS", optional: true };
  }
  if (type.includes("json")) {
    return { type: "UTF8", optional: true };
  }

  return { type: "UTF8", optional: true };
}

/**
 * Normalizes PostgreSQL cell values to match Parquet type expectations.
 */
function sanitizeRow(row, columnTypes) {
  const sanitized = {};
  for (const [col, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      continue;
    }

    const typeInfo = columnTypes[col];
    const rawType = typeInfo ? typeInfo.type || typeInfo.dataType || "" : "";
    const pgType = rawType.toLowerCase();

    if (pgType.includes("json")) {
      sanitized[col] =
        typeof value === "object" ? JSON.stringify(value) : String(value);
    } else if (pgType.includes("timestamp") || pgType.includes("date")) {
      sanitized[col] = value instanceof Date ? value : new Date(value);
    } else if (pgType.includes("int") || pgType.includes("serial")) {
      sanitized[col] = BigInt(value);
    } else if (
      pgType.includes("float") ||
      pgType.includes("double") ||
      pgType.includes("numeric") ||
      pgType.includes("decimal") ||
      pgType.includes("real")
    ) {
      sanitized[col] = parseFloat(value);
    } else if (pgType.includes("bool")) {
      sanitized[col] = Boolean(value);
    } else {
      sanitized[col] = String(value);
    }
  }
  return sanitized;
}

/**
 * Exports a single PostgreSQL table to Parquet format and uploads to Azure.
 */
async function exportTableToParquet(tableName, containerClient, db) {
  const tempFilePath = path.join("/tmp", `${tableName}_temp.parquet`);

  try {
    // 1. Fetch table column definitions dynamically
    const columnTypes = await db(tableName).columnInfo();

    const schemaFields = {};
    for (const [colName, info] of Object.entries(columnTypes)) {
      schemaFields[colName] = mapPgTypeToParquet(info.type || info.dataType);
    }

    const parquetSchema = new parquet.ParquetSchema(schemaFields);

    // 2. Fetch rows from table
    const rows = await db(tableName).select("*");

    // 3. Create Parquet writer targeting temporary local file
    const writer = await parquet.ParquetWriter.openFile(
      parquetSchema,
      tempFilePath
    );

    // 4. Append rows to Parquet writer
    for (const row of rows) {
      const cleanRow = sanitizeRow(row, columnTypes);
      await writer.appendRow(cleanRow);
    }
    await writer.close();

    // 5. Upload Parquet file to Azure Blob Storage
    const blobName = `hub_postgres_parquet_exports/${tableName}/${tableName}_master.parquet`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    console.log(`➤ Uploading snapshot ${blobName} to Azure...`);
    await blockBlobClient.uploadFile(tempFilePath, {
      blobHTTPHeaders: { blobContentType: "application/x-parquet" },
    });

    return blobName;
  } finally {
    // Clean up temporary local Parquet file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Main function to fetch tables and trigger export process
 */
async function runPostgresParquetExport() {
  const db = getPg();

  // Initialize Azure Blob Container Client once for all tables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_CONTAINER;

  if (!connectionString || !containerName) {
    throw new Error(
      "Missing AZURE_STORAGE_CONNECTION_STRING or AZURE_CONTAINER env variable"
    );
  }

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  try {
    console.log("🚀 Fetching PostgreSQL schema tables...");

    const tablesResult = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    const allTables = tablesResult.rows.map((row) => row.table_name);
    const targetTables = allTables.filter(
      (table) => !EXCLUDED_TABLES.includes(table)
    );

    console.log(
      `📋 Found ${targetTables.length} tables to export:`,
      targetTables
    );

    for (const tableName of targetTables) {
      console.log(`➤ Processing table: ${tableName}`);
      const uploadedBlob = await exportTableToParquet(
        tableName,
        containerClient,
        db
      );
      console.log(`✔ Successfully exported ${tableName} -> ${uploadedBlob}`);
    }

    console.log("✅ All Postgres Parquet exports completed successfully.");
  } catch (err) {
    console.error("❌ Postgres Parquet Export Failed:", err);
  }
}

/**
 * CRON SCHEDULER (Daily at 5:45 AM EDT)
 */
cron.schedule(
  "45 5 * * *",
  async () => {
    console.log(
      `[${new Date().toISOString()}] ⏰ Starting Scheduled Daily Postgres Parquet Export...`
    );
    await runPostgresParquetExport();
  },
  {
    scheduled: true,
    timezone: "America/Toronto",
  }
);

module.exports = { runPostgresParquetExport };