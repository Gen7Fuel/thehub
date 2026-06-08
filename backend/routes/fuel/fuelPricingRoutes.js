const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const { getFuelPricingDate } = require('../../services/sqlService');
const { getPg } = require("../../config/pg");

// Import your custom model layer functions to keep routes lean
const currentPriceModel = require("../../pg/models/fuelCurrentPrice");
const logsModel = require("../../pg/models/fuelPriceLog");

// Bi-directional dictionary to map Frontend Short Codes <-> Database Strings
const GRADE_MAP = {
  'REG': 'Regular',
  'MID': 'Mid Grade',
  'PNL': 'Premium',
  'DSL': 'Diesel',
  'DYED': 'Dyed Diesel'
};

// Reverse map for incoming database rows (e.g., 'Regular' -> 'REG')
const REVERSE_GRADE_MAP = Object.fromEntries(
  Object.entries(GRADE_MAP).map(([key, value]) => [value, key])
);

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
// RETRIEVE CURRENT ACTIVE PRICE CONFIGURATIONS BY MONGO ID
// =========================================================================
router.get('/current/:locationId', async (req, res) => {
  const { locationId } = req.params;
  try {
    const rows = await currentPriceModel.getCurrentPricesBySite(locationId);

    // Return both the numeric price AND raw updated_at string for timezone conversion
    const activeCurrentPrices = rows.reduce((acc, row) => {
      const frontendCode = REVERSE_GRADE_MAP[row.grade];
      if (frontendCode) {
        acc[frontendCode] = {
          price: parseFloat(row.price),
          updatedAt: row.updated_at
        };
      }
      return acc;
    }, {});

    res.status(200).json(activeCurrentPrices);
  } catch (err) {
    console.error("Failed to query Postgres entries by locationId:", err);
    res.status(500).json({ message: "Internal record lookup failure." });
  }
});

// =========================================================================
// UPSERT WITH DELTA CHANGE-DETECTION CONSTRAINT
// =========================================================================
router.post('/upsert-retail', async (req, res) => {
  const { locationId, stationName, prices } = req.body;
  const db = getPg();

  if (!locationId || !prices || Object.keys(prices).length === 0) {
    return res.status(400).json({ message: "Missing location identification or price payload parameters." });
  }

  const now = new Date();
  const dateSK = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`, 10);
  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  try {
    // 1. Pre-fetch existing state configurations to evaluate incoming deltas
    const existingRows = await currentPriceModel.getCurrentPricesBySite(locationId);
    const existingPricesMap = existingRows.reduce((acc, r) => {
      acc[r.grade] = parseFloat(r.price);
      return acc;
    }, {});

    let databaseWritesExecutedCount = 0;

    await db.transaction(async (trx) => {
      for (const [frontendCode, targetPrice] of Object.entries(prices)) {
        if (targetPrice === null || targetPrice === undefined) continue;

        const dbGradeString = GRADE_MAP[frontendCode];
        if (!dbGradeString) continue;

        // 2. DELTA CHECK: Compare precision float values. If unchanged, bypass operations
        const currentDbPrice = existingPricesMap[dbGradeString];
        if (currentDbPrice !== undefined && currentDbPrice === targetPrice) {
          continue;
        }

        databaseWritesExecutedCount++;

        // 3. Commit only if a structural modification occurred
        await currentPriceModel.upsertCurrentPrice({
          site: locationId,
          grade: dbGradeString,
          price: targetPrice
        });

        await logsModel.createLog({
          date: dateSK,
          day: currentDayName,
          site: locationId,
          grade: dbGradeString,
          price: targetPrice,
          image_url: null
        });
      }
    });

    console.log(`Updates committed to storage: ${databaseWritesExecutedCount} grades updated for ${stationName}.`);
    res.status(200).json({ success: true, updatesApplied: databaseWritesExecutedCount });

  } catch (err) {
    console.error(`Transaction Pipeline Failed while updating retail prices for ${stationName}:`, err);
    res.status(500).json({ message: "Persistence layer operational pipeline failure." });
  }
});

module.exports = router;