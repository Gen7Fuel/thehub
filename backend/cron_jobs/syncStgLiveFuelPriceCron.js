const cron = require("node-cron");
const mssql = require('mssql');
const { getPool } = require('../services/sqlService');

async function processMonthlySync() {
  const pool = await getPool();
  const transaction = new mssql.Transaction(pool);

  try {
    await transaction.begin();
    console.log("Starting monthly sync...");

    // List of tables to sync
    const tables = [
      { name: 'SupplierDiscounts', keys: ['Supplier Code', ' Supplier Item', 'Inventory Item'] },
      { name: 'CarrierFCS', keys: ['Carrier', 'Province'] },
      { name: 'CarrierHaulage', keys: ['Carrier', 'Type', 'Location', 'Pickup'] }
    ];

    for (const table of tables) {
      // 1. Fetch pending records from Staging
      const stgData = await new mssql.Request(transaction)
        .query(`SELECT * FROM [FUEL].[Stg_${table.name}] WHERE [Updated At] IS NOT NULL`);

      for (const row of stgData.recordset) {
        // 2. Prepare dynamic WHERE clause for the primary keys
        const whereClause = table.keys.map(k => `[${k}] = @${k.replace(/\s/g, '')}`).join(' AND ');
        
        // 3. Perform Upsert into Live Table
        const upsertReq = new mssql.Request(transaction);
        table.keys.forEach(k => upsertReq.input(k.replace(/\s/g, ''), mssql.VarChar, row[k]));
        
        // Add values for update (excluding keys)
        const columns = Object.keys(row).filter(c => !table.keys.includes(c) && c !== 'Updated At');
        columns.forEach(c => upsertReq.input(c, mssql.Float, row[c]));

        const updateSet = columns.map(c => `[${c}] = @${c}`).join(', ');

        const result = await upsertReq.query(`
          UPDATE [FUEL].[TEST_${table.name}] 
          SET ${updateSet}, [Updated At] = GETDATE() 
          WHERE ${whereClause};
          
          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO [FUEL].[TEST_${table.name}] (${table.keys.map(k => `[${k}]`).join(', ')}, ${columns.map(c => `[${c}]`).join(', ')}, [Updated At])
            VALUES (${table.keys.map(k => `@${k.replace(/\s/g, '')}`).join(', ')}, ${columns.map(c => `@${c}`).join(', ')}, GETDATE())
          END
        `);

        // 4. Clear staging timestamp
        const clearReq = new mssql.Request(transaction);
        table.keys.forEach(k => clearReq.input(k.replace(/\s/g, ''), mssql.VarChar, row[k]));
        await clearReq.query(`UPDATE [FUEL].[Stg_${table.name}] SET [Updated At] = NULL WHERE ${whereClause}`);
      }
    }

    await transaction.commit();
    console.log("Monthly sync completed successfully.");
  } catch (err) {
    await transaction.rollback();
    console.error("Monthly sync failed:", err);
  }
}

// Runs at 12:00 AM (Midnight) America/Toronto time on the 1st day of every month
cron.schedule("0 0 1 * *", () => {
  console.log("Running monthly automatic sync at midnight...");
  processMonthlySync();
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { processMonthlySync };