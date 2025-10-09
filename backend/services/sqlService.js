require('dotenv').config();

const sql = require('mssql');

const sqlConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DB,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true }
};

// const sqlConfig = {
//   user: process.env.SQL_USER,
//   password: process.env.SQL_PASSWORD,
//   database: process.env.SQL_DATABASE,
//   server: process.env.SQL_SERVER,
  // pool: {
  //   max: 10,
  //   min: 0,
  //   idleTimeoutMillis: 30000
  // },
  // options: {
  //   encrypt: true, // required for Azure
  //   trustServerCertificate: false
  // },
  // connectionTimeout: 30000, // 30s connect timeout
  // requestTimeout: 30000     // 30s query timeout
// };

// Function to get sales data from CSO.Sales table
async function getSalesData(csoCode, startDate, endDate) {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`SELECT [Date], SUM([Total Sales]) as [Total Sales]
                                    FROM CSO.Sales
                                    WHERE Station_Code=${csoCode}
                                    AND [Date] BETWEEN '${startDate}' AND '${endDate}'
                                    GROUP BY [Date]
                                    ORDER BY [Date]`);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

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

// Function to get UPC and UPC_barcode from CSO.Itembook table
async function getUPC_barcode(gtin) {
  try {
    await sql.connect(sqlConfig);
    const result = await sql.query(`SELECT [UPC_A_12_digits], [UPC] FROM [CSO].[ItemBookCSO] where [GTIN] = '${gtin}'`);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

// Singleton pool
// let poolPromise;
// function getPool() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(sqlConfig);
//   }
//   return poolPromise;
// }

// async function getUPC_barcode(gtin) {
//   try {
//     const pool = await getPool();
//     const result = await pool.request()
//       .input("gtin", sql.VarChar, gtin)
//       .query("SELECT [UPC_A_12_digits], [UPC] FROM [CSO].[ItemBookCSO] WHERE [GTIN] = @gtin");
    
//     return result.recordset;
//   } catch (err) {
//     console.error("SQL error:", err);
//     return [];
//   }
// }

//catch and retry twice
// async function getUPC_barcode(gtin, retries = 2) {
//   try {
//     const pool = await getPool();
//     const result = await pool.request()
//       .input("gtin", sql.VarChar, gtin)
//       .query("SELECT [UPC_A_12_digits], [UPC] FROM [CSO].[ItemBookCSO] WHERE [GTIN] = @gtin");
//     return result.recordset;
//   } catch (err) {
//     if (err.code === "ETIMEOUT" && retries > 0) {
//       console.warn("Retrying SQL call due to timeout...");
//       return getUPC_barcode(gtin, retries - 1);
//     }
//     console.error("SQL error:", err);
//     return [];
//   }
// }

module.exports = { sqlConfig, getSalesData, getCategorizedSalesData, getUPC_barcode };