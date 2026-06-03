const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const { 
  getFuelPricingDate, 
  getFuelSupplierDiscounts, 
  getPool, 
  getFuelCarrierHaulage, 
  getFuelCarrierFCS 
} = require('../../services/sqlService');

// =========================================================================
// 1. PRIMARY FUEL PRICING GRID DASHBOARD ROUTE
// =========================================================================
router.get('/', async (req, res) => {
  try {
    const stores = await Location.find({ type: 'store' }).lean();
    if (!stores.length) {
      return res.status(200).json({ stations: [], pricingData: {} });
    }

    let dateSK = req.query.date;
    if (!dateSK) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateSK = `${yyyy}${mm}${dd}`;
    }

    const sqlResult = await getFuelPricingDate(dateSK);
    const rows = sqlResult.recordset || [];

    const pricingMap = {};

    rows.forEach(row => {
      const cso = row.Station_SK != null ? String(row.Station_SK).trim() : null;
      const grade = row.Type != null ? String(row.Type).trim() : null;

      if (!cso || !grade) return;
      if (!pricingMap[cso]) pricingMap[cso] = {};

      const rowUpdatedAt = row['UpdatedAt'] ? new Date(row['UpdatedAt']) : null;

      if (!pricingMap[cso][grade]) {
        pricingMap[cso][grade] = {
          updatedAt: rowUpdatedAt ? rowUpdatedAt.toISOString() : null,
          metrics: {
            landedCost: row['Landed Cost'],
            prevLandedCost: row['T-1 Landed Cost'],
            rackPrice: row["Today's Rack"],
            prevRackPrice: row["T-1's Rack"],
            recPrice: row['Rec Price'],
            low: row['Low'],
            prevLow: row['T-1 Low'],
            avg: row['Avg'],
            prevAvg: row['T-1 Avg'],
            high: row['High'],
            prevHigh: row['T-1 High'],
          },
          competitors: []
        };
      } else {
        if (rowUpdatedAt) {
          const existingUpdatedAt = pricingMap[cso][grade].updatedAt
            ? new Date(pricingMap[cso][grade].updatedAt)
            : null;

          if (!existingUpdatedAt || rowUpdatedAt > existingUpdatedAt) {
            pricingMap[cso][grade].updatedAt = rowUpdatedAt.toISOString();
          }
        }
      }

      if (row.Competitor && String(row.Competitor).trim().toUpperCase() !== 'NULL') {
        const compTypeRaw = row['Competitor Type'] != null ? String(row['Competitor Type']).trim() : '';

        let assignedType = 'City Area';
        if (compTypeRaw === 'Local Reserve') {
          assignedType = 'Reserve Area';
        } else if (compTypeRaw === 'Local City') {
          assignedType = 'City Area';
        }

        pricingMap[cso][grade].competitors.push({
          type: assignedType,
          name: String(row.Competitor).trim(),
          address: row['Competitor Address'] != null && String(row['Competitor Address']).toUpperCase() !== 'NULL'
            ? String(row['Competitor Address']).trim()
            : 'N/A',
          price: row['Competitor Price'],
          updatedDate: row['C_Updated Date'] && String(row['C_Updated Date']).toUpperCase() !== 'NULL' ? row['C_Updated Date'] : 'N/A',
          updatedTime: row['C_Updated Time'] && String(row['C_Updated Time']).toUpperCase() !== 'NULL' ? row['C_Updated Time'] : 'N/A'
        });
      }
    });

    return res.status(200).json({
      stations: stores.map(s => ({
        csoCode: s.csoCode,
        stationName: s.stationName,
        address: s.address
      })),
      pricingData: pricingMap
    });

  } catch (error) {
    console.error("Error processing fuel pricing metrics:", error);
    return res.status(500).json({ error: "Internal server error assembly failed." });
  }
});

// =========================================================================
// 2. SUPPLIER DISCOUNTS ROUTE BLOCK
// =========================================================================
router.get('/supplier-discounts', async (req, res) => {
  try {
    const discounts = await getFuelSupplierDiscounts();
    return res.status(200).json(discounts);
  } catch (error) {
    console.error("Error fetching supplier discounts:", error);
    return res.status(500).json({ error: "Failed to fetch supplier discounts." });
  }
});

