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
        s.[Date_SK],s.[FN],s.[Quota],s.[Cannabis],s.[GRE],s.[Vapes],s.[Native Gifts],s.[Convenience],s.[Total_Sales]
      FROM [CSO].[TotalSales] s
      WHERE
        s.[Station_SK] = ${csoCode}
        AND s.[Date_SK] BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY s.[Date_SK]
    `);
    await sql.close();
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
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

// async function getTransTimePeriodData(pool, csoCode, startDate, endDate) {
//   try {
//     // await sql.connect(sqlConfig);
//     // // const result = await sql.query(`SELECT TOP (10) * from [CSO].[Sales]`);
//     // const result = await sql.query(`
//     const result = await pool.request().query(`
//       select a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] as 'visits', 
//         a.[Number of Transaction ID] as 'transactions', b.[Avg Bucket] as 'bucket_size' 
//       from [CSO].[Daily Trans and Acct ID Traffic View] a join [CSO].[Avg Bucket] b
//       on a.[Station_SK] =  b.[Station_SK] AND a.[Date] = b.[Date] 
//       where a.[Station_SK] = ${csoCode} and a.[Date] between '${startDate}' AND '${endDate}'
//     `);
//     await sql.close();
//     return result.recordset;
//   } catch (err) {
//     console.error('SQL error:', err);
//     return [];
//   }
// }
// async function getAllTransactionsData(csoCode, startDate, endDate) {
//   try {
//     const pool = await getPool(); // get healthy pool

//     // 1️⃣ Transactions
//     const transactionsResult = await retry(() => pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, b.[Avg Bucket] AS bucket_size
//       FROM [CSO].[Daily Trans and Acct ID Traffic View] a
//       JOIN [CSO].[Avg Bucket] b
//       ON a.[Station_SK] = b.[Station_SK] AND a.[Date] = b.[Date]
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `));

//     // 2️⃣ Time period transactions
//     const timePeriodResult = await retry(() => pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, a.[Time Period] as timePeriod 
//       FROM [CSO].[Daily Trans by Time Period View] a
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `));

//     // 3️⃣ Tender transactions
//     const tenderResult = await retry(() => pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, a.[Tender Code] as tender
//       FROM [CSO].[Daily Trans by Tender View] a
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `));

//     return {
//       transactions: transactionsResult.recordset ?? [],
//       timePeriodTransactions: timePeriodResult.recordset ?? [],
//       tenderTransactions: tenderResult.recordset ?? [],
//     };
//   } catch (err) {
//     console.error("❌ SQL error fetching transactions:", err);
//     return {
//       transactions: [],
//       timePeriodTransactions: [],
//       tenderTransactions: [],
//     };
//   }
// }

// 1️⃣ Original transactions
// async function getTransactions(pool, csoCode, startDate, endDate) {
//   try {
//     const result = await pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, b.[Avg Bucket] AS bucket_size
//       FROM [CSO].[Daily Trans and Acct ID Traffic View] a
//       JOIN [CSO].[Avg Bucket] b
//       ON a.[Station_SK] = b.[Station_SK] AND a.[Date] = b.[Date]
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `);
//     return result.recordset ?? [];
//   } catch (err) {
//     console.error("❌ SQL error fetching transactions:", err);
//     return [];
//   }
// }

// // 2️⃣ Time period transactions
// async function getTimePeriodTransactions(pool, csoCode, startDate, endDate) {
//   try {
//     const result = await pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, a.[Time Period] AS timePeriod
//       FROM [CSO].[Daily Trans by Time Period View] a
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `);
//     return result.recordset ?? [];
//   } catch (err) {
//     console.error("❌ SQL error fetching time period transactions:", err);
//     return [];
//   }
// }

// // 3️⃣ Tender transactions
// async function getTenderTransactions(pool, csoCode, startDate, endDate) {
//   try {
//     const result = await pool.request().query(`
//       SELECT a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//              a.[Number of Transaction ID] AS transactions, a.[Tender Code] AS tender
//       FROM [CSO].[Daily Trans by Tender View] a
//       WHERE a.[Station_SK] = ${csoCode} AND a.[Date] BETWEEN '${startDate}' AND '${endDate}'
//       ORDER BY a.[Date]
//     `);
//     return result.recordset ?? [];
//   } catch (err) {
//     console.error("❌ SQL error fetching tender transactions:", err);
//     return [];
//   }
// }

