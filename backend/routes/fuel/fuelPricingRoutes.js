const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const User = require("../../models/User");         // Ensure correct path to your User model
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

router.get('/check-pending-verification', async (req, res) => {
  const db = getPg();
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res.status(401).json({ message: "Unauthorized user session context." });
  }

  try {
    const locationDoc = await Location.findOne({
      $or: [
        { email: userEmail },
        { managerEmails: userEmail }
      ]
    });

    if (!locationDoc) {
      return res.status(200).json({ requiresVerification: false });
    }

    const locationMongoId = String(locationDoc._id);

    // 1. Look for any log rows created in the last 6 hours that are missing an image url
    const unverifiedLogs = await db('fuel_price_logs')
      .where({ site: locationMongoId })
      .whereNull('image_url')
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '6 hours'"))
      .orderBy('id', 'asc');

    // If there are no unverified structural logs in the last 6 hours, 
    // it means any recent action was completely unchanged, so we clear the dialog box!
    if (!unverifiedLogs || unverifiedLogs.length === 0) {
      return res.status(200).json({ requiresVerification: false });
    }

    // 2. Reconstruct the accurate delta state from those active unverified rows
    const unverifiedGradesMap = unverifiedLogs.reduce((acc, log) => {
      const frontendKey = Object.keys(GRADE_MAP).find(key => GRADE_MAP[key] === log.grade) || log.grade;
      acc[frontendKey] = parseFloat(log.price);
      return acc;
    }, {});

    const currentPrices = await currentPriceModel.getCurrentPricesBySite(locationMongoId);
    const changedGrades = [];
    const unchangedGrades = [];

    // 3. Re-hydrate the full 5 grades accurately for display matching
    for (const r of currentPrices) {
      const frontendKey = Object.keys(GRADE_MAP).find(key => GRADE_MAP[key] === r.grade) || r.grade;
      const currentPriceNum = parseFloat(r.price);
      const wasChanged = unverifiedGradesMap[frontendKey] !== undefined;

      // Pull the old price by checking the log row right before our unverified change row
      let exactOldPrice = currentPriceNum;
      if (wasChanged) {
        const previousLog = await db('fuel_price_logs')
          .where({ site: locationMongoId, grade: r.grade })
          .whereNotNull('image_url') // Find the last confirmed baseline price
          .orderBy('id', 'desc')
          .first();
        if (previousLog) exactOldPrice = parseFloat(previousLog.price);
      }

      const itemPayload = {
        gradeId: frontendKey,
        label: frontendKey,
        newPrice: currentPriceNum,
        oldPrice: exactOldPrice
      };

      if (wasChanged) {
        changedGrades.push(itemPayload);
      } else {
        unchangedGrades.push(itemPayload);
      }
    }

    return res.status(200).json({
      requiresVerification: true,
      payload: {
        stationName: locationDoc.stationName,
        locationId: locationMongoId,
        changedGrades: changedGrades,
        unchangedGrades: unchangedGrades,
        hasStructuralChanges: changedGrades.length > 0
      }
    });

  } catch (err) {
    console.error("Failed checkpoint state validation sequence:", err);
    return res.status(500).json({ message: "Internal verification engine failure." });
  }
});

router.put('/verify-price-receipt', async (req, res) => {
  const db = getPg();
  const userEmail = req.user?.email;
  const { locationId, filename } = req.body;

  if (!userEmail || !locationId || !filename) {
    return res.status(400).json({ message: "Missing required verification data coordinates." });
  }

  try {
    // Target rows for this site missing an image, strictly within a 6-hour safety buffer
    const updatedRows = await db('fuel_price_logs')
      .where({ site: locationId })
      .whereNull('image_url') 
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '6 hours'"))
      .update({
        image_url: filename
      });

    console.log(`⛽ Safe Audit Update Complete. Site: ${locationId} | Rows Filled: ${updatedRows} within 6hr window.`);

    return res.status(200).json({ 
      success: true, 
      message: `Successfully verified and locked ${updatedRows} fuel grade rows.` 
    });
  } catch (err) {
    console.error("Critical failure during batch log image linking:", err);
    return res.status(500).json({ message: "Failed to persist terminal verification asset." });
  }
});

// =========================================================================
// UPSERT WITH DELTA CHANGE-DETECTION CONSTRAINT
// =========================================================================
router.post('/upsert-retail', async (req, res) => {
  const { locationId, stationName, prices } = req.body;
  const db = getPg();

  if (!locationId || !prices) {
    return res.status(400).json({ message: "Missing location identification parameters." });
  }

  const now = new Date();
  const dateSK = parseInt(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`, 10);
  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  try {
    const locationDoc = await Location.findById(locationId);
    if (!locationDoc) {
      return res.status(404).json({ message: "Target location context not found." });
    }

    const criticalEmails = [locationDoc.email, ...(locationDoc.managerEmails || [])].filter(Boolean);
    const targetedUsers = await User.find({ email: { $in: criticalEmails } }, "_id email");
    const uniqueUserIds = targetedUsers.map(u => String(u._id));

    // Get the complete current state of all grades for this site
    const existingRows = await currentPriceModel.getCurrentPricesBySite(locationId);
    
    const changedGradesList = [];
    const unchangedGradesList = [];
    let databaseWritesExecutedCount = 0;

    await db.transaction(async (trx) => {
      // Loop through all globally known grades for this site rather than just the req.body snippet
      for (const row of existingRows) {
        // Find if this grade has a matching code in the display lookup mapping map
        const frontendCode = Object.keys(GRADE_MAP).find(key => GRADE_MAP[key] === row.grade) || row.grade;
        
        const currentDbPrice = parseFloat(row.price);
        // Look up what price was sent in the request body. If not provided, fall back to current price
        const targetPriceRaw = prices[frontendCode];
        const parsedTargetPrice = targetPriceRaw !== undefined && targetPriceRaw !== null ? parseFloat(targetPriceRaw) : currentDbPrice;

        const itemStatePayload = {
          gradeId: frontendCode,
          label: frontendCode,
          oldPrice: currentDbPrice,
          newPrice: parsedTargetPrice
        };

        // Delta Engine validation
        if (currentDbPrice === parsedTargetPrice) {
          unchangedGradesList.push(itemStatePayload);
        } else {
          databaseWritesExecutedCount++;
          changedGradesList.push(itemStatePayload);

          // Write changes to current prices ledger
          await currentPriceModel.upsertCurrentPrice({
            site: locationId,
            grade: row.grade,
            price: parsedTargetPrice
          });

          // Write changes to log tracking audit sheet
          await logsModel.createLog({
            date: dateSK,
            day: currentDayName,
            site: locationId,
            grade: row.grade,
            price: parsedTargetPrice,
            image_url: null
          });
        }
      }
    });

    // BROADCAST PIPELINE: This payload will now ALWAYS contain the full 5 grades
    const io = req.app.get("io");
    if (io && uniqueUserIds.length > 0) {
      const socketPayload = {
        stationName: stationName,
        locationId: locationId,
        changedGrades: changedGradesList,
        unchangedGrades: unchangedGradesList,
        hasStructuralChanges: changedGradesList.length > 0
      };

      uniqueUserIds.forEach((userId) => {
        io.to(userId).emit("retail-price-published", socketPayload);
      });
    }

    return res.status(200).json({
      success: true,
      updatesApplied: databaseWritesExecutedCount,
      notifiedUserCount: uniqueUserIds.length
    });

  } catch (err) {
    console.error("Transaction Pipeline Failed:", err);
    return res.status(500).json({ message: "Persistence layer failure." });
  }
});

module.exports = router;