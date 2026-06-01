const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const { getFuelPricingDate, getFuelSupplierDiscounts, getPool } = require('../../services/sqlService');

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

      // Extract and normalize the current row's timestamp
      const rowUpdatedAt = row['UpdatedAt'] ? new Date(row['UpdatedAt']) : null;

      if (!pricingMap[cso][grade]) {
        pricingMap[cso][grade] = {
          // Initialize with the current row's timestamp
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
        // --- LATEST TIMESTAMP TRACKING LOGIC ---
        // If the grade object exists, check if this sibling row has a more recent timestamp
        if (rowUpdatedAt) {
          const existingUpdatedAt = pricingMap[cso][grade].updatedAt
            ? new Date(pricingMap[cso][grade].updatedAt)
            : null;

          if (!existingUpdatedAt || rowUpdatedAt > existingUpdatedAt) {
            pricingMap[cso][grade].updatedAt = rowUpdatedAt.toISOString();
          }
        }
      }

      // Append competitor entry only if it contains actual data (not NULL/empty)
      if (row.Competitor && String(row.Competitor).trim().toUpperCase() !== 'NULL') {
        const compTypeRaw = row['Competitor Type'] != null ? String(row['Competitor Type']).trim() : '';

        let assignedType = 'City Area'; // Fallback
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

// 1. GET ROUTE: Fetch Supplier Discounts
router.get('/supplier-discounts', async (req, res) => {
  try {
    const discounts = await getFuelSupplierDiscounts();
    return res.status(200).json(discounts);
  } catch (error) {
    console.error("Error fetching supplier discounts:", error);
    return res.status(500).json({ error: "Failed to fetch supplier discounts." });
  }
});

// 3. POST ROUTE: Batch Create New Entries with Default Deleted At Timestamp
router.post('/supplier-discounts/batch', async (req, res) => {
  const { entries } = req.body;
  // entries: Array of { supplierCode, supplierItem, inventoryItem, discounts }

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
        const insertRequest = new mssql.Request(transaction);
        await insertRequest
          .input('supCode', mssql.VarChar, entry.supplierCode)
          .input('supItem', mssql.VarChar, entry.supplierItem)
          .input('invItem', mssql.VarChar, entry.inventoryItem)
          .input('discountVal', mssql.Float, parseFloat(entry.discounts))
          .query(`
            INSERT INTO [FUEL].[TEST_SupplierDiscounts] (
              [Supplier Code], 
              [ Supplier Item], 
              [Inventory Item], 
              [Discounts], 
              [Created At], 
              [Updated At],
              [Deleted At]
            ) VALUES (
              @supCode, 
              @supItem, 
              @invItem, 
              @discountVal, 
              GETDATE(), 
              GETDATE(),
              '1900-01-01 00:00:00.000'
            )
          `);
      }

      await transaction.commit();
      return res.status(200).json({ message: "Batch items successfully populated into primary tables." });

    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

  } catch (error) {
    console.error("Batch insertion failed execution:", error);
    return res.status(500).json({ error: "Failed to create new supplier records." });
  }
});

// 2. PUT ROUTE: Batch Execute Staged Updates and Deletions
router.put('/supplier-discounts/batch', async (req, res) => {
  const { updates, deletions } = req.body;
  // updates: Array of { supplierCode, supplierItem, inventoryItem, discounts }
  // deletions: Array of { supplierCode, supplierItem, inventoryItem }

  let pool;
  try {
    const mssql = require('mssql'); // Ensure mssql is accessible
    pool = await getPool();

    // Create an atomic transaction so everything succeeds or fails together
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      // A. Process Batch Deletions
      if (deletions && deletions.length > 0) {
        for (const item of deletions) {
          const deleteRequest = new mssql.Request(transaction);
          await deleteRequest
            .input('supCode', mssql.VarChar, item.supplierCode)
            .input('supItem', mssql.VarChar, item.supplierItem)
            .input('invItem', mssql.VarChar, item.inventoryItem)
            .query(`
              DELETE FROM [FUEL].[TEST_SupplierDiscounts]
              WHERE [Supplier Code] = @supCode 
                AND [ Supplier Item] = @supItem 
                AND [Inventory Item] = @invItem
            `);
        }
      }

      // B. Process Batch Updates
      if (updates && updates.length > 0) {
        for (const item of updates) {
          const updateRequest = new mssql.Request(transaction);
          await updateRequest
            .input('discountVal', mssql.Float, parseFloat(item.discounts))
            .input('supCode', mssql.VarChar, item.supplierCode)
            .input('supItem', mssql.VarChar, item.supplierItem)
            .input('invItem', mssql.VarChar, item.inventoryItem)
            .query(`
              UPDATE [FUEL].[TEST_SupplierDiscounts]
              SET [Discounts] = @discountVal,
                  [Updated At] = GETDATE()
              WHERE [Supplier Code] = @supCode 
                AND [ Supplier Item] = @supItem 
                AND [Inventory Item] = @invItem
            `);
        }
      }

      // Commit the changes to Azure SQL
      await transaction.commit();
      return res.status(200).json({ message: "All modifications synchronized successfully." });

    } catch (txError) {
      // Rollback database modifications if any query fails
      await transaction.rollback();
      throw txError;
    }

  } catch (error) {
    console.error("Batch update failed execution:", error);
    return res.status(500).json({ error: "Failed to execute database batch operations." });
  }
});

module.exports = router;