async function getCurrentInventory(site, limit = null) {
  try {
    await sql.connect(sqlConfig);

    let query = `
      SELECT ${limit ? `TOP ${limit}` : ''} [Item_Name]
            ,[UPC_A_12_digits] AS 'UPC'
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
          max: 20,
          min: 0,
          idleTimeoutMillis: 30000,
          acquireTimeoutMillis: 60000,
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
      "SELECT [UPC_A_12_digits], [UPC] FROM [CSO].[ItemBookCSO] WHERE [GTIN] = @gtin",
      { timeout: 30000 } // 30 seconds
    );
    return result.recordset;
  } catch (err) {
    console.error("SQL error for", gtin, ":", err);
    return [];
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

// async function getAllSQLData(csoCode, dates) {
//   const pool = await getPool();

//   const {
//     salesStart, salesEnd,
//     fuelStart, fuelEnd,
//     transStart, transEnd,
//   } = dates;

//   const results = await Promise.allSettled([
//     retry(() => getCategorizedSalesData(pool, csoCode, salesStart, salesEnd)),
//     retry(() => getGradeVolumeFuelData(pool, csoCode, fuelStart, fuelEnd)),
//     retry(() => getAllTransactionsData(pool, csoCode, transStart, transEnd)),
//   ]);

//   return {
//     sales: results[0].status === "fulfilled" ? results[0].value : [],
//     fuel: results[1].status === "fulfilled" ? results[1].value : [],
//     transactions: results[2].status === "fulfilled" ? results[2].value.transactions : [],
//     timePeriodTransactions: results[2].status === "fulfilled" ? results[2].value.timePeriodTransactions : [],
//     tenderTransactions: results[2].status === "fulfilled" ? results[2].value.tenderTransactions : [],
//   };
// }

// async function getAllTransactionsData(pool, csoCode, startDate, endDate) {
//   try {
//     const result = await pool.request()
//       .input("csoCode", sql.Int, csoCode)
//       .input("startDate", sql.Date, startDate)
//       .input("endDate", sql.Date, endDate)
//       .query(`
//         -- Original transactions
//         SELECT 
//           a.[Station_SK], 
//           a.[Date], 
//           a.[Number of Customer Acct ID] AS visits,
//           a.[Number of Transaction ID] AS transactions, 
//           b.[Avg Bucket] AS bucket_size
//         FROM [CSO].[Daily Trans and Acct ID Traffic View] a
//         JOIN [CSO].[Avg Bucket] b
//           ON a.[Station_SK] = b.[Station_SK] 
//          AND a.[Date] = b.[Date]
//         WHERE a.[Station_SK] = @csoCode
//           AND a.[Date] BETWEEN @startDate AND @endDate
//         ORDER BY a.[Date];

//         -- Time period transactions
//         SELECT 
//           a.[Station_SK], 
//           a.[Date], 
//           a.[Number of Customer Acct ID] AS visits,
//           a.[Number of Transaction ID] AS transactions, 
//           a.[Time Period] AS timePeriod
//         FROM [CSO].[Daily Trans by Time Period View] a
//         WHERE a.[Station_SK] = @csoCode
//           AND a.[Date] BETWEEN @startDate AND @endDate
//         ORDER BY a.[Date];

//         -- Tender transactions
//         SELECT 
//           a.[Station_SK], 
//           a.[Date], 
//           a.[Number of Customer Acct ID] AS visits,
//           a.[Number of Transaction ID] AS transactions, 
//           a.[Tender Code] AS tender
//         FROM [CSO].[Daily Trans by Tender View] a
//         WHERE a.[Station_SK] = @csoCode
//           AND a.[Date] BETWEEN @startDate AND @endDate
//         ORDER BY a.[Date];
//       `);

//     return {
//       transactions: result.recordsets[0] ?? [],
//       timePeriodTransactions: result.recordsets[1] ?? [],
//       tenderTransactions: result.recordsets[2] ?? [],
//     };

//   } catch (err) {
//     console.error("❌ SQL error in getAllTransactionsData:", err);
//     return {
//       transactions: [],
//       timePeriodTransactions: [],
//       tenderTransactions: [],
//     };
//   }
// }
// async function getAllTransactionsData(pool, csoCode, startDate, endDate) {
//   try {
//     const [transactionsResult, timePeriodResult, tenderResult] = await Promise.all([
//       pool.request()
//         .input("csoCode", sql.Int, csoCode)
//         .input("startDate", sql.Date, startDate)
//         .input("endDate", sql.Date, endDate)
//         .query(`
//           SELECT 
//             a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//             a.[Number of Transaction ID] AS transactions, b.[Avg Bucket] AS bucket_size
//           FROM [CSO].[Daily Trans and Acct ID Traffic View] a
//           LEFT JOIN [CSO].[Avg Bucket] b
//             ON a.[Station_SK] = b.[Station_SK] AND a.[Date] = b.[Date]
//           WHERE a.[Station_SK] = @csoCode
//             AND a.[Date] BETWEEN @startDate AND @endDate
//           ORDER BY a.[Date];
//         `),

//       pool.request()
//         .input("csoCode", sql.Int, csoCode)
//         .input("startDate", sql.Date, startDate)
//         .input("endDate", sql.Date, endDate)
//         .query(`
//           SELECT 
//             a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//             a.[Number of Transaction ID] AS transactions, a.[Time Period] AS timePeriod
//           FROM [CSO].[Daily Trans by Time Period View] a
//           WHERE a.[Station_SK] = @csoCode
//             AND a.[Date] BETWEEN @startDate AND @endDate
//           ORDER BY a.[Date];
//         `),

//       pool.request()
//         .input("csoCode", sql.Int, csoCode)
//         .input("startDate", sql.Date, startDate)
//         .input("endDate", sql.Date, endDate)
//         .query(`
//           SELECT 
//             a.[Station_SK], a.[Date], a.[Number of Customer Acct ID] AS visits,
//             a.[Number of Transaction ID] AS transactions, a.[Tender Code] AS tender
//           FROM [CSO].[Daily Trans by Tender View] a
//           WHERE a.[Station_SK] = @csoCode
//             AND a.[Date] BETWEEN @startDate AND @endDate
//           ORDER BY a.[Date];
//         `),
//     ]);

//     return {
//       transactions: transactionsResult.recordset ?? [],
//       timePeriodTransactions: timePeriodResult.recordset ?? [],
//       tenderTransactions: tenderResult.recordset ?? [],
//     };

//   } catch (err) {
//     console.error("❌ SQL error in getAllTransactionsData:", err);
//     return {
//       transactions: [],
//       timePeriodTransactions: [],
//       tenderTransactions: [],
//     };
//   }
// }
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
      // transactions: transactionsResult.recordset ?? [],
      // timePeriodTransactions: timePeriodResult.recordset ?? [],
      tenderTransactions: tenderResult.recordset ?? [],
    };

  } catch (err) {
    console.error("❌ SQL error in getAllTransactionsData:", err);
    return {
      // transactions: [],
      // timePeriodTransactions: [],
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
      // timePeriodTransactions: timePeriodResult.recordset ?? [],
      // tenderTransactions: tenderResult.recordset ?? [],
    };

  } catch (err) {
    console.error("❌ SQL error in getAllTransactionsData:", err);
    return {
      transactions: [],
    };
  }
}

