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
// async function getCategorizedSalesData(csoCode, startDate, endDate) {
//   try {
//     await sql.connect(sqlConfig);
//     // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
//     const result = await sql.query(`
//       SELECT
//         s.[Date],
//         SUM(
//           CASE 
//             WHEN i.[Category] IN ('Chew FN', 'Cigarettes FN', 'Cigars FN') 
//             THEN s.[Total Sales] 
//             ELSE 0 
//           END
//         ) AS [FN],
//         SUM(
//           CASE 
//             WHEN i.[Category] IN ('Chew Quota', 'Cigarettes Quota', 'Cigars Quota') 
//             THEN s.[Total Sales] 
//             ELSE 0 
//           END
//         ) AS [Quota],
//         SUM(
//           CASE 
//             WHEN i.[Category] IN (
//               'Cannabis Vapes', 'Cannabis Flower', 'Cannabis Pre Rolls', 
//               'Cannabis Concentrates', 'Cannabis Others', 'Cannabis Edibles'
//             ) 
//             THEN s.[Total Sales] 
//             ELSE 0 
//           END
//         ) AS [Cannabis],
//         SUM(
//           CASE 
//             WHEN i.[Category] = 'Cigarettes GRE'
//             THEN s.[Total Sales]
//             ELSE 0
//           END
//         ) AS [GRE],
//         SUM(
//           CASE 
//             WHEN i.[Category] NOT IN (
//               'Chew FN', 'Cigarettes FN', 'Cigars FN',
//               'Chew Quota', 'Cigarettes Quota', 'Cigars Quota',
//               'Cannabis Vapes', 'Cannabis Flower', 'Cannabis Pre Rolls', 
//               'Cannabis Concentrates', 'Cannabis Others',
//               'Cigarettes GRE'
//             ) OR i.[Category] IS NULL
//             THEN s.[Total Sales]
//             ELSE 0
//           END
//         ) AS [Convenience],
//         SUM(s.[Total Sales]) AS [Total_Sales]
//       FROM [CSO].[Sales] s
//       LEFT JOIN [CSO].[ItemBookCSO] i
//         ON s.[UPC] = i.[UPC]
//       WHERE
//         s.[Station_Code] = ${csoCode}
//         AND s.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       GROUP BY s.[Date]
//       ORDER BY s.[Date]
//     `);
//     await sql.close();
//     return result.recordset;
//   } catch (err) {
//     console.error('SQL error:', err);
//     return [];
//   }
// }
async function getCategorizedSalesData(pool, csoCode, startDate, endDate) {
  try {
    // await sql.connect(sqlConfig);
    // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
    // const result = await sql.query(`
    const result = await pool.request().query(`
      SELECT
        s.[Date_SK],s.[FN],s.[Quota],s.[Cannabis],s.[GRE],s.[Vapes],s.[Native Gifts],s.[Convenience],s.[Bistro],s.[Total_Sales]
      FROM [CSO].[TotalSales] s
      WHERE
        s.[Station_SK] = ${csoCode}
        AND s.[Date_SK] BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY s.[Date_SK]
    `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getGradeVolumeFuelData(pool, csoCode, startDate, endDate) {
  try {
    // await sql.connect(sqlConfig);
    // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
    // const result = await sql.query(`
    const result = await pool.request().query(`
      SELECT s.[Station_SK], s.[businessDate], s.[fuelGradeID], s.[fuelGradeSalesVolume], s.[fuelGradeDescription]
      FROM [CSO].[Fuel] s
      WHERE
        s.[Station_SK] = ${csoCode}
        AND s.[businessDate] BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY s.[businessDate]
    `);
    // const dbStartDate = formatDateForDB(startDate);
    // const dbEndDate = formatDateForDB(endDate);
    // const result = await pool.request().query(`
    //   SELECT s.[Station_SK], s.[Date_SK], s.[FuelGradeID], s.[Sales_Volume_LTR], s.[Description]
    //   FROM [CSO].[FuelSummary] s
    //   WHERE
    //     s.[Station_SK] = ${csoCode}
    //     AND s.[Date_SK] BETWEEN '${dbStartDate}' AND '${dbEndDate}'
    //   ORDER BY s.[Date_SK]
    // `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getCurrentInventory(site, limit = null) {
  try {
    // await sql.connect(sqlConfig);
    const pool = await getPool();
    let query = `
      SELECT ${limit ? `TOP ${limit}` : ''} [Item_Name]
            ,[UPC-A (12 digits)] AS 'UPC'
            ,[Category Name] as 'Category'
            ,[On Hand Qty]
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}'
    `;

    const result = await pool.request().query(query);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getInventoryCategories(site) {
  try {
    // await sql.connect(sqlConfig);
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT [Category Name] as 'Category'
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}'
        AND [Category Name] IS NOT NULL
      ORDER BY [Category Name]
    `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getBulkOnHandQtyCSO(site, upcs = []) {
  if (!upcs.length) return {};
  try {
    const pool = await getPool();
    const list = upcs.map(u => `'${u}'`).join(",");

    const query = `
      SELECT [UPC-A (12 digits)] AS UPC, [On Hand Qty] AS qty
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}' AND [UPC-A (12 digits)] IN (${list})
    `;

    const result = await pool.request().query(query);
    // Convert array → dictionary
    const data = {};
    for (const row of result.recordset) {
      data[row.UPC] = row.qty;
    }

    return data;
  } catch (err) {
    console.error("SQL error:", err);
    return {};
  }
}


// let pool;

// async function getPool() {
//   try {
//     if (!pool) {
//       console.log("🔌 Creating new SQL connection pool...");
//       pool = await sql.connect({
//         server: process.env.SQL_SERVER,
//         database: process.env.SQL_DB,
//         user: process.env.SQL_USER,
//         password: process.env.SQL_PASSWORD,
//         pool: {
//           max: 20,           // increase max connections
//           min: 0,
//           idleTimeoutMillis: 30000,
//           acquireTimeoutMillis: 60000, // wait longer before abort
//         },
//         options: {
//           encrypt: true,
//           trustServerCertificate: false,
//         },
//       });

//       // Optional: log when pool is closed
//       pool.on('error', err => {
//         console.error("SQL Pool Error:", err);
//         pool = null; // force reconnect next time
//       });
//     }

//     // 🔍 Check if pool is still healthy
//     if (!pool.connected) {
//       console.warn("SQL pool was disconnected — reconnecting...");
//       pool = await sql.connect(pool.config);
//     }

//     return pool;
//   } catch (err) {
//     console.error("Failed to get SQL pool:", err);
//     pool = null;
//     throw err;
//   }
// }

let pool = null;

async function getPool() {
  try {
    if (!pool || !pool.connected) {
      if (pool) {
        try { await pool.close(); } catch { }
      }

      console.log("🔌 Creating new SQL connection pool...");
      pool = await sql.connect({
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DB,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        pool: {
          max: 50, // increase if VPS can handle it
          min: 0,
          idleTimeoutMillis: 60000, // more time for idle connections
          acquireTimeoutMillis: 300000, // more time to acquire heavy queries
        },
        options: {
          encrypt: true,
          trustServerCertificate: false,
        },
      });

      pool.on("error", (err) => {
        console.error("SQL Pool Error:", err);
        pool = null; // force reconnect next time
      });
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
      "SELECT [UPC-A (12 digits)] as 'UPC_barcode', [UPC] FROM [CSO].[ItemBookCSO] WHERE [GTIN] = @gtin",
      { timeout: 30000 } // 30 seconds
    );
    return result.recordset;
  } catch (err) {
    console.error("SQL error for", gtin, ":", err);
    return [];
  }
}

// ---------------- SQL FUNCTION ----------------
// /**
//  * Fetch category names from SQL for given GTINs
//  * @param {string[]} gtins 
//  * @returns {Promise<Object>} Map of gtin => category_name
//  */
async function getCategoriesFromSQL(gtins) {
  if (!gtins || !gtins.length) return {};

  const pool = await getPool();
  const categoryMap = {};

  // Create parameter placeholders for the batch
  const params = gtins.map((_, idx) => `@p${idx}`).join(",");
  const sqlQuery = `
    SELECT [GTIN], [Category ID]
    FROM [CSO].[Master_Item]
    WHERE [GTIN] IN (${params}) AND [Inactive on Account] = 0
      AND [Category ID] != 0 AND [Category Name] IS NOT NULL
  `;

  const request = pool.request();
  gtins.forEach((gtin, idx) => request.input(`p${idx}`, gtin));

  try {
    const result = await request.query(sqlQuery);
    result.recordset.forEach(row => {
      const gtinKey = String(row.GTIN).trim();
      if (gtinKey && row["Category ID"] != null) {
        categoryMap[gtinKey] = row["Category ID"];
      }
    });
  } catch (err) {
    console.error("SQL query error", err);
  }

  return categoryMap;
}


async function getCategoryNumbersFromSQL() {
  const pool = await getPool();

  try {
    const sql = `
      SELECT DISTINCT [Category ID],[Category Name]
      FROM [CSO].[Master_Item]
      WHERE [Category Name] IS NOT NULL AND [Category ID] IS NOT NULL
      ORDER BY [Category ID]
    `;
    const request = pool.request();
    const result = await request.query(sql);
    return result;
  } catch (err) {
    console.error("SQL error:", err);
    return { recordset: [] };
  }
}


async function getFuelInventoryReportPreviousDay() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT [Date],[Station_Name],[Fuel_Grade],[Stick_L]
      FROM [CSO].[FuelInventory]
      WHERE [Date] = CAST(GETDATE() - 1 AS date)
    `);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getFuelInventoryReportCurrentDay() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT [Station_SK], [Fuel_Grade], [Volume] as 'Stick_L'
      FROM [CSO].[CurrentFuelInv]
      WHERE [Date_SK]=TRY_CONVERT(CHAR(8),GETDATE(),112)
    `);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

/**
 * Fetch GTIN -> UPC list for items marked inactive on account.
 * @param {string[]} gtins
 * @returns {Promise<Object>} mapping: { gtin: [upc1, upc2, ...], ... }
 */
async function getInactiveMasterItems(gtins = []) {
  if (!gtins || !gtins.length) return {};
  const pool = await getPool();
  const params = gtins.map((_, idx) => `@p${idx}`).join(',');
  const sqlQuery = `
    SELECT DISTINCT [GTIN], [UPC]
    FROM [CSO].[Master_Item]
    WHERE [Inactive on Account] = 1
      AND [GTIN] IN (${params})
  `;
  const request = pool.request();
  gtins.forEach((g, idx) => request.input(`p${idx}`, g));
  const mapping = {};
  try {
    const result = await request.query(sqlQuery);
    for (const row of result.recordset || []) {
      const gtin = String(row.GTIN || '').trim();
      const upc = row.UPC != null ? String(row.UPC).trim() : null;
      if (!gtin) continue;
      if (!mapping[gtin]) mapping[gtin] = [];
      if (upc) mapping[gtin].push(upc);
    }
  } catch (err) {
    console.error('SQL error in getInactiveMasterItems:', err);
  }
  return mapping;
}

/**
 * Get On_hand value from [CSO].[Inventory Balance] for a UPC and station, filtered to yesterday.
 * Uses LIKE '%upc%' to match (per existing usage).
 * @param {string} upc
 * @param {string} stationSk
 * @returns {Promise<number|null>} On_hand number or null if not found
 */
async function getInventoryOnHandForUPCAndStation(upc, stationSk) {
  if (!upc || !stationSk) return null;
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('upc', sql.VarChar, `%${upc}%`);
    request.input('stationSk', sql.VarChar, stationSk);
    const q = `
      SELECT TOP (1) [On_hand]
      FROM [CSO].[Inventory Balance]
      WHERE [UPC] LIKE @upc
        AND [Station_SK] = @stationSk
        AND [Date] = CAST(GETDATE() - 1 AS date)
      ORDER BY [On_hand] DESC  
    `;
    const result = await request.query(q);
    if (result && result.recordset && result.recordset.length) {
      const v = result.recordset[0].On_hand;
      return (v != null) ? Number(v) : null;
    }
    return null;
  } catch (err) {
    console.error('SQL error in getInventoryOnHandForUPCAndStation:', err);
    return null;
  }
}

/**
/**
 * Get On_hand values from [CSO].[Inventory Balance] for multiple UPCs and a station for yesterday.
 * Returns a map: { upc: onHandValue | null }
 * Uses IN for exact match (batch processing).
 * @param {string[]} upcs
 * @param {string} stationSk
 * @returns {Promise<Record<string, number|null>>} 
 */
async function getInventoryOnHandForActiveUPCsAndStation(upcs = [], stationSk) {
  if (!upcs.length || !stationSk) return {};

  try {
    const pool = await getPool();
    const request = pool.request();

    // Prepare dynamic parameters for IN clause
    const params = upcs.map((_, idx) => `@p${idx}`).join(', ');
    upcs.forEach((upc, idx) => request.input(`p${idx}`, sql.VarChar, upc));
    request.input('stationSk', sql.VarChar, stationSk);

    const query = `
      SELECT UPC, MAX(On_hand) AS On_hand
      FROM [CSO].[Inventory Balance]
      WHERE Station_SK = @stationSk
        AND Date = CAST(GETDATE() - 1 AS date)
        AND UPC IN (${params})
      GROUP BY UPC
    `;

    const result = await request.query(query);

    const mapping = {};
    // Initialize all UPCs as null
    upcs.forEach((u) => { mapping[u] = null; });

    for (const row of result.recordset || []) {
      const upc = String(row.UPC || '').trim();
      const onHand = row.On_hand != null ? Number(row.On_hand) : null;
      if (upc) mapping[upc] = onHand;
    }

    return mapping;
  } catch (err) {
    console.error('SQL error in getInventoryOnHandForUPCsAndStation (bulk IN):', err);
    return upcs.reduce((acc, u) => ({ ...acc, [u]: null }), {});
  }
}

async function retry(fn, retries = 2, delay = 250) {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay);
  }
}

async function getAllPeriodData(pool, csoCode, startDate, endDate) {
  try {
    // Time period transactions
    const dbStartDate = formatDateForDB(startDate);
    const dbEndDate = formatDateForDB(endDate);
    const timePeriodResult = await pool.request()
      .input("csoCode", sql.Int, csoCode)
      .input("startDate", sql.VarChar, dbStartDate) // use converted string
      .input("endDate", sql.VarChar, dbEndDate)
      .query(`
        SELECT a.[Date_SK], a.[Hour] AS hours, a.[Type] AS transaction_type, 
          a.[Count of Transaction ID] AS transaction_count
        FROM [CSO].[TransactionCountByHour] a
        WHERE a.[Station_SK] = @csoCode
          AND a.[Date_SK] BETWEEN @startDate AND @endDate
        ORDER BY a.[Date_SK];
      `);
    const timePeriodResultTransformed = transformTimePeriodData(timePeriodResult.recordset)
    // console.log(timePeriodResultTransformed)
    return {
      timePeriodTransactions: timePeriodResultTransformed ?? [],
    };

  } catch (err) {
    console.error("❌ SQL error in getAllTransactionsData:", err);
    return {
      // transactions: [],
      timePeriodTransactions: [],
      // tenderTransactions: [],
    };
  }
}
async function getAllTendorData(pool, csoCode, startDate, endDate) {
  try {
    // // Tender transactions
    const tenderResult = await pool.request()
      .input("csoCode", sql.Int, csoCode)
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate)
      .query(`
        SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
               a.[Number of Transaction ID] AS transactions, a.[Tender Code] AS tender
        FROM [CSO].[Daily Trans by Tender View] a
        WHERE a.[Station_SK] = @csoCode
          AND a.[Date] BETWEEN @startDate AND @endDate
        ORDER BY a.[Date];
      `);

    return {
      tenderTransactions: tenderResult.recordset ?? [],
    };

  } catch (err) {
    console.error("❌ SQL error in getAllTransactionsData:", err);
    return {
      tenderTransactions: [],
    };
  }
}
async function getAllTransactionsData(pool, csoCode, startDate, endDate) {
  try {
    // Original transactions
    const transactionsResult = await pool.request()
      .input("csoCode", sql.Int, csoCode)
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate)
      .query(`
        SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
               a.[Number of Transaction ID] AS transactions, b.[Avg Bucket] AS bucket_size
        FROM [CSO].[Daily Trans and Acct ID Traffic View] a
        LEFT JOIN [CSO].[Avg Bucket] b
          ON a.[Station_SK] = b.[Station_SK] 
         AND a.[Date] = b.[Date]
        WHERE a.[Station_SK] = @csoCode
          AND a.[Date] BETWEEN @startDate AND @endDate
        ORDER BY a.[Date];
      `);

    return {
      transactions: transactionsResult.recordset ?? [],
    };

  } catch (err) {
    console.error("❌ SQL error in getAllTransactionsData:", err);
    return {
      transactions: [],
    };
  }
}

async function getWeeklyBistroSales(pool,csoCode) {
  try {
    // await sql.connect(sqlConfig);
    // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
    // const result = await sql.query(`
    // const pool = await getPool();
    const result = await pool.request()
    .input("csoCode", sql.Int, csoCode)
    .query(`
      SELECT *
      FROM [CSO].[BistroSales]
      WHERE [Station_Code] = @csoCode
      ORDER BY [WeekStart]
    `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getTop10Bistro(pool,csoCode) {
  try {
    // await sql.connect(sqlConfig);
    // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
    // const result = await sql.query(`
    // const pool = await getPool();
    const result = await pool.request()
    .input("csoCode", sql.Int, csoCode)
    .query(`
      DECLARE @EndDate DATE = CAST(GETDATE() - 1 AS DATE);
      DECLARE @StartDate DATE = DATEADD(DAY, -30, @EndDate);

      SELECT TOP 10
          s.Station_Code,
          item.[Item Description] as Item,
          SUM(s.[QTY]) AS UnitsSold,
          SUM(s.[Total Sales]) AS TotalSales,
          CAST(SUM(s.[QTY]) / 7.0 AS DECIMAL(10,2)) AS UnitsPerDay
      FROM [CSO].[Sales] s
      JOIN [CSO].[ItemBookCSO] item
          ON s.[Item_BK] = item.[Item_BK]
      WHERE item.[Cat #] IN (130, 134)
        AND s.[Station_Code] = @csoCode
        AND CAST(s.[Date] AS DATE) BETWEEN @StartDate AND @EndDate
      GROUP BY
          s.Station_Code,
          item.[Item Description]
      ORDER BY
          UnitsSold DESC;
    `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

function formatDateForDB(dateString) {
  // input: "2025-11-14"
  // output: "20251114"
  return dateString.replace(/-/g, "");
}

function transformTimePeriodData(data) {
  const normalizeHour = (hourStr) => {
    if (!hourStr) return hourStr;

    if (hourStr.toLowerCase().includes("before")) return "05:00";

    const match = hourStr.match(/^(\d{1,2}:\d{2})/);
    return match ? match[1] : hourStr;
  };

  const transformed = data.map((row) => ({
    ...row,
    hours: normalizeHour(row.hours)
  }));

  // Sort by date then by hour
  transformed.sort((a, b) => {
    if (a.Date_SK !== b.Date_SK) {
      return a.Date_SK.localeCompare(b.Date_SK);
    }
    return a.hours.localeCompare(b.hours);
  });

  return transformed;
}

async function getAllSQLData(csoCode, dates) {
  const pool = await getPool();

  const {
    salesStart, salesEnd,
    fuelStart, fuelEnd,
    transStart, transEnd,
  } = dates;

  const results = await Promise.allSettled([
    retry(() => getCategorizedSalesData(pool, csoCode, salesStart, salesEnd)),
    retry(() => getGradeVolumeFuelData(pool, csoCode, fuelStart, fuelEnd)),
    retry(() => getAllTransactionsData(pool, csoCode, transStart, transEnd)),
    retry(() => getAllPeriodData(pool, csoCode, transStart, transEnd)), // unified
    retry(() => getAllTendorData(pool, csoCode, transStart, transEnd)),
    retry(() => getWeeklyBistroSales(pool, csoCode)),
    retry(() => getTop10Bistro(pool, csoCode)),
  ]);

  return {
    sales: results[0].status === "fulfilled" ? results[0].value : [],
    fuel: results[1].status === "fulfilled" ? results[1].value : [],
    transactions: results[2].status === "fulfilled" ? results[2].value.transactions : [],
    timePeriodTransactions: results[3].status === "fulfilled" ? results[3].value.timePeriodTransactions : [],
    tenderTransactions: results[4].status === "fulfilled" ? results[4].value.tenderTransactions : [],
    bistroWoWSales: results[5].status === "fulfilled" ? results[5].value : [],
    top10Bistro: results[6].status === "fulfilled" ? results[6].value : [],
  };
}

module.exports = {
  sqlConfig,
  getUPC_barcode,
  getCurrentInventory,
  getInventoryCategories,
  getAllSQLData,
  getBulkOnHandQtyCSO,
  getFuelInventoryReportPreviousDay,
  getFuelInventoryReportCurrentDay,
  getCategoriesFromSQL,
  getCategoryNumbersFromSQL,
  getInactiveMasterItems,
  getInventoryOnHandForUPCAndStation,
  getWeeklyBistroSales,
  getTop10Bistro,
  getInventoryOnHandForActiveUPCsAndStation,
  getPool,
};