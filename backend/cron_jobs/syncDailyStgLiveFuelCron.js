const cron = require("node-cron");
const mssql = require('mssql');
const { getPool } = require('../services/sqlService');

async function processDailyScheduledSync() {
  let transaction;

  try {
    const pool = await getPool();
    transaction = new mssql.Transaction(pool);

    await transaction.begin();
    console.log("Starting daily effective-date schedule sync for Station Discounts...");

    const tables = [
      { 
        name: 'Station_Discounts', 
        livePrefix: 'TEST_', // Matches [FUEL].[TEST_Station_Discounts]
        stgPrefix: 'Stg_',    // Matches [FUEL].[Stg_Station_Discounts]
        keys: ['Station_SK', 'Location', 'Province', 'Type', 'Fuel_Grade'],
        valueTypes: {
          'Discounts': mssql.Decimal(18, 4)
        }
      }
    ];

    for (const table of tables) {
      const liveTableName = `[FUEL].[${table.name}]`;
      const stgTableName = `[FUEL].[${table.stgPrefix}${table.name}]`;

      // 1. Fetch rows meant to go live today from the staging table
      const stgData = await new mssql.Request(transaction)
        .query(`
          SELECT * FROM ${stgTableName} 
          WHERE CAST([Schedule_Effective_From] AS DATE) = CAST(GETDATE() AS DATE)
        `);

      console.log(`Found ${stgData.recordset.length} pending updates to push to ${liveTableName}`);

      for (const row of stgData.recordset) {
        const cleanParamName = (k) => k.replace(/[^a-zA-Z0-9]/g, '');

        // 2. Build standard WHERE match criteria
        const whereClause = table.keys.map(k => {
          const p = cleanParamName(k);
          return `([${k}] = @${p} OR ([${k}] IS NULL AND @${p} IS NULL))`;
        }).join(' AND ');
        
        const upsertReq = new mssql.Request(transaction);
        
        // Bind primary composite business keys
        table.keys.forEach(k => {
          upsertReq.input(cleanParamName(k), mssql.NVarChar, row[k] || null);
        });
        
        // Ignore date/metadata timestamp columns
        const skipColumns = [
          ...table.keys, 
          'Schedule_Effective_From', 
          'Updated_At', 
          'Updated At', 
          'Created_At', 
          'Created At', 
          'Deleted_At', 
          'Deleted At'
        ];
        
        const dataColumns = Object.keys(row).filter(c => !skipColumns.includes(c));

        // Bind value parameters using specified type map or fallback to NVarChar
        dataColumns.forEach(c => {
          const typeMapping = (table.valueTypes && table.valueTypes[c]) ? table.valueTypes[c] : mssql.NVarChar;
          upsertReq.input(cleanParamName(c), typeMapping, row[c]);
        });

        const updateSet = dataColumns.map(c => `[${c}] = @${cleanParamName(c)}`).join(', ');

        // 3. Perform live sync update/insert
        await upsertReq.query(`
          UPDATE ${liveTableName} 
          SET ${updateSet}, [Updated_At] = GETDATE() 
          WHERE ${whereClause};
          
          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO ${liveTableName} (
              ${table.keys.map(k => `[${k}]`).join(', ')}, 
              ${dataColumns.map(c => `[${c}]`).join(', ')}, 
              [Created_At],
              [Updated_At]
            )
            VALUES (
              ${table.keys.map(k => `@${cleanParamName(k)}`).join(', ')}, 
              ${dataColumns.map(c => `@${cleanParamName(c)}`).join(', ')}, 
              GETDATE(),
              GETDATE()
            )
          END
        `);

        // 4. Clear the staging table start date so it does not process again tomorrow
        const clearReq = new mssql.Request(transaction);
        table.keys.forEach(k => {
          clearReq.input(cleanParamName(k), mssql.NVarChar, row[k] || null);
        });

        await clearReq.query(`
          UPDATE ${stgTableName} 
          SET [Schedule_Effective_From] = NULL, [Updated_At] = NULL
          WHERE ${whereClause}
        `);
      }
    }

    await transaction.commit();
    console.log("Daily scheduled sync processed and updated cleanly.");
  } catch (err) {
    // Only attempt rollback if the transaction was successfully started
    if (transaction && transaction._begun) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }
    console.error("Daily scheduled sync run failed:", err);
    throw err; // Re-throw to propagate to the cron retry handler
  }
}

// Runs every night at 12:05 AM America/Toronto time
cron.schedule("5 0 * * *", async () => {
  console.log("Running daily automatic setup target execution matches...");
  
  const maxCronRetries = 3;
  for (let attempt = 1; attempt <= maxCronRetries; attempt++) {
    try {
      await processDailyScheduledSync();
      break; // Exit loop on success
    } catch (err) {
      console.error(`Daily scheduled sync failed on attempt ${attempt}/${maxCronRetries}.`);
      if (attempt < maxCronRetries) {
        console.log("Waiting 30 seconds before retrying entire sync job...");
        await new Promise(res => setTimeout(res, 30000));
      } else {
        console.error("CRITICAL: Daily scheduled sync completely failed after max retries.");
      }
    }
  }
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { processDailyScheduledSync };