function formatDateForDB(dateString) {
  // input: "2025-11-14"
  // output: "20251114"
  return dateString.replace(/-/g, "");
}

// function transformTimePeriodData(data) {
//   const normalizeHour = (hourStr) => {
//     if (hourStr.toLowerCase().includes("before")) return "05:00"
//     const match = hourStr.match(/^(\d{1,2}:\d{2})/)
//     return match ? match[1] : hourStr
//   }

//   const map = {} // key: `${Date_SK}-${hour}`, value: { Fuel: x, "C-Store": y }
//   const bothRows = []

//   data.forEach((row) => {
//     const hour = normalizeHour(row.hours)

//     if (row.transaction_type.toLowerCase() === "both") {
//       bothRows.push({ ...row, hours: hour })
//       return
//     }

//     const key = `${row.Date_SK}-${hour}`
//     if (!map[key]) map[key] = {}
//     map[key][row.transaction_type] = (map[key][row.transaction_type] || 0) + row.transaction_count
//   })

//   bothRows.forEach((row) => {
//     const key = `${row.Date_SK}-${row.hours}`
//     if (!map[key]) map[key] = {}
//     map[key]["Fuel"] = (map[key]["Fuel"] || 0) + row.transaction_count
//     map[key]["C-Store"] = (map[key]["C-Store"] || 0) + row.transaction_count
//   })

