const express = require('express');
const router = express.Router();
const {
  getFuelSupplierDiscounts,
  getPool,
  getFuelCarrierHaulage,
  getFuelCarrierFCS,
  getFuelStationDiscounts
} = require('../../services/sqlService');


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

// 1. GET ROUTE - Fetch Merged Records
router.get('/station-discounts', async (req, res) => {
  try {
    const records = await getFuelStationDiscounts();
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching station discounts:", error);
    return res.status(500).json({ error: "Failed to fetch station discounts parameters." });
  }
});

// 2. POST ROUTE - Batch Create New Lines
router.post('/station-discounts/batch', async (req, res) => {
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

        // Insert into our development test environment table
        const liveInsert = new mssql.Request(transaction);
        await liveInsert
          .input('stationSk', mssql.NVarChar(20), entry.stationSk)
          .input('location', mssql.NVarChar(100), entry.location)
          .input('province', mssql.NVarChar(10), entry.province)
          .input('discountVal', mssql.Decimal(18, 4), discountVal)
          .input('type', mssql.NVarChar(10), entry.type || null)
          .input('fuelGrade', mssql.NVarChar(10), entry.fuelGrade || null)
          .query(`
            INSERT INTO [FUEL].[Station_Discounts] (
              [Station_SK], [Location], [Province], [Discounts], [Type], [Fuel_Grade], [Created_At], [Updated_At]
            ) VALUES (
              @stationSk, @location, @province, @discountVal, @type, @fuelGrade, GETDATE(), GETDATE()
            )
          `);

        // Insert mirror matching data row structure into Staging
        const stgInsert = new mssql.Request(transaction);
        await stgInsert
          .input('stationSk', mssql.NVarChar(20), entry.stationSk)
          .input('location', mssql.NVarChar(100), entry.location)
          .input('province', mssql.NVarChar(10), entry.province)
          .input('discountVal', mssql.Decimal(18, 4), discountVal)
          .input('type', mssql.NVarChar(10), entry.type || null)
          .input('fuelGrade', mssql.NVarChar(10), entry.fuelGrade || null)
          .query(`
            INSERT INTO [FUEL].[Stg_Station_Discounts] (
              [Station_SK], [Location], [Province], [Discounts], [Type], [Fuel_Grade], [Created_At], [Updated_At], [Schedule_Effective_From]
            ) VALUES (
              @stationSk, @location, @province, @discountVal, @type, @fuelGrade, GETDATE(), NULL, NULL
            )
          `);
      }
      await transaction.commit();
      return res.status(200).json({ message: "New station discount records written cleanly across tables." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Batch insertion transaction failed execution:", error);
    return res.status(500).json({ error: "Failed to create new station records across mirrors." });
  }
});

