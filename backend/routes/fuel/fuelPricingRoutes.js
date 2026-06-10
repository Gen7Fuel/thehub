const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const User = require("../../models/User");         // Ensure correct path to your User model
const { getFuelPricingDate } = require('../../services/sqlService');
const { getPg } = require("../../config/pg");
const { priceTimeoutQueue } = require('../../queues/priceTimeoutQueue');
const { emailQueue } = require('../../queues/emailQueue'); // Import emailQueue for the immediate notification

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

router.get('/prices-ticker', async (req, res) => {
  try {
    const db = getPg();

    // 1. Fetch all current active records from PostgreSQL first
    const currentPrices = await db('fuel_current_price')
      .orderBy('site')
      .orderBy('grade');

    if (!currentPrices || currentPrices.length === 0) {
      return res.json([]);
    }

    // Extract unique site IDs present in the pricing dataset
    const uniqueSiteIds = [...new Set(currentPrices.map(row => row.site))];

    // 2. Query MongoDB ONLY for these active sites, making sure type is "store"
    const locations = await Location.find(
      {
        _id: { $in: uniqueSiteIds },
        type: "store"
      },
      '_id stationName'
    );

    // Map Mongo object IDs to their real station names for quick lookup
    const locationNameMap = {};
    locations.forEach(loc => {
      locationNameMap[loc._id.toString()] = loc.stationName;
    });

    // 3. Group fuel metrics by station name, filtering out any records without a resolved store name
    const groupedTickerData = {};

    currentPrices.forEach(row => {
      const resolvedStationName = locationNameMap[row.site];

      // If the location ID didn't match a type: "store" document in Mongo, exclude it
      if (!resolvedStationName) return;

      if (!groupedTickerData[resolvedStationName]) {
        groupedTickerData[resolvedStationName] = [];
      }

      groupedTickerData[resolvedStationName].push({
        grade: row.grade,
        price: parseFloat(row.price).toFixed(3),
        updatedAt: row.updated_at
      });
    });

    // 4. Flatten the dictionary into the iterable list structure your frontend ticker expects
    const resultPayload = Object.entries(groupedTickerData).map(([name, grades]) => ({
      stationName: name,
      grades: grades
    }));

    return res.status(200).json(resultPayload);

  } catch (err) {
    console.error("Failed compiling global pricing marquee data from reversed flow:", err);
    return res.status(500).json({ message: "Ticker data aggregation breakdown." });
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

    // 1. Look for any log rows created in the last 6 hours that are missing EITHER the Bulloch or InfoNet image URL
    const unverifiedLogs = await db('fuel_price_logs')
      .where({ site: locationMongoId })
      .andWhere((builder) => {
        builder.whereNull('image_url').orWhereNull('infonet_image_url');
      })
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
          .whereNotNull('image_url')
          .whereNotNull('infonet_image_url') // Find the last confirmed baseline price with BOTH images
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
  const userIdStr = req.user?._id ? String(req.user._id) : null;
  const { locationId, filename, infonetFilename } = req.body;

  if (!userEmail || !locationId || !filename || !infonetFilename) {
    return res.status(400).json({ message: "Missing required verification data coordinates." });
  }

  try {
    // Target rows for this site missing EITHER image, strictly within a 6-hour safety buffer
    const updatedRows = await db('fuel_price_logs')
      .where({ site: locationId })
      .andWhere((builder) => {
        builder.whereNull('image_url').orWhereNull('infonet_image_url');
      })
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '6 hours'"))
      .update({
        image_url: filename,
        infonet_image_url: infonetFilename,
        received_by: userIdStr,
        updated_at: db.raw('CURRENT_TIMESTAMP')
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
  const postedByUserIdStr = req.user?._id ? String(req.user._id) : null;
  const userEmail = req.user?.email;

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

          // Write changes to current prices ledger with user tracking attributes
          await currentPriceModel.upsertCurrentPrice({
            site: locationId,
            grade: row.grade,
            price: parsedTargetPrice,
            last_updated_by: postedByUserIdStr
          });

          // Write changes to log tracking audit sheet with user tracking attributes
          await logsModel.createLog({
            date: dateSK,
            day: currentDayName,
            site: locationId,
            grade: row.grade,
            price: parsedTargetPrice,
            image_url: null,
            infonet_image_url: null,
            posted_by: postedByUserIdStr
          });
        }
      }
    });

    // -------------------------------------------------------------------------
    // DISPATCH NOTIFICATIONS & TIMER ON CHANGES DETECTED
    // -------------------------------------------------------------------------
    if (databaseWritesExecutedCount > 0) {
      const storeEmail = locationDoc.email;
      const targetStationName = stationName || locationDoc.stationName;

      // Dynamically compile CC targets (Manager emails + user session context email)
      const baseCCEmails = Array.isArray(locationDoc.managerEmails) ? [...locationDoc.managerEmails] : [];
      if (userEmail && !baseCCEmails.includes(userEmail)) {
        baseCCEmails.push(userEmail);
      }

      // 1. Send IMMEDIATE general update alert to store, copying managers & admin
      const initialNoticeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #14532d; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
              🔔 Notice: Fuel Prices Updated
            </h2>
            <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              New retail prices have just been published for your station location. Please update your system registers immediately.
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${targetStationName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #16a34a; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Please log into the Gen7 Fuel Hub on your station account, finalize the price adjustments on your physical point-of-sale registers, and upload the required Bulloch and InfoNet receipt imagery to complete the audit cycle.
          </p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated operational tracking notification — Gen 7 Fuel Hub System.
            </span>
          </div>
        </div>
      `;

      await emailQueue.add(`immediate-price-notice-${locationId}-${Date.now()}`, {
        to: storeEmail,
        cc: baseCCEmails,
        subject: `⛽ Notification: New Fuel Prices Published - ${targetStationName}`,
        html: initialNoticeHtml
      });
      console.log(`📧 Immediate update notification queued into BullMQ for ${targetStationName}.`);

      // 2. WATCHDOG DELAYED TIMER PIPELINE (BULLMQ)

      // Array of corporate managers / admins to loop into CC
      // const adminCCEmails = Array.isArray(locationDoc.managerEmails)
      //   ? [...locationDoc.managerEmails, userEmail, "daksh@gen7fuel.com", "kell@gen7fuel.com"]
      //   : [userEmail, "daksh@gen7fuel.com", "kell@gen7fuel.com"];
      const adminCCEmails = Array.isArray(locationDoc.managerEmails)
        ? [...locationDoc.managerEmails, "daksh@gen7fuel.com"]
        : ["daksh@gen7fuel.com"];

      await priceTimeoutQueue.add(
        `timeout-check-${locationId}-${Date.now()}`,
        {
          locationId: locationId,
          stationName: targetStationName,
          toEmail: storeEmail,        // Direct recipient
          ccEmails: adminCCEmails     // Copied recipients
        },
        {
          delay: 15 * 60 * 1000, // 15-Minute wait window
          removeOnComplete: true,
          removeOnFail: true
        }
      );
      console.log(`⏱️ BullMQ Watchdog Scheduled: 15-min validation track initialized for ${targetStationName}.`);
    }

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