router.post('/supplier-discounts/batch', async (req, res) => {
  const { entries } = req.body;
  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: "No compilation data entries provided for ingestion." });
  }

  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      for (const entry of entries) {
        const discountVal = parseFloat(entry.discounts);

        const liveInsert = new mssql.Request(transaction);
        await liveInsert
          .input('supCode', mssql.VarChar, entry.supplierCode)
          .input('supItem', mssql.VarChar, entry.supplierItem)
          .input('invItem', mssql.VarChar, entry.inventoryItem)
          .input('discountVal', mssql.Float, discountVal)
          .query(`
            INSERT INTO [FUEL].[SupplierDiscounts] (
              [Supplier Code], [ Supplier Item], [Inventory Item], [Discounts], [Created At], [Updated At], [Deleted At]
            ) VALUES (
              @supCode, @supItem, @invItem, @discountVal, GETDATE(), GETDATE(), '1900-01-01 00:00:00.000'
            )
          `);

        const stgInsert = new mssql.Request(transaction);
        await stgInsert
          .input('supCode', mssql.VarChar, entry.supplierCode)
          .input('supItem', mssql.VarChar, entry.supplierItem)
          .input('invItem', mssql.VarChar, entry.inventoryItem)
          .input('discountVal', mssql.Float, discountVal)
          .query(`
            INSERT INTO [FUEL].[Stg_SupplierDiscounts] (
              [Supplier Code], [ Supplier Item], [Inventory Item], [Discounts], [Updated At]
            ) VALUES (
              @supCode, @supItem, @invItem, @discountVal, NULL
            )
          `);
      }
      await transaction.commit();
      return res.status(200).json({ message: "New rows synchronized across both tables successfully." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch insertion transaction failed execution:", error);
    return res.status(500).json({ error: "Failed to create new supplier records across mirrors." });
  }
});