//   const result = []
//   Object.entries(map).forEach(([key, types]) => {
//     const [Date_SK, hour] = key.split("-")
//     Object.entries(types).forEach(([transaction_type, transaction_count]) => {
//       result.push({ Date_SK, hours: hour, transaction_type, transaction_count })
//     })
//   })

//   // Sort by date and hour
//   result.sort((a, b) => {
//     if (a.Date_SK !== b.Date_SK) return a.Date_SK.localeCompare(b.Date_SK)
//     return a.hours.localeCompare(b.hours)
//   })

//   return result
// }

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

// async function getAllSQLData(csoCode, dates) {
//   const pool = await getPool();

//   const {
//     salesStart, salesEnd,
//     fuelStart, fuelEnd,
//     transStart, transEnd,
//   } = dates;

//   // Fetch sales and fuel in parallel (lightweight queries)
//   const results = await Promise.allSettled([
//     retry(() => getCategorizedSalesData(pool, csoCode, salesStart, salesEnd)),
//     retry(() => getGradeVolumeFuelData(pool, csoCode, fuelStart, fuelEnd)),
//     retry(() => getTransactions(pool, csoCode, transStart, transEnd)),
//     retry(() => getTimePeriodTransactions(pool, csoCode, transStart, transEnd)),
//     retry(() => getTenderTransactions(pool, csoCode, transStart, transEnd))
//   ]);

//   // Fetch transactions sequentially to avoid pool conflicts
//   // const transactions = await retry(() => getTransactions(pool, csoCode, transStart, transEnd));
//   // const timePeriodTransactions = await retry(() => getTimePeriodTransactions(pool, csoCode, transStart, transEnd));
//   // const tenderTransactions = await retry(() => getTenderTransactions(pool, csoCode, transStart, transEnd));

//   return {
//     sales: results[0].status === "fulfilled" ? results[0].value : [],
//     fuel: results[1].status === "fulfilled" ? results[1].value : [],
//     transactions: results[2].status === "fulfilled" ? results[2].value : [],
//     timePeriodTransactions: results[3].status === "fulfilled" ? results[3].value : [],
//     tenderTransactions: results[4].status === "fulfilled" ? results[4].value : [],
//   };
// }
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
  ]);

  return {
    sales: results[0].status === "fulfilled" ? results[0].value : [],
    fuel: results[1].status === "fulfilled" ? results[1].value : [],
    transactions: results[2].status === "fulfilled" ? results[2].value.transactions : [],
    timePeriodTransactions: results[3].status === "fulfilled" ? results[3].value.timePeriodTransactions : [],
    tenderTransactions: results[4].status === "fulfilled" ? results[4].value.tenderTransactions : [],
  };
}

module.exports = {
  sqlConfig,
  getUPC_barcode,
  getCurrentInventory,
  getInventoryCategories,
  getAllSQLData,
};