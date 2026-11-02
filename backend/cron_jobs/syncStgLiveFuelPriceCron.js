const cron = require("node-cron");
const mssql = require('mssql');
const { getPool } = require('../services/sqlService');

async function processMonthlySync() {
  let transaction;

  try {
    const pool = await getPool();
    transaction = new mssql.Transaction(pool);

    await transaction.begin();
    console.log("Starting monthly sync...");

    // List of tables to sync
    const tables = [
      { name: 'SupplierDiscounts', keys: ['Supplier Code', ' Supplier Item', 'Inventory Item'] },
      { name: 'CarrierFCS', keys: ['Carrier', 'Province'] },
      { name: 'CarrierHaulage', keys: ['Carrier', 'Type', 'Location', 'Pickup'] }
    ];

    // mssql rejects parameter names containing spaces or punctuation.
    const cleanParamName = (column) => column.replace(/[^a-zA-Z0-9_]/g, '');

    for (const table of tables) {
      // 1. Fetch pending records from Staging
      const stgData = await new mssql.Request(transaction)
        .query(`SELECT * FROM [FUEL].[Stg_${table.name}] WHERE [Updated At] IS NOT NULL`);

      for (const row of stgData.recordset) {
        // 2. Prepare dynamic WHERE clause for the primary keys
        const whereClause = table.keys.map(k => `[${k}] = @${cleanParamName(k)}`).join(' AND ');
        
        // 3. Perform Upsert into Live Table
        const upsertReq = new mssql.Request(transaction);
        table.keys.forEach(k => upsertReq.input(cleanParamName(k), mssql.VarChar, row[k]));
        
        // Add values for update (excluding keys)
        const metadataColumns = new Set([
          'Created At',
          'Updated At',
          'Deleted At',
          'Created_At',
          'Updated_At',
          'Deleted_At'
        ]);
        const columns = Object.keys(row).filter(
          c => !table.keys.includes(c) && !metadataColumns.has(c)
        );
        columns.forEach(c => upsertReq.input(cleanParamName(c), mssql.Float, row[c]));

        const updateSet = columns.map(c => `[${c}] = @${cleanParamName(c)}`).join(', ');

        await upsertReq.query(`
          UPDATE [FUEL].[${table.name}] 
          SET ${updateSet}, [Updated At] = GETDATE() 
          WHERE ${whereClause};
          
          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO [FUEL].[${table.name}] (${table.keys.map(k => `[${k}]`).join(', ')}, ${columns.map(c => `[${c}]`).join(', ')}, [Updated At])
            VALUES (${table.keys.map(k => `@${cleanParamName(k)}`).join(', ')}, ${columns.map(c => `@${cleanParamName(c)}`).join(', ')}, GETDATE())
          END
        `);

        // 4. Clear staging timestamp
        const clearReq = new mssql.Request(transaction);
        table.keys.forEach(k => clearReq.input(cleanParamName(k), mssql.VarChar, row[k]));
        await clearReq.query(`UPDATE [FUEL].[Stg_${table.name}] SET [Updated At] = NULL WHERE ${whereClause}`);
      }
    }

    await transaction.commit();
    console.log("Monthly sync completed successfully.");
  } catch (err) {
    // Only attempt rollback if the transaction was actually initiated
    if (transaction && transaction._begun) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }
    console.error("Monthly sync failed:", err);
    throw err; // 👈 CRITICAL: Re-throw so cron.schedule catches it and retries!
  }
}

// Runs at 12:00 AM (Midnight) America/Toronto time on the 1st day of every month
cron.schedule("0 0 1 * *", async () => {
  console.log("Running monthly automatic sync at midnight...");
  
  const maxCronRetries = 3;
  for (let attempt = 1; attempt <= maxCronRetries; attempt++) {
    try {
      await processMonthlySync();
      break; // Success exit loop
    } catch (err) {
      console.error(`Monthly sync failed on attempt ${attempt}/${maxCronRetries}.`);
      if (attempt < maxCronRetries) {
        console.log("Waiting 30 seconds before retrying entire sync job...");
        await new Promise(res => setTimeout(res, 30000));
      } else {
        console.error("CRITICAL: Monthly sync completely failed after max retries.");
      }
    }
  }
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { processMonthlySync };