router.put('/supplier-discounts/batch', async (req, res) => {
  const { updates, deletions, isImmediate } = req.body;
  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      if (deletions && deletions.length > 0) {
        for (const item of deletions) {
          const liveDelete = new mssql.Request(transaction);
          await liveDelete
            .input('supCode', mssql.VarChar, item.supplierCode)
            .input('supItem', mssql.VarChar, item.supplierItem)
            .input('invItem', mssql.VarChar, item.inventoryItem)
            .query(`DELETE FROM [FUEL].[SupplierDiscounts] WHERE [Supplier Code] = @supCode AND [ Supplier Item] = @supItem AND [Inventory Item] = @invItem`);

          const stgDelete = new mssql.Request(transaction);
          await stgDelete
            .input('supCode', mssql.VarChar, item.supplierCode)
            .input('supItem', mssql.VarChar, item.supplierItem)
            .input('invItem', mssql.VarChar, item.inventoryItem)
            .query(`DELETE FROM [FUEL].[Stg_SupplierDiscounts] WHERE [Supplier Code] = @supCode AND [ Supplier Item] = @supItem AND [Inventory Item] = @invItem`);
        }
      }

      if (updates && updates.length > 0) {
        for (const item of updates) {
          const discountVal = parseFloat(item.discounts);

          if (isImmediate === true) {
            const liveUpdate = new mssql.Request(transaction);
            await liveUpdate
              .input('discountVal', mssql.Float, discountVal)
              .input('supCode', mssql.VarChar, item.supplierCode)
              .input('supItem', mssql.VarChar, item.supplierItem)
              .input('invItem', mssql.VarChar, item.inventoryItem)
              .query(`UPDATE [FUEL].[SupplierDiscounts] SET [Discounts] = @discountVal, [Updated At] = GETDATE() WHERE [Supplier Code] = @supCode AND [ Supplier Item] = @supItem AND [Inventory Item] = @invItem`);

            const stgUpdate = new mssql.Request(transaction);
            await stgUpdate
              .input('discountVal', mssql.Float, discountVal)
              .input('supCode', mssql.VarChar, item.supplierCode)
              .input('supItem', mssql.VarChar, item.supplierItem)
              .input('invItem', mssql.VarChar, item.inventoryItem)
              .query(`
                UPDATE [FUEL].[Stg_SupplierDiscounts] 
                SET [Discounts] = @discountVal, [Updated At] = NULL 
                WHERE [Supplier Code] = @supCode AND [ Supplier Item] = @supItem AND [Inventory Item] = @invItem
                  AND ([Updated At] IS NULL OR MONTH([Updated At]) != MONTH(GETDATE()) OR YEAR([Updated At]) != YEAR(GETDATE()))
              `);
          } else {
            const stgScheduledUpdate = new mssql.Request(transaction);
            await stgScheduledUpdate
              .input('discountVal', mssql.Float, discountVal)
              .input('supCode', mssql.VarChar, item.supplierCode)
              .input('supItem', mssql.VarChar, item.supplierItem)
              .input('invItem', mssql.VarChar, item.inventoryItem)
              .query(`UPDATE [FUEL].[Stg_SupplierDiscounts] SET [Discounts] = @discountVal, [Updated At] = GETDATE() WHERE [Supplier Code] = @supCode AND [ Supplier Item] = @supItem AND [Inventory Item] = @invItem`);
          }
        }
      }
      await transaction.commit();
      return res.status(200).json({ message: "Batch operation metrics written successfully." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch manipulation route failure:", error);
    return res.status(500).json({ error: "Failed to apply batch state modifications." });
  }
});

// =========================================================================
// 3. CARRIER FCS (FUEL SURCHARGE CRITERIA) ROUTE BLOCK
// =========================================================================
router.get('/carrier-fcs', async (req, res) => {
  try {
    const fcsData = await getFuelCarrierFCS();
    return res.status(200).json(fcsData);
  } catch (error) {
    console.error("Error fetching carrier fcs records:", error);
    return res.status(500).json({ error: "Failed to fetch carrier FCS dataset rules." });
  }
});

router.post('/carrier-fcs/batch', async (req, res) => {
  const { entries } = req.body;
  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: "No compiled matrix data items provided for processing." });
  }

  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      for (const entry of entries) {
        const fcsVal = parseFloat(entry.fcs);

        // A. Inject into Live Table Room
        const liveInsert = new mssql.Request(transaction);
        await liveInsert
          .input('carrier', mssql.VarChar, entry.carrier)
          .input('province', mssql.VarChar, entry.province)
          .input('fcsVal', mssql.Float, fcsVal)
          .query(`
            INSERT INTO [FUEL].[CarrierFCS] (
              [Carrier], [Province], [FCS], [Created At], [Updated At], [Deleted At]
            ) VALUES (
              @carrier, @province, @fcsVal, GETDATE(), GETDATE(), '1900-01-01 00:00:00.000'
            )
          `);

        // B. Mirror directly into Staging Table Room
        const stgInsert = new mssql.Request(transaction);
        await stgInsert
          .input('carrier', mssql.VarChar, entry.carrier)
          .input('province', mssql.VarChar, entry.province)
          .input('fcsVal', mssql.Float, fcsVal)
          .query(`
            INSERT INTO [FUEL].[Stg_CarrierFCS] (
              [Carrier], [Province], [FCS], [Updated At]
            ) VALUES (
              @carrier, @province, @fcsVal, NULL
            )
          `);
      }

      await transaction.commit();
      return res.status(200).json({ message: "Batch FCS rules loaded safely across mirrors." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch insertion failed for Carrier FCS:", error);
    return res.status(500).json({ error: "Failed to generate new database record fields." });
  }
});

