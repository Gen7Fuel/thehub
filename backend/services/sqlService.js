require('dotenv').config();

const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DB,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true }
};

/**
 * Gets categorized sales data for a station and date range.
 * @param {number} csoCode 
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Promise<Array>} Array of daily categorized sales
 */
async function getCategorizedSalesData(csoCode, startDate, endDate) {
  try {
    await sql.connect(sqlConfig);
    // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
    const result = await sql.query(`
      SELECT
        s.[Date],
        SUM(
          CASE 
            WHEN i.[Category] IN ('Chew FN', 'Cigarettes FN', 'Cigars FN') 
            THEN s.[Total Sales] 
            ELSE 0 
          END
        ) AS [FN],
        SUM(
          CASE 
            WHEN i.[Category] IN ('Chew Quota', 'Cigarettes Quota', 'Cigars Quota') 
            THEN s.[Total Sales] 
            ELSE 0 
          END
        ) AS [Quota],
        SUM(
          CASE 
            WHEN i.[Category] IN (
              'Cannabis Vapes', 'Cannabis Flower', 'Cannabis Pre Rolls', 
              'Cannabis Concentrates', 'Cannabis Others', 'Cannabis Edibles'
            ) 
            THEN s.[Total Sales] 
            ELSE 0 
          END
        ) AS [Cannabis],
        SUM(
          CASE 
            WHEN i.[Category] = 'Cigarettes GRE'
            THEN s.[Total Sales]
            ELSE 0
          END
        ) AS [GRE],
        SUM(
          CASE 
            WHEN i.[Category] NOT IN (
              'Chew FN', 'Cigarettes FN', 'Cigars FN',
              'Chew Quota', 'Cigarettes Quota', 'Cigars Quota',
              'Cannabis Vapes', 'Cannabis Flower', 'Cannabis Pre Rolls', 
              'Cannabis Concentrates', 'Cannabis Others',
              'Cigarettes GRE'
            ) OR i.[Category] IS NULL
            THEN s.[Total Sales]
            ELSE 0
          END
        ) AS [Convenience],
        SUM(s.[Total Sales]) AS [Total_Sales]
      FROM [CSO].[Sales] s
      LEFT JOIN [CSO].[ItemBookCSO] i
        ON s.[UPC] = i.[UPC]
      WHERE
        s.[Station_Code] = ${csoCode}
        AND s.[Date] BETWEEN '${startDate}' AND '${endDate}'
      GROUP BY s.[Date]
      ORDER BY s.[Date]
    `);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getCurrentInventory(site, limit = null) {
  try {
    await sql.connect(sqlConfig);
    
    let query = `
      SELECT ${limit ? `TOP ${limit}` : ''} [Item_Name]
            ,[UPC]
            ,[Category]
            ,[On Hand Qty]
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}'
    `;
    
    const result = await sql.query(query);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getInventoryCategories(site) {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`
      SELECT DISTINCT [Category]
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}'
        AND [Category] IS NOT NULL
      ORDER BY [Category]
    `);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

let pool;

async function getPool() {
  try {
    if (!pool) {
      console.log("🔌 Creating new SQL connection pool...");
      pool = await sql.connect({
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DB,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
        options: {
          encrypt: true,
          trustServerCertificate: false,
        },
      });

      // Optional: log when pool is closed
      pool.on('error', err => {
        console.error("SQL Pool Error:", err);
        pool = null; // force reconnect next time
      });
    }

    // 🔍 Check if pool is still healthy
    if (!pool.connected) {
      console.warn("SQL pool was disconnected — reconnecting...");
      pool = await sql.connect(pool.config);
    }

    return pool;
  } catch (err) {
    console.error("Failed to get SQL pool:", err);
    pool = null;
    throw err;
  }
}

async function getUPC_barcode(gtin) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input("gtin", sql.VarChar, gtin);

    // ⏱ Timeout ensures long-running queries don't hang forever
    const result = await request.query(
      "SELECT [UPC_A_12_digits], [UPC] FROM [CSO].[ItemBookCSO] WHERE [GTIN] = @gtin",
      { timeout: 30000 } // 30 seconds
    );
    return result.recordset;
  } catch (err) {
    console.error("SQL error for",gtin,":", err);
    return [];
  }
}

module.exports = { 
  sqlConfig, 
  getCategorizedSalesData, 
  getUPC_barcode, 
  getCurrentInventory,
  getInventoryCategories
};