// 3. PUT ROUTE - Immediate Processing vs Custom Scheduled Effective Date Input
router.put('/station-discounts/batch', async (req, res) => {
  const { updates, deletions, isImmediate, scheduleEffectiveDate } = req.body;
  let pool;
  try {
    const mssql = require('mssql');
    pool = await getPool();
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      // HANDLE DELETIONS (Removes records immediately from both tables)
      if (deletions && deletions.length > 0) {
        for (const item of deletions) {
          const liveDelete = new mssql.Request(transaction);
          await liveDelete
            .input('stationSk', mssql.NVarChar(20), item.stationSk)
            .input('location', mssql.NVarChar(100), item.location)
            .input('province', mssql.NVarChar(10), item.province)
            .input('type', mssql.NVarChar(10), item.type || null)
            .input('fuelGrade', mssql.NVarChar(10), item.fuelGrade || null)
            .query(`
              DELETE FROM [FUEL].[Station_Discounts] 
              WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
                AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
                AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
            `);

          const stgDelete = new mssql.Request(transaction);
          await stgDelete
            .input('stationSk', mssql.NVarChar(20), item.stationSk)
            .input('location', mssql.NVarChar(100), item.location)
            .input('province', mssql.NVarChar(10), item.province)
            .input('type', mssql.NVarChar(10), item.type || null)
            .input('fuelGrade', mssql.NVarChar(10), item.fuelGrade || null)
            .query(`
              DELETE FROM [FUEL].[Stg_Station_Discounts] 
              WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
                AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
                AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
            `);
        }
      }

      // HANDLE UPDATES
      if (updates && updates.length > 0) {
        for (const item of updates) {
          const discountVal = parseFloat(item.discounts);

          if (isImmediate === true) {
            // Write directly live right now
            const liveUpdate = new mssql.Request(transaction);
            await liveUpdate
              .input('discountVal', mssql.Decimal(18, 4), discountVal)
              .input('stationSk', mssql.NVarChar(20), item.stationSk)
              .input('location', mssql.NVarChar(100), item.location)
              .input('province', mssql.NVarChar(10), item.province)
              .input('type', mssql.NVarChar(10), item.type || null)
              .input('fuelGrade', mssql.NVarChar(10), item.fuelGrade || null)
              .query(`
                UPDATE [FUEL].[Station_Discounts] 
                SET [Discounts] = @discountVal, [Updated_At] = GETDATE() 
                WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
                  AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
                  AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
              `);

            // 2. Refined Staging Sync: Only update staging back to clean status if there isn't an active scheduled change pending
            const stgUpdate = new mssql.Request(transaction);
            await stgUpdate
              .input('discountVal', mssql.Decimal(18, 4), discountVal)
              .input('stationSk', mssql.NVarChar(20), item.stationSk)
              .input('location', mssql.NVarChar(100), item.location)
              .input('province', mssql.NVarChar(10), item.province)
              .input('type', mssql.NVarChar(10), item.type || null)
              .input('fuelGrade', mssql.NVarChar(10), item.fuelGrade || null)
              .query(`
                UPDATE [FUEL].[Stg_Station_Discounts] 
                SET [Discounts] = @discountVal, [Updated_At] = NULL, [Schedule_Effective_From] = NULL 
                WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
                  AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
                  AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
                  AND [Schedule_Effective_From] IS NULL
              `);
          } else {
            // Custom Scheduled Update using the provided effective target date input
            const stgScheduledUpdate = new mssql.Request(transaction);
            await stgScheduledUpdate
              .input('discountVal', mssql.Decimal(18, 4), discountVal)
              .input('effDate', mssql.Date, scheduleEffectiveDate) // e.g., '2026-07-15'
              .input('stationSk', mssql.NVarChar(20), item.stationSk)
              .input('location', mssql.NVarChar(100), item.location)
              .input('province', mssql.NVarChar(10), item.province)
              .input('type', mssql.NVarChar(10), item.type || null)
              .input('fuelGrade', mssql.NVarChar(10), item.fuelGrade || null)
              .query(`
                UPDATE [FUEL].[Stg_Station_Discounts] 
                SET [Discounts] = @discountVal, [Updated_At] = GETDATE(), [Schedule_Effective_From] = @effDate 
                WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
                  AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
                  AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
              `);
          }
        }
      }

      await transaction.commit();
      return res.status(200).json({ message: "Station batch structural state manipulation executed successfully." });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error("Station Discount Batch configuration route failure:", error);
    return res.status(500).json({ error: "Failed to apply batch modification parameters." });
  }
});

// 4. PUT ROUTE - Update specific existing scheduled date directly
router.put('/station-discounts/reschedule-single', async (req, res) => {
  const { stationSk, location, province, type, fuelGrade, newScheduleDate } = req.body;
  
  if (!newScheduleDate) {
    return res.status(400).json({ error: "A valid new schedule date parameter is required." });
  }

  let pool;
  try {
    // console.log("Rescheduling single station discount record with parameters:", { stationSk, location, province, type, fuelGrade, newScheduleDate });
    const mssql = require('mssql');
    pool = await getPool();

    const request = new mssql.Request(pool);
    await request
      .input('newDate', mssql.Date, newScheduleDate)
      .input('stationSk', mssql.NVarChar(20), stationSk)
      .input('location', mssql.NVarChar(100), location)
      .input('province', mssql.NVarChar(10), province)
      .input('type', mssql.NVarChar(10), type || null)
      .input('fuelGrade', mssql.NVarChar(10), fuelGrade || null)
      .query(`
        UPDATE [FUEL].[Stg_Station_Discounts]
        SET [Schedule_Effective_From] = @newDate, [Updated_At] = GETDATE()
        WHERE [Station_SK] = @stationSk AND [Location] = @location AND [Province] = @province
          AND ([Type] = @type OR ([Type] IS NULL AND @type IS NULL))
          AND ([Fuel_Grade] = @fuelGrade OR ([Fuel_Grade] IS NULL AND @fuelGrade IS NULL))
      `);

    return res.status(200).json({ message: "Staging pipeline execution date reassigned successfully." });
  } catch (error) {
    console.error("Reschedule Single Row configuration failure:", error);
    return res.status(500).json({ error: "Failed to update target schedule configuration." });
  }
});

module.exports = router;