router.put('/carrier-fcs/batch', async (req, res) => {
  const { updates, deletions, isImmediate } = req.body;
  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      // Deletions erase records from both tables immediately to maintain matching rows
      if (deletions && deletions.length > 0) {
        for (const item of deletions) {
          const liveDelete = new mssql.Request(transaction);
          await liveDelete
            .input('carrier', mssql.VarChar, item.carrier)
            .input('province', mssql.VarChar, item.province)
            .query(`DELETE FROM [FUEL].[CarrierFCS] WHERE [Carrier] = @carrier AND [Province] = @province`);

          const stgDelete = new mssql.Request(transaction);
          await stgDelete
            .input('carrier', mssql.VarChar, item.carrier)
            .input('province', mssql.VarChar, item.province)
            .query(`DELETE FROM [FUEL].[Stg_CarrierFCS] WHERE [Carrier] = @carrier AND [Province] = @province`);
        }
      }

      if (updates && updates.length > 0) {
        for (const item of updates) {
          const fcsVal = parseFloat(item.fcs);

          if (isImmediate === true) {
            const liveUpdate = new mssql.Request(transaction);
            await liveUpdate
              .input('fcsVal', mssql.Float, fcsVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('province', mssql.VarChar, item.province)
              .query(`UPDATE [FUEL].[CarrierFCS] SET [FCS] = @fcsVal, [Updated At] = GETDATE() WHERE [Carrier] = @carrier AND [Province] = @province`);

            const stgUpdate = new mssql.Request(transaction);
            await stgUpdate
              .input('fcsVal', mssql.Float, fcsVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('province', mssql.VarChar, item.province)
              .query(`
                UPDATE [FUEL].[Stg_CarrierFCS] 
                SET [FCS] = @fcsVal, [Updated At] = NULL 
                WHERE [Carrier] = @carrier AND [Province] = @province
                  AND ([Updated At] IS NULL OR MONTH([Updated At]) != MONTH(GETDATE()) OR YEAR([Updated At]) != YEAR(GETDATE()))
              `);
          } else {
            const stgScheduledUpdate = new mssql.Request(transaction);
            await stgScheduledUpdate
              .input('fcsVal', mssql.Float, fcsVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('province', mssql.VarChar, item.province)
              .query(`UPDATE [FUEL].[Stg_CarrierFCS] SET [FCS] = @fcsVal, [Updated At] = GETDATE() WHERE [Carrier] = @carrier AND [Province] = @province`);
          }
        }
      }

      await transaction.commit();
      return res.status(200).json({ message: "FCS modifications batch committed cleanly." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch update failed for Carrier FCS:", error);
    return res.status(500).json({ error: "Failed to execute database batch updates." });
  }
});

// =========================================================================
// 4. CARRIER HAULAGE ROUTE BLOCK
// =========================================================================
router.get('/carrier-haulage', async (req, res) => {
  try {
    const haulageData = await getFuelCarrierHaulage();
    return res.status(200).json(haulageData);
  } catch (error) {
    console.error("Error fetching carrier haulage:", error);
    return res.status(500).json({ error: "Failed to fetch carrier haulage data." });
  }
});

router.post('/carrier-haulage/batch', async (req, res) => {
  const { entries } = req.body;
  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: "No configuration entries provided for ingestion." });
  }

  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      for (const entry of entries) {
        const haulageVal = parseFloat(entry.haulage);

        // A. Inject into Live Table Room
        const liveInsert = new mssql.Request(transaction);
        await liveInsert
          .input('carrier', mssql.VarChar, entry.carrier)
          .input('type', mssql.VarChar, entry.type)
          .input('location', mssql.VarChar, entry.location)
          .input('pickup', mssql.VarChar, entry.pickup)
          .input('haulageVal', mssql.Float, haulageVal)
          .query(`
            INSERT INTO [FUEL].[CarrierHaulage] (
              [Carrier], [Type], [Location], [Pickup], [Haulage], [Created At], [Updated At], [Deleted At]
            ) VALUES (
              @carrier, @type, @location, @pickup, @haulageVal, GETDATE(), GETDATE(), '1900-01-01 00:00:00.000'
            )
          `);

        // B. Mirror directly into Staging Table Room
        const stgInsert = new mssql.Request(transaction);
        await stgInsert
          .input('carrier', mssql.VarChar, entry.carrier)
          .input('type', mssql.VarChar, entry.type)
          .input('location', mssql.VarChar, entry.location)
          .input('pickup', mssql.VarChar, entry.pickup)
          .input('haulageVal', mssql.Float, haulageVal)
          .query(`
            INSERT INTO [FUEL].[Stg_CarrierHaulage] (
              [Carrier], [Type], [Location], [Pickup], [Haulage], [Updated At]
            ) VALUES (
              @carrier, @type, @location, @pickup, @haulageVal, NULL
            )
          `);
      }

      await transaction.commit();
      return res.status(200).json({ message: "New haulage entries successfully generated across mirrors." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch insert failed for carrier haulage:", error);
    return res.status(500).json({ error: "Failed to create new haulage parameter instances." });
  }
});

router.put('/carrier-haulage/batch', async (req, res) => {
  const { updates, deletions, isImmediate } = req.body;
  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      if (deletions && deletions.length > 0) {
        for (const item of deletions) {
          const liveDelete = new mssql.Request(transaction);
          await liveDelete
            .input('carrier', mssql.VarChar, item.carrier)
            .input('type', mssql.VarChar, item.type)
            .input('location', mssql.VarChar, item.location)
            .input('pickup', mssql.VarChar, item.pickup)
            .query(`DELETE FROM [FUEL].[CarrierHaulage] WHERE [Carrier] = @carrier AND [Type] = @type AND [Location] = @location AND [Pickup] = @pickup`);

          const stgDelete = new mssql.Request(transaction);
          await stgDelete
            .input('carrier', mssql.VarChar, item.carrier)
            .input('type', mssql.VarChar, item.type)
            .input('location', mssql.VarChar, item.location)
            .input('pickup', mssql.VarChar, item.pickup)
            .query(`DELETE FROM [FUEL].[Stg_CarrierHaulage] WHERE [Carrier] = @carrier AND [Type] = @type AND [Location] = @location AND [Pickup] = @pickup`);
        }
      }

      if (updates && updates.length > 0) {
        for (const item of updates) {
          const haulageVal = parseFloat(item.haulage);

          if (isImmediate === true) {
            const liveUpdate = new mssql.Request(transaction);
            await liveUpdate
              .input('haulageVal', mssql.Float, haulageVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('type', mssql.VarChar, item.type)
              .input('location', mssql.VarChar, item.location)
              .input('pickup', mssql.VarChar, item.pickup)
              .query(`UPDATE [FUEL].[CarrierHaulage] SET [Haulage] = @haulageVal, [Updated At] = GETDATE() WHERE [Carrier] = @carrier AND [Type] = @type AND [Location] = @location AND [Pickup] = @pickup`);

            const stgUpdate = new mssql.Request(transaction);
            await stgUpdate
              .input('haulageVal', mssql.Float, haulageVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('type', mssql.VarChar, item.type)
              .input('location', mssql.VarChar, item.location)
              .input('pickup', mssql.VarChar, item.pickup)
              .query(`
                UPDATE [FUEL].[Stg_CarrierHaulage] 
                SET [Haulage] = @haulageVal, [Updated At] = NULL 
                WHERE [Carrier] = @carrier AND [Type] = @type AND [Location] = @location AND [Pickup] = @pickup
                  AND ([Updated At] IS NULL OR MONTH([Updated At]) != MONTH(GETDATE()) OR YEAR([Updated At]) != YEAR(GETDATE()))
              `);
          } else {
            const stgScheduledUpdate = new mssql.Request(transaction);
            await stgScheduledUpdate
              .input('haulageVal', mssql.Float, haulageVal)
              .input('carrier', mssql.VarChar, item.carrier)
              .input('type', mssql.VarChar, item.type)
              .input('location', mssql.VarChar, item.location)
              .input('pickup', mssql.VarChar, item.pickup)
              .query(`UPDATE [FUEL].[Stg_CarrierHaulage] SET [Haulage] = @haulageVal, [Updated At] = GETDATE() WHERE [Carrier] = @carrier AND [Type] = @type AND [Location] = @location AND [Pickup] = @pickup`);
          }
        }
      }

      await transaction.commit();
      return res.status(200).json({ message: "Haulage parameters modifications processed successfully." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch update failed for carrier haulage:", error);
    return res.status(500).json({ error: "Failed to execute database batch updates." });
  }
});

module.exports = router;