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
  const result = await pool.request().query(`
    SELECT
      s.[Date_SK],s.[FN],s.[Quota],s.[Cannabis],s.[GRE],s.[Vapes],s.[Native Gifts],s.[Convenience],s.[Bistro],s.[Total_Sales]
    FROM [CSO].[TotalSales] s
    WHERE
      s.[Station_SK] = ${csoCode}
      AND s.[Date_SK] BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY s.[Date_SK]
  `);
  return result.recordset;
}

async function getGradeVolumeFuelData(pool, csoCode, startDate, endDate) {
  const dbStartDate = formatDateForDB(startDate);
  const dbEndDate = formatDateForDB(endDate);
  const result = await pool.request().query(`
    SELECT s.[Station_SK], s.[Date_SK] as 'businessDate', s.[FuelGradeID] as 'fuelGradeID', s.[Sales_Volume_LTR] as 'fuelGradeSalesVolume', s.[Description] as 'fuelGradeDescription'
    FROM [CSO].[FuelSummary] s
    WHERE
      s.[Station_SK] = ${csoCode}
      AND TRY_CONVERT(NVARCHAR, s.[Date_SK], 112) BETWEEN '${dbStartDate}' AND '${dbEndDate}'
    ORDER BY s.[Date_SK]
  `);
  const rowsWithDate = result.recordset.map(r => ({
    ...r,
    businessDate: parseBusinessDate(r.businessDate)
  }));

  return rowsWithDate;
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

async function getBulkOnHandQtyCSO(site, gtins = []) {
  if (!gtins.length) return {};
  try {
    const pool = await getPool();
    const list = gtins.map(u => `'${u}'`).join(",");

    const query = `
      SELECT [GTIN] AS gtin, [On Hand Qty] AS qty
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}' AND [GTIN] IN (${list})
    `;

    const result = await pool.request().query(query);
    // Convert array → dictionary
    const data = {};
    for (const row of result.recordset) {
      data[row.gtin] = row.qty;
    }

    return data;
  } catch (err) {
    console.error("SQL error:", err);
    return {};
  }
}

async function getBulkCSOData(site, gtins = []) {
  if (!gtins.length) return {};
  try {
    const pool = await getPool();
    const list = gtins.map(u => `'${u}'`).join(",");

    const query = `
      SELECT 
          [GTIN] AS gtin, 
          [On Hand Qty] AS qty,
          [Retail] AS unitPrice
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${site}' 
        AND [GTIN] IN (${list})
    `;

    const result = await pool.request().query(query);

    // Map results: { "gtin": { qty: 10, unitPrice: 5.99 } }
    const data = {};
    for (const row of result.recordset) {
      data[row.gtin] = {
        qty: row.qty,
        unitPrice: row.unitPrice
      };
    }
    return data;
  } catch (err) {
    console.error("SQL error in getBulkCSOData:", err);
    return {};
  }
}

async function getOnHandBulkCSOData(siteName, gtins = []) {
  if (!gtins.length) return {};
  try {
    const pool = await getPool();

    // Sanitize and wrap strings safely for cross-db query mapping
    const list = gtins.map(u => `'${u.replace(/'/g, "''")}'`).join(",");

    const query = `
      SELECT 
          [GTIN] AS gtin, 
          [On Hand Qty] AS qty,
          [Retail] AS unitPrice
      FROM [CSO].[Current_Inventory]
      WHERE [Station] = '${siteName.replace(/'/g, "''")}' 
        AND [GTIN] IN (${list})
    `;

    const result = await pool.request().query(query);

    const data = {};
    for (const row of result.recordset) {
      if (!row.gtin) continue;
      data[row.gtin.trim()] = {
        qty: row.qty != null ? Number(row.qty) : 0,
        unitPrice: row.unitPrice != null ? Number(row.unitPrice) : 0
      };
    }
    return data;
  } catch (err) {
    console.error(`SQL error in getOnHandBulkCSOData for site ${siteName}:`, err);
    return {};
  }
}


async function getBulkUnitPriceCSO(site, gtins = []) {
  if (!gtins.length) return {};
  try {
    const pool = await getPool();
    const list = gtins.map(u => `'${u}'`).join(",");

    const query = `
      SELECT 
          [GTIN] AS gtin, 
          [Retail] AS unitPrice
      FROM [CSO].[Master_Item]
      WHERE [Station_SK] = '${site}' 
        AND [GTIN] IN (${list})
        AND [Retail] IS NOT NULL 
        AND [Retail] > 0;
    `;
    const result = await pool.request().query(query);
    // Convert array → dictionary
    const data = {};
    for (const row of result.recordset) {
      data[row.gtin] = row.unitPrice;
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
        requestTimeout: 60000, // 60s per query (default was 15s)
        pool: {
          max: 50, // increase if VPS can handle it
          min: 0,
          idleTimeoutMillis: 60000, // more time for idle connections
          acquireTimeoutMillis: 300000, // more time to acquire heavy queries
        },
        options: {
          encrypt: true,
          trustServerCertificate: false,
          enableArithAbort: true,
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

// /app/services/sqlService.js

async function getFuelPricingDate(date) {
  const pool = await getPool();

  try {
    // 1. Rename this variable from 'sql' to 'queryText' to avoid the scope collision
    const queryText = `
      SELECT [Station_SK]
            ,[Date_SK]
            ,[Provider]
            ,[Location]
            ,[Type]
            ,[Effective Date]
            ,[T-1's Rack]
            ,[Today's Rack]
            ,[Prev Close]
            ,[T-1 Landed Cost]
            ,[Landed Cost]
            ,[Rec Price]
            ,[Low]
            ,[T-1 Low]
            ,[Avg]
            ,[T-1 Avg]
            ,[High]
            ,[T-1 High]
            ,[Competitor Type]
            ,[Competitor]
            ,[Competitor Address]
            ,[Competitor Price]
            ,[C_Updated Date]
            ,[C_Updated Time]
            ,[UpdatedAt]
            ,[T+1 Rack] AS [T+1's Rack]
            ,[T+1 Landed Cost] AS [T+1's Landed Cost]
      FROM [FUEL].[Fuel_Pricing] WHERE [Date_SK] = @date
    `;

    const request = pool.request();

    // 2. Now 'sql.VarChar' correctly references the global mssql module instance
    request.input("date", sql.VarChar, date);

    // 3. Pass the renamed query variable into the driver execution method
    const result = await request.query(queryText);
    return result;
  } catch (err) {
    console.error("SQL error:", err);
    return { recordset: [] };
  }
}
// async function getFuelPricingDate(date) {
//   const pool = await getPool();

//   try {
//     const queryText = `
//       SELECT fp.[Station_SK]
//             ,fp.[Date_SK]
//             ,fp.[Provider]
//             ,fp.[Location]
//             ,fp.[Type]
//             ,fp.[Effective Date]
//             ,fp.[T-1's Rack]
//             ,fp.[Today's Rack]
//             -- ⬇️ Populated from the Tomorrow PriceSheet table
//             ,fpt.[Rack] AS [T+1's Rack]
//             ,fp.[Prev Close]
//             ,fp.[T-1 Landed Cost]
//             ,fp.[Landed Cost]
//             -- ⬇️ Populated from the Tomorrow PriceSheet table
//             ,fpt.[Landed Price] AS [T+1's Landed Cost]
//             ,fp.[Rec Price]
//             ,fp.[Low]
//             ,fp.[T-1 Low]
//             ,fp.[Avg]
//             ,fp.[T-1 Avg]
//             ,fp.[High]
//             ,fp.[T-1 High]
//             ,fp.[Competitor Type]
//             ,fp.[Competitor]
//             ,fp.[Competitor Address]
//             ,fp.[Competitor Price]
//             ,fp.[C_Updated Date]
//             ,fp.[C_Updated Time]
//             ,fp.[UpdatedAt]
//       FROM [FUEL].[Fuel_Pricing] fp
//       LEFT JOIN [FUEL].[Fuel_PriceSheet_Tomorrow] fpt 
//         ON fp.[Station_SK] = fpt.[Station_SK]
//         AND fp.[Pickup] = fpt.[Pickup]
//         AND fp.[Carrier] = fpt.[Carrier]
//         AND fp.[Type] = fpt.[Type]
//         AND fp.[Location] = fpt.[Location] -- Matching location ensures spec alignment
//         AND fpt.[ReceivedDate_SK] = @date
//         AND fpt.[Effective Date] = DATEADD(day, 1, CONVERT(DATE, fpt.[ReceivedDate_SK], 112))
//       WHERE fp.[Date_SK] = @date
//     `;

//     const request = pool.request();
//     request.input("date", sql.VarChar, date);

//     const result = await request.query(queryText);
//     return result;
//   } catch (err) {
//     console.error("SQL error:", err);
//     return { recordset: [] };
//   }
// }


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
      WITH RankedInventory AS (
        SELECT 
            [Station_SK], 
            [Fuel_Grade], 
            TRY_CAST([Volume] AS DECIMAL(18, 2)) AS [Stick_L_Tank],
            ROW_NUMBER() OVER (
                PARTITION BY [Station_SK], [Fuel_Grade], [Tank_ID]
                ORDER BY [Time] DESC
            ) AS rnk
        FROM [CSO].[CurrentFuelInv]
        WHERE [Date_SK] = TRY_CONVERT(CHAR(8), GETDATE(), 112)
      )
      SELECT 
            [Station_SK], 
            [Fuel_Grade], 
            SUM([Stick_L_tank]) AS [Stick_L] 
      FROM RankedInventory
      WHERE rnk = 1
      GROUP BY [Station_SK], [Fuel_Grade]
      ORDER BY [Station_SK]
    `);
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getFuelSupplierDiscounts() {
  try {
    const { getPool } = require('./sqlService'); // Adjust path if needed
    const pool = await getPool();

    // Coalesce primary keys to safeguard output integrity against missing links on either side
    const result = await pool.request().query(`
      SELECT 
        COALESCE(live.[Supplier Code], stg.[Supplier Code]) AS [Supplier Code],
        COALESCE(live.[ Supplier Item], stg.[ Supplier Item]) AS [ Supplier Item],
        COALESCE(live.[Inventory Item], stg.[Inventory Item]) AS [Inventory Item],
        live.[Discounts] AS [Live_Discounts],
        live.[Updated At] AS [Live_Updated_At],
        stg.[Discounts] AS [Stg_Discounts],
        stg.[Updated At] AS [Stg_Updated_At]
      FROM [FUEL].[SupplierDiscounts] AS live
      FULL OUTER JOIN [FUEL].[Stg_SupplierDiscounts] AS stg
        ON  live.[Supplier Code] = stg.[Supplier Code]
        AND live.[ Supplier Item] = stg.[ Supplier Item]
        AND live.[Inventory Item] = stg.[Inventory Item]
    `);

    return result.recordset;
  } catch (err) {
    console.error('SQL error executing dual-table fetch:', err);
    return [];
  }
}

// async function getFuelCarrierHaulage() {
//   try {
//     const pool = await getPool();
//     const result = await pool.request().query(`
//       SELECT [Carrier]
//             ,[Type]
//             ,[Location]
//             ,[Pickup]
//             ,[Haulage]
//             ,[Updated At]
//       FROM [FUEL].[TEST_CarrierHaulage]
//     `);
//     await sql.close();
//     return result.recordset;
//   } catch (err) {
//     console.error('SQL error:', err);
//     return [];
//   }
// }

// async function getFuelCarrierFCS() {
//   try {
//     const pool = await getPool();
//     const result = await pool.request().query(`
//       SELECT [Carrier]
//             ,[Province]
//             ,[FCS]
//             ,[Updated At]
//         FROM [FUEL].[TEST_CarrierFCS]
//         WHERE [Province] IS NOT NULL
//     `);
//     await sql.close();
//     return result.recordset;
//   } catch (err) {
//     console.error('SQL error:', err);
//     return [];
//   }
// }

async function getFuelCarrierHaulage() {
  try {
    const { getPool } = require('./sqlService'); // Adjust path if needed
    const pool = await getPool();

    // FULL OUTER JOIN on all 4 composite keys: Carrier, Type, Location, and Pickup
    const result = await pool.request().query(`
      SELECT 
        COALESCE(live.[Carrier], stg.[Carrier]) AS [Carrier],
        COALESCE(live.[Type], stg.[Type]) AS [Type],
        COALESCE(live.[Location], stg.[Location]) AS [Location],
        COALESCE(live.[Pickup], stg.[Pickup]) AS [Pickup],
        live.[Haulage] AS [Live_Haulage],
        live.[Updated At] AS [Live_Updated_At],
        stg.[Haulage] AS [Stg_Haulage],
        stg.[Updated At] AS [Stg_Updated_At]
      FROM [FUEL].[CarrierHaulage] AS live
      FULL OUTER JOIN [FUEL].[Stg_CarrierHaulage] AS stg
        ON  live.[Carrier] = stg.[Carrier]
        AND live.[Type] = stg.[Type]
        AND live.[Location] = stg.[Location]
        AND live.[Pickup] = stg.[Pickup]
    `);

    return result.recordset;
  } catch (err) {
    console.error('SQL error executing dual-table fetch for Carrier Haulage:', err);
    return [];
  }
}

async function getFuelCarrierFCS() {
  try {
    const { getPool } = require('./sqlService'); // Adjust path if needed
    const pool = await getPool();

    // FULL OUTER JOIN on the 2 composite keys: Carrier and Province
    const result = await pool.request().query(`
      SELECT 
        COALESCE(live.[Carrier], stg.[Carrier]) AS [Carrier],
        COALESCE(live.[Province], stg.[Province]) AS [Province],
        live.[FCS] AS [Live_FCS],
        live.[Updated At] AS [Live_Updated_At],
        stg.[FCS] AS [Stg_FCS],
        stg.[Updated At] AS [Stg_Updated_At]
      FROM [FUEL].[CarrierFCS] AS live
      FULL OUTER JOIN [FUEL].[Stg_CarrierFCS] AS stg
        ON  live.[Carrier] = stg.[Carrier]
        AND live.[Province] = stg.[Province]
      WHERE live.[Province] IS NOT NULL OR stg.[Province] IS NOT NULL
    `);

    return result.recordset;
  } catch (err) {
    console.error('SQL error executing dual-table fetch for Carrier FCS:', err);
    return [];
  }
}

async function getFuelStationDiscounts() {
  try {
    const { getPool } = require('./sqlService');
    const pool = await getPool();

    // FULL OUTER JOIN on the 5 keys representing a unique station assignment row
    const result = await pool.request().query(`
      SELECT 
        COALESCE(live.[Station_SK], stg.[Station_SK]) AS [Station_SK],
        COALESCE(live.[Location], stg.[Location]) AS [Location],
        COALESCE(live.[Province], stg.[Province]) AS [Province],
        COALESCE(live.[Type], stg.[Type]) AS [Type],
        COALESCE(live.[Fuel_Grade], stg.[Fuel_Grade]) AS [Fuel_Grade],
        live.[Discounts] AS [Live_Discounts],
        live.[Updated_At] AS [Live_Updated_At],
        stg.[Discounts] AS [Stg_Discounts],
        stg.[Updated_At] AS [Stg_Updated_At],
        stg.[Schedule_Effective_From] AS [Schedule_Effective_From]
      FROM [FUEL].[Station_Discounts] AS live
      FULL OUTER JOIN [FUEL].[Stg_Station_Discounts] AS stg
        ON  live.[Station_SK] = stg.[Station_SK]
        AND live.[Location] = stg.[Location]
        AND live.[Province] = stg.[Province]
        AND (live.[Type] = stg.[Type] OR (live.[Type] IS NULL AND stg.[Type] IS NULL))
        AND (live.[Fuel_Grade] = stg.[Fuel_Grade] OR (live.[Fuel_Grade] IS NULL AND stg.[Fuel_Grade] IS NULL))
      WHERE live.[Station_SK] IS NOT NULL OR stg.[Station_SK] IS NOT NULL
      ORDER BY live.[Station_SK]
    `);

    return result.recordset;
  } catch (err) {
    console.error('SQL error executing dual-table fetch for Station Discounts:', err);
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
  const dbStartDate = formatDateForDB(startDate);
  const dbEndDate = formatDateForDB(endDate);
  const timePeriodResult = await pool.request()
    .input("csoCode", sql.Int, csoCode)
    .input("startDate", sql.VarChar, dbStartDate)
    .input("endDate", sql.VarChar, dbEndDate)
    .query(`
      WITH Classified AS (
        SELECT DISTINCT
              [Station_SK]
            , [Date_SK]
            , [Transaction ID]
            , [Status]
            , [IsCombined]
            , CASE
                  WHEN [Event Start Time] <= CONVERT(TIME, '06:00:00') THEN 'Before 06:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '07:00:00') THEN '06:00AM - 07:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '08:00:00') THEN '07:00AM - 08:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '09:00:00') THEN '08:00AM - 09:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '10:00:00') THEN '09:00AM - 10:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '11:00:00') THEN '10:00AM - 11:00AM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '12:00:00') THEN '11:00AM - 12:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '13:00:00') THEN '12:00PM - 13:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '14:00:00') THEN '13:00PM - 14:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '15:00:00') THEN '14:00PM - 15:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '16:00:00') THEN '15:00PM - 16:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '17:00:00') THEN '16:00PM - 17:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '18:00:00') THEN '17:00PM - 18:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '19:00:00') THEN '18:00PM - 19:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '20:00:00') THEN '19:00PM - 20:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '21:00:00') THEN '20:00PM - 21:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '22:00:00') THEN '21:00PM - 22:00PM'
                  WHEN [Event Start Time] <= CONVERT(TIME, '23:00:00') THEN '22:00PM - 23:00PM'
                  ELSE '23:00PM - 24:00AM'
              END AS [Hour]
        FROM [CSO].[SalesTransaction]
        WHERE [Station_SK] = @csoCode
          AND [Date_SK] BETWEEN @startDate AND @endDate
      )
      SELECT [Date_SK], [Hour] AS hours, 'Fuel'    AS transaction_type, COUNT([Transaction ID]) AS transaction_count FROM Classified WHERE [Status] = 'FUEL'   GROUP BY [Date_SK], [Hour]
      UNION ALL
      SELECT [Date_SK], [Hour] AS hours, 'C-Store' AS transaction_type, COUNT([Transaction ID]) AS transaction_count FROM Classified WHERE [Status] <> 'FUEL'  GROUP BY [Date_SK], [Hour]
      UNION ALL
      SELECT [Date_SK], [Hour] AS hours, 'Both'    AS transaction_type, COUNT([Transaction ID]) AS transaction_count FROM Classified WHERE [IsCombined] = 1     GROUP BY [Date_SK], [Hour]
      ORDER BY [Date_SK];
    `);
  const timePeriodResultTransformed = transformTimePeriodData(timePeriodResult.recordset)
  return {
    timePeriodTransactions: timePeriodResultTransformed ?? [],
  };
}
async function getAllTendorData(pool, csoCode, startDate, endDate) {
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
}
async function getAllTransactionsData(pool, csoCode, startDate, endDate) {
  const transactionsResult = await pool.request()
    .input("csoCode", sql.Int, csoCode)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT 
          a.[Station_SK], 
          a.[Date], 
          a.[Number of Transaction ID] AS transactions, 
          b.[Avg Bucket] AS bucket_size
      FROM [CSO].[Daily Transaction Traffic View] a
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
}

async function getWeeklyBistroSales(pool, csoCode) {
  const result = await pool.request()
    .input("csoCode", sql.Int, csoCode)
    .query(`
    SELECT *
    FROM [CSO].[BistroSales]
    WHERE [Station_Code] = @csoCode
    ORDER BY [WeekStart]
  `);
  return result.recordset;
}

async function getTop10Bistro(pool, csoCode) {
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
  return result.recordset;
}
async function getShiftTransactionTimings(pool, csoCode, startDate, endDate) {
  const dbStartDate = formatDateForDB(startDate);
  const dbEndDate = formatDateForDB(endDate);
  const result = await pool.request()
    .input("csoCode", sql.VarChar, csoCode)
    .input("startDateSK", sql.VarChar, dbStartDate)
    .input("endDateSK", sql.VarChar, dbEndDate)
    .query(`
      WITH TransactionData AS (
        SELECT
          [Date_SK],
          MIN(CASE WHEN [Station] NOT LIKE '%Cardlock%' THEN [DateTime] END) as firstRegTrans,
          MAX(CASE WHEN [Station] NOT LIKE '%Cardlock%' THEN [DateTime] END) as lastRegTrans,
          MIN(CASE WHEN [Station] LIKE '%Cardlock%' THEN [DateTime] END) as firstCardlockTrans,
          MAX(CASE WHEN [Station] LIKE '%Cardlock%' THEN [DateTime] END) as lastCardlockTrans
        FROM [CSO].[Stg_CashRegisterJournal]
        WHERE [Date_SK] BETWEEN @startDateSK AND @endDateSK
            AND [Station_SK] LIKE CONCAT(@csoCode, '%')
        GROUP BY [Date_SK]
        ),
      TimesheetData AS (
        SELECT
          CONVERT(CHAR(8), [startDate], 112) as [Date_SK],
          MIN([startDate]) as firstShiftLogin,
          MAX([endDate]) as lastShiftLogout
        FROM [Payworks].[Timesheets]
        WHERE [Station_SK] = @csoCode
            AND CONVERT(CHAR(8), [startDate], 112) BETWEEN @startDateSK AND @endDateSK
            AND [position] NOT LIKE '%Manager%'
            AND [status] = 'Approved'
        GROUP BY CONVERT(CHAR(8), [startDate], 112)
      )
      SELECT
        COALESCE(t.[Date_SK], ts.[Date_SK]) as Date_SK,
        t.firstRegTrans,
        t.lastRegTrans,
        t.firstCardlockTrans,
        t.lastCardlockTrans,
        ts.firstShiftLogin,
        ts.lastShiftLogout
      FROM TransactionData t
      FULL OUTER JOIN TimesheetData ts ON t.[Date_SK] = ts.[Date_SK]
      ORDER BY Date_SK DESC;
    `);
  return result.recordset;
}

async function getRefundTransactions(csoCode, date) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('csoCode', sql.Int, csoCode)
      .input('targetDate', sql.VarChar, date) // or sql.Date
      .query(`
        SELECT [Transaction ID], [Transaction Line], [Event Start Time], 
          [GTIN], [UPC], [Category], [Item Name], 
          [Actual Sales Amount]
        FROM [CSO].[SalesTransactionCRJ]
        WHERE [Status] = 'RefundEvent' AND 
          [Station_SK] = @csoCode AND 
          [Date] = @targetDate
        ORDER BY [Event Start Time]
      `);
    // await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('SQL error:', err);
    return [];
  }
}

async function getShiftEmployees(csoCode, startDate, endDate) {
  const pool = await getPool();
  const result = await pool.request()
    .input("csoCode", sql.VarChar, csoCode)
    .input("startDate", sql.DateTime2, startDate)
    .input("endDate", sql.DateTime2, endDate)
    .query(`
      SELECT 
        e.[firstName], 
        e.[lastName], 
        t.[startDate], 
        t.[endDate], 
        e.[employeeId]
      FROM [Payworks].[Timesheets] t 
      LEFT JOIN [Payworks].[Employees] e ON t.[employeeId] = e.[employeeId] 
      WHERE t.[status] = 'Approved' 
        AND t.[Station_SK] = @csoCode 
        AND t.[position] NOT LIKE '%Manager%'
        -- Logic: Shift started before the end of our range AND ended after the start of our range
        AND t.[startDate] <= @endDate 
        AND t.[endDate] >= @startDate
    `);
  return result.recordset;
}

/**
 * Fetches flattened item data from Azure SQL by joining Current_Inventory,
 * Master_Item, and the most recent record from Inventory Balance.
 */
async function getFullItemBackupData() {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        CI.[UPC],
        CI.[Station_SK],
        CI.[On Hand Qty] AS onHandQty,
        MI.[GTIN],
        MI.[SKU] AS upc_barcode,
        MI.[Description],
        MI.[Retail],
        MI.[Vendor ID] AS vendorId,
        MI.[Vendor] AS vendorName,
        MI.[Category ID] AS categoryId,
        MI.[Department ID] AS departmentId,
        MI.[Department],
        MI.[Price Group ID] AS priceGroupId,
        MI.[Price Group] AS priceGroup,
        MI.[Promo Group ID] AS promoGroupId,
        MI.[Promo Group] AS promoGroup,
        (
          SELECT MAX([Last_Inv_Date]) 
          FROM [CSO].[Inventory Balance] IB 
          WHERE IB.[UPC] = CI.[UPC] AND IB.[Station_SK] = CI.[Station_SK]
        ) AS last_inv_date,
        (
          SELECT [URL] 
          FROM [CSO].[UPC Details] UD
          WHERE UD.[UPC] = CI.[UPC]
        ) AS image_url
      FROM [CSO].[Current_Inventory] CI
      LEFT JOIN [CSO].[Master_Item] MI 
        ON CI.[UPC] = MI.[UPC] AND CI.[Station_SK] = MI.[Station_SK]
      WHERE MI.[GTIN] IS NOT NULL and MI.[Category ID] is not null
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error("SQL error fetching backup data:", err);
    throw err;
  }
}

/**
 * Fetches the entire current inventory matrix from Azure SQL to sanitize Postgres item_bk.
 * Includes Category Name for Mongo cross-verification lookup.
 */
async function getSanitizationBackupData() {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        CI.[UPC],
        CI.[Station_SK],
        CI.[On Hand Qty] AS onHandQty,
        MI.[GTIN],
        MI.[SKU] AS upc_barcode,
        MI.[Description],
        MI.[Retail],
        MI.[Vendor ID] AS vendorId,
        MI.[Vendor] AS vendorName,
        MI.[Category ID] AS categoryId,
        MI.[Category Name] AS categoryName,
        MI.[Department ID] AS departmentId,
        MI.[Department],
        MI.[Price Group ID] AS priceGroupId,
        MI.[Price Group] AS priceGroup,
        MI.[Promo Group ID] AS promoGroupId,
        MI.[Promo Group] AS promoGroup,
        (
          SELECT MAX([Last_Inv_Date]) 
          FROM [CSO].[Inventory Balance] IB 
          WHERE IB.[UPC] = CI.[UPC] AND IB.[Station_SK] = CI.[Station_SK]
        ) AS last_inv_date,
        (
          SELECT [URL] 
          FROM [CSO].[UPC Details] UD
          WHERE UD.[UPC] = CI.[UPC]
        ) AS image_url
      FROM [CSO].[Current_Inventory] CI
      LEFT JOIN [CSO].[Master_Item] MI 
        ON CI.[UPC] = MI.[UPC] AND CI.[Station_SK] = MI.[Station_SK]
      WHERE MI.[GTIN] IS NOT NULL 
        AND MI.[Category ID] IS NOT NULL 
        AND MI.[Category ID] 
          NOT IN (0, 121, 130, 131, 133, 134, 152, 153, 155, 157, 158, 175, 176, 
                  200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 
                  214, 216, 218, 219, 220, 800, 999, 1000, 5001, 5002, 5003, 10000)
    `;

    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error("SQL error fetching sanitization backup data:", err);
    throw err;
  }
}

/**
 * Fetches the aggregated fuel sales and rollup treaty/non-treaty totals
 * for a specific station and target date, accounting for both regular sales and refunds.
 * * @param {string} csoCode - The Station_SK identifier (e.g., '78205')
 * @param {string|Date} targetDate - The date to fetch data for (e.g., '2026-06-15')
 * @returns {Promise<Array>} The aggregated report dataset
 */
async function getFuelSalesRollupReport(csoCode, targetDate) {
  const pool = await getPool();

  // Convert date string/object safely to 'YYYYMMDD' string format for Date_SK mapping
  const formattedDateString = formatDateForDB(targetDate.toString());

  const result = await pool.request()
    .input("csoCode", sql.VarChar, csoCode)
    .input("targetDate", sql.Char(8), formattedDateString)
    .query(`
      WITH status_discount_transactions AS (
          -- Step 1: Identify transaction IDs that contain a Status Discount
          SELECT DISTINCT [Transaction ID]
          FROM [CSO].[Stg_CashRegisterJournal]
          WHERE [Date_SK] = @targetDate
            AND [Station_SK] = @csoCode
            AND [Item Description] = 'STATUS DISCOUNT'
            AND [Transaction ID] IS NOT NULL
      ),

      extracted_fuel_sales AS (
          -- Step 2: Filter and map the large table, adjusting values for Refund events
          SELECT 
              -- Invert the sign if it's a refund event so it subtracts from totals
              CASE 
                  WHEN s.[Event] LIKE '%Refund%' THEN -1 * ABS(s.[Sales Amount])
                  ELSE s.[Sales Amount]
              END AS cte_sales_amount,
              
              CASE 
                  WHEN s.[Event] LIKE '%Refund%' THEN -1 * ABS(s.[Sales Quantity])
                  ELSE s.[Sales Quantity]
              END AS cte_sales_quantity,
              
              CASE 
                  WHEN [Item Description] LIKE '%DYED%' THEN 'Dyed Diesel'
                  WHEN [Item Description] LIKE '%DIESEL%' OR [Item Description] LIKE '%ULSD%' THEN 'Diesel'
                  WHEN [Fuel Type] = 'REG' THEN 'Regular'
                  WHEN [Fuel Type] = 'PNL' THEN 'Premium'
                  WHEN [Fuel Type] = 'MID' THEN 'Midgrade'
                  ELSE COALESCE([Fuel Type], 'Unknown Grade')
              END AS final_grade,
              CASE 
                  WHEN d.[Transaction ID] IS NOT NULL THEN 'Treaty Sale'
                  ELSE 'Non Treaty Sale'
              END AS sale_category
          FROM [CSO].[Stg_CashRegisterJournal] s
          LEFT JOIN status_discount_transactions d ON s.[Transaction ID] = d.[Transaction ID]
          WHERE s.[Date_SK] = @targetDate
            AND s.[Station_SK] = @csoCode
            -- Included both SaleEvent and Refund events
            AND (s.[Event] LIKE 'SaleEvent%' OR s.[Event] LIKE '%Refund%')
            AND s.[Transaction Type] LIKE 'Fuel%'
            -- Ensure we don't pick up flat 0 quantity baseline rows
            AND s.[Sales Quantity] <> 0
      )

      -- Step 3: Perform the final ROLLUP aggregation
      SELECT 
          COALESCE(sale_category, 'GRAND TOTAL') AS sale_category,
          CASE 
              WHEN sale_category IS NULL THEN 'All Categories'
              ELSE COALESCE(final_grade, 'All Grades') 
          END AS fuel_grade,
          CAST(SUM(COALESCE(cte_sales_amount, 0.00)) AS DECIMAL(18,2)) AS total_dollar_amount,
          CAST(SUM(COALESCE(cte_sales_quantity, 0.0000)) AS DECIMAL(18,4)) AS total_volume
      FROM extracted_fuel_sales
      GROUP BY ROLLUP(sale_category, final_grade)
      ORDER BY 
          CASE WHEN sale_category IS NULL THEN 1 ELSE 0 END, 
          sale_category, 
          CASE WHEN final_grade IS NULL THEN 1 ELSE 0 END,
          fuel_grade;
    `);

  return result.recordset;
}
// async function getFuelSalesRollupReport(csoCode, targetDate) {
//   const pool = await getPool();

//   // Convert date string/object safely to 'YYYYMMDD' string format for Date_SK mapping
//   const formattedDateString = formatDateForDB(targetDate.toString());

//   const result = await pool.request()
//     .input("csoCode", sql.VarChar, csoCode)
//     .input("targetDate", sql.Char(8), formattedDateString)
//     .query(`
//       WITH date_range AS (
//           -- TEMPORARY LOCAL FIX: Calculate targetDate + 1 day dynamically inside SQL
//           SELECT 
//             @targetDate AS start_date,
//             CONVERT(VARCHAR(8), DATEADD(day, 1, CONVERT(DATE, @targetDate, 112)), 112) AS end_date
//       ),

//       status_discount_transactions AS (
//           -- Step 1: Identify transaction IDs that contain a Status Discount across BOTH days
//           SELECT DISTINCT [Transaction ID]
//           FROM [CSO].[Stg_CashRegisterJournal]
//           CROSS JOIN date_range
//           WHERE [Date_SK] BETWEEN start_date AND end_date
//             AND [Station_SK] = @csoCode
//             AND [Item Description] = 'STATUS DISCOUNT'
//             AND [Transaction ID] IS NOT NULL
//       ),

//       extracted_fuel_sales AS (
//           -- Step 2: Filter and map across the 2-day target range
//           SELECT 
//               -- Invert the sign if it's a refund event so it subtracts from totals
//               CASE 
//                   WHEN s.[Event] LIKE '%Refund%' THEN -1 * ABS(s.[Sales Amount])
//                   ELSE s.[Sales Amount]
//               END AS cte_sales_amount,
              
//               CASE 
//                   WHEN s.[Event] LIKE '%Refund%' THEN -1 * ABS(s.[Sales Quantity])
//                   ELSE s.[Sales Quantity]
//               END AS cte_sales_quantity,
              
//               CASE 
//                   WHEN [Item Description] LIKE '%DYED%' THEN 'Dyed Diesel'
//                   WHEN [Item Description] LIKE '%DIESEL%' OR [Item Description] LIKE '%ULSD%' THEN 'Diesel'
//                   WHEN [Fuel Type] = 'REG' THEN 'Regular | E15' -- Frontend preference display mapping
//                   WHEN [Fuel Type] = 'PNL' THEN 'Premium'
//                   WHEN [Fuel Type] = 'MID' THEN 'Midgrade'
//                   ELSE COALESCE([Fuel Type], 'Unknown Grade')
//               END AS final_grade,
//               CASE 
//                   WHEN d.[Transaction ID] IS NOT NULL THEN 'Treaty Sale'
//                   ELSE 'Non Treaty Sale'
//               END AS sale_category
//           FROM [CSO].[Stg_CashRegisterJournal] s
//           CROSS JOIN date_range
//           LEFT JOIN status_discount_transactions d ON s.[Transaction ID] = d.[Transaction ID]
//           WHERE s.[Date_SK] BETWEEN start_date AND end_date
//             AND s.[Station_SK] = @csoCode
//             -- Included both SaleEvent and Refund events
//             AND (s.[Event] LIKE 'SaleEvent%' OR s.[Event] LIKE '%Refund%')
//             AND s.[Transaction Type] LIKE 'Fuel%'
//             -- Ensure we don't pick up flat 0 quantity baseline rows
//             AND s.[Sales Quantity] <> 0
//       )

//       -- Step 3: Perform the final ROLLUP aggregation
//       SELECT 
//           COALESCE(sale_category, 'GRAND TOTAL') AS sale_category,
//           CASE 
//               WHEN sale_category IS NULL THEN 'All Categories'
//               ELSE COALESCE(final_grade, 'All Grades') 
//           END AS fuel_grade,
//           CAST(SUM(COALESCE(cte_sales_amount, 0.00)) AS DECIMAL(18,2)) AS total_dollar_amount,
//           CAST(SUM(COALESCE(cte_sales_quantity, 0.0000)) AS DECIMAL(18,4)) AS total_volume
//       FROM extracted_fuel_sales
//       GROUP BY ROLLUP(sale_category, final_grade)
//       ORDER BY 
//           CASE WHEN sale_category IS NULL THEN 1 ELSE 0 END, 
//           sale_category, 
//           CASE WHEN final_grade IS NULL THEN 1 ELSE 0 END,
//           fuel_grade;
//     `);

//   return result.recordset;
// }

function formatDateForDB(dateString) {
  // input: "2025-11-14"
  // output: "20251114"
  return dateString.replace(/-/g, "");
}

// Helper to convert YYYYMMDD integer to JS Date
function parseBusinessDate(d) {
  const str = d.toString();
  if (str.length !== 8) return new Date(NaN); // invalid
  const year = Number(str.slice(0, 4));
  const month = Number(str.slice(4, 6)) - 1; // JS months 0-11
  const day = Number(str.slice(6, 8));
  return new Date(year, month, day);
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

async function getLatestCsoVendorsList() {
  try {
    const pool = await getPool();
    const query = `
      SELECT [VendorCode]
            ,[VendorName]
            ,[Fuel]
            ,[Expenses]
            ,[Merchandise]
            ,[Lottery]
            ,[Items QTY]
            ,[EDI Compatible]
            ,[Wholesaler]
      FROM [CSO].[Vendor_List]
    `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error("SQL error fetching backup data:", err);
    throw err;
  }
}

async function getAllSQLData(csoCode, dates) {
  const pool = await getPool();

  const {
    salesStart, salesEnd,
    fuelStart, fuelEnd,
    transStart, transEnd,
    shiftStart, shiftEnd
  } = dates;

  const queryNames = [
    "sales", "fuel", "transactions", "timePeriod",
    "tender", "shiftTimings", "bistroWoWSales", "top10Bistro",
  ];

  async function runQuery(name, fn) {
    try {
      return { status: "fulfilled", value: await retry(fn) };
    } catch (err) {
      console.error(`❌ SQL query "${name}" failed after retries:`, err?.message || err);
      return { status: "rejected" };
    }
  }

  const salesResult = await runQuery("sales", () => getCategorizedSalesData(pool, csoCode, salesStart, salesEnd));
  const fuelResult = await runQuery("fuel", () => getGradeVolumeFuelData(pool, csoCode, fuelStart, fuelEnd));
  const transResult = await runQuery("transactions", () => getAllTransactionsData(pool, csoCode, transStart, transEnd));
  const periodResult = await runQuery("timePeriod", () => getAllPeriodData(pool, csoCode, transStart, transEnd));
  const tenderResult = await runQuery("tender", () => getAllTendorData(pool, csoCode, transStart, transEnd));
  const shiftResult = await runQuery("shiftTimings", () => getShiftTransactionTimings(pool, csoCode, shiftStart, shiftEnd));
  const bistroResult = await runQuery("bistroWoWSales", () => getWeeklyBistroSales(pool, csoCode));
  const top10Result = await runQuery("top10Bistro", () => getTop10Bistro(pool, csoCode));

  return {
    sales: salesResult.status === "fulfilled" ? salesResult.value : [],
    fuel: fuelResult.status === "fulfilled" ? fuelResult.value : [],
    transactions: transResult.status === "fulfilled" ? transResult.value.transactions : [],
    timePeriodTransactions: periodResult.status === "fulfilled" ? periodResult.value.timePeriodTransactions : [],
    tenderTransactions: tenderResult.status === "fulfilled" ? tenderResult.value.tenderTransactions : [],
    shiftTransactionTimings: shiftResult.status === "fulfilled" ? shiftResult.value : [],
    bistroWoWSales: bistroResult.status === "fulfilled" ? bistroResult.value : [],
    top10Bistro: top10Result.status === "fulfilled" ? top10Result.value : [],
  };
}

async function lookupAcademyEmployee(employeeNumber) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('employeeNumber', sql.VarChar, String(employeeNumber))
    .query('SELECT firstName, lastName FROM Payworks.Employees WHERE employeeNumber = @employeeNumber')
  if (result.recordset.length === 0) return null
  const { firstName, lastName } = result.recordset[0]
  return { employeeNumber: String(employeeNumber), name: `${firstName} ${lastName}`.trim() }
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
  getRefundTransactions,
  getShiftTransactionTimings,
  getBulkUnitPriceCSO,
  getBulkCSOData,
  getShiftEmployees,
  lookupAcademyEmployee,
  getFullItemBackupData,
  getSanitizationBackupData,
  getFuelPricingDate,
  getOnHandBulkCSOData,
  getFuelSupplierDiscounts,
  getFuelCarrierHaulage,
  getFuelCarrierFCS,
  getFuelStationDiscounts,
  getFuelSalesRollupReport,
  getLatestCsoVendorsList,
};
