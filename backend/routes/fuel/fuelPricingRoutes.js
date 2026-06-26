const express = require("express");
const router = express.Router();
const Location = require("../../models/Location");
const moment = require("moment-timezone");
const User = require("../../models/User"); // Ensure correct path to your User model
const { getFuelPricingDate } = require("../../services/sqlService");
const { getPg } = require("../../config/pg");
const { priceTimeoutQueue } = require("../../queues/priceTimeoutQueue");
const { priceScheduleQueue } = require("../../queues/priceScheduleQueue");
const { gasBuddyQueue } = require("../../queues/gasBuddyQueue");
const { emailQueue } = require("../../queues/emailQueue"); // Import emailQueue for the immediate notification
const { calculateCustomRecPrice } = require("../../utils/fuelPriceRecLogic");
const {
  executeRetailPriceUpdate,
} = require("../../services/pricingCoreService");
const { SITES_WITHOUT_INFONET } = require("../../services/pricingCoreService");
const { GRADE_MAP } = require("../../services/pricingCoreService");
// Import your custom model layer functions to keep routes lean
const currentPriceModel = require("../../pg/models/fuelCurrentPrice");
const logsModel = require("../../pg/models/fuelPriceLog");

// Reverse map for incoming database rows (e.g., 'Regular' -> 'REG')
const REVERSE_GRADE_MAP = Object.fromEntries(
  Object.entries(GRADE_MAP).map(([key, value]) => [value, key]),
);

// =========================================================================
// 1. PRIMARY FUEL PRICING GRID DASHBOARD ROUTE
// =========================================================================
// router.get('/', async (req, res) => {
//   try {
//     const stores = await Location.find({ type: 'store' }).lean();
//     if (!stores.length) {
//       return res.status(200).json({ stations: [], pricingData: {} });
//     }

//     let dateSK = req.query.date;
//     if (!dateSK) {
//       const today = new Date();
//       const yyyy = today.getFullYear();
//       const mm = String(today.getMonth() + 1).padStart(2, '0');
//       const dd = String(today.getDate()).padStart(2, '0');
//       dateSK = `${yyyy}${mm}${dd}`;
//     }

//     const sqlResult = await getFuelPricingDate(dateSK);
//     const rows = sqlResult.recordset || [];

//     const pricingMap = {};

//     rows.forEach(row => {
//       const cso = row.Station_SK != null ? String(row.Station_SK).trim() : null;
//       const grade = row.Type != null ? String(row.Type).trim() : null;

//       if (!cso || !grade) return;
//       if (!pricingMap[cso]) pricingMap[cso] = {};

//       const rowUpdatedAt = row['UpdatedAt'] ? new Date(row['UpdatedAt']) : null;

//       if (!pricingMap[cso][grade]) {
//         pricingMap[cso][grade] = {
//           updatedAt: rowUpdatedAt ? rowUpdatedAt.toISOString() : null,
//           metrics: {
//             landedCost: row['Landed Cost'],
//             prevLandedCost: row['T-1 Landed Cost'],
//             rackPrice: row["Today's Rack"],
//             prevRackPrice: row["T-1's Rack"],
//             recPrice: row['Rec Price'],
//             low: row['Low'],
//             prevLow: row['T-1 Low'],
//             avg: row['Avg'],
//             prevAvg: row['T-1 Avg'],
//             high: row['High'],
//             prevHigh: row['T-1 High'],
//           },
//           competitors: []
//         };
//       } else {
//         if (rowUpdatedAt) {
//           const existingUpdatedAt = pricingMap[cso][grade].updatedAt
//             ? new Date(pricingMap[cso][grade].updatedAt)
//             : null;

//           if (!existingUpdatedAt || rowUpdatedAt > existingUpdatedAt) {
//             pricingMap[cso][grade].updatedAt = rowUpdatedAt.toISOString();
//           }
//         }
//       }

//       if (row.Competitor && String(row.Competitor).trim().toUpperCase() !== 'NULL') {
//         const compTypeRaw = row['Competitor Type'] != null ? String(row['Competitor Type']).trim() : '';

//         let assignedType = 'City Area';
//         if (compTypeRaw === 'Local Reserve') {
//           assignedType = 'Reserve Area';
//         } else if (compTypeRaw === 'Local City') {
//           assignedType = 'City Area';
//         }

//         pricingMap[cso][grade].competitors.push({
//           type: assignedType,
//           name: String(row.Competitor).trim(),
//           address: row['Competitor Address'] != null && String(row['Competitor Address']).toUpperCase() !== 'NULL'
//             ? String(row['Competitor Address']).trim()
//             : 'N/A',
//           price: row['Competitor Price'],
//           updatedDate: row['C_Updated Date'] && String(row['C_Updated Date']).toUpperCase() !== 'NULL' ? row['C_Updated Date'] : 'N/A',
//           updatedTime: row['C_Updated Time'] && String(row['C_Updated Time']).toUpperCase() !== 'NULL' ? row['C_Updated Time'] : 'N/A'
//         });
//       }
//     });

//     return res.status(200).json({
//       stations: stores.map(s => ({
//         csoCode: s.csoCode,
//         stationName: s.stationName,
//         address: s.address
//       })),
//       pricingData: pricingMap
//     });

//   } catch (error) {
//     console.error("Error processing fuel pricing metrics:", error);
//     return res.status(500).json({ error: "Internal server error assembly failed." });
//   }
// });
// =========================================================================
// 1. PRIMARY FUEL PRICING GRID DASHBOARD ROUTE
// =========================================================================
router.get("/", async (req, res) => {
  try {
    const stores = await Location.find({ type: "store" }).lean();
    if (!stores.length) {
      return res.status(200).json({ stations: [], pricingData: {} });
    }

    let dateSK = req.query.date;
    if (!dateSK) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      dateSK = `${yyyy}${mm}${dd}`;
    }

    const sqlResult = await getFuelPricingDate(dateSK);
    const rows = sqlResult.recordset || [];

    // First group all raw rows cleanly by Station_SK -> Fuel Grade
    const rawGroupedMap = {};
    rows.forEach((row) => {
      const cso = row.Station_SK != null ? String(row.Station_SK).trim() : null;
      const grade = row.Type != null ? String(row.Type).trim() : null;
      if (!cso || !grade) return;

      if (!rawGroupedMap[cso]) rawGroupedMap[cso] = {};
      if (!rawGroupedMap[cso][grade]) rawGroupedMap[cso][grade] = [];
      rawGroupedMap[cso][grade].push(row);
    });

    const pricingMap = {};

    // Standard loop to assemble your baseline dashboard pricing schema payload
    rows.forEach((row) => {
      const cso = row.Station_SK != null ? String(row.Station_SK).trim() : null;
      const grade = row.Type != null ? String(row.Type).trim() : null;

      if (!cso || !grade) return;
      if (!pricingMap[cso]) pricingMap[cso] = {};

      const rowUpdatedAt = row["UpdatedAt"] ? new Date(row["UpdatedAt"]) : null;

      if (!pricingMap[cso][grade]) {
        // Calculate the dynamic recommended price overrides using our row collection rules
        const customPriceResult = calculateCustomRecPrice(
          cso,
          grade,
          rawGroupedMap[cso][grade],
        );

        pricingMap[cso][grade] = {
          updatedAt: rowUpdatedAt ? rowUpdatedAt.toISOString() : null,
          metrics: {
            landedCost: row["Landed Cost"],
            prevLandedCost: row["T-1 Landed Cost"],
            rackPrice: row["Today's Rack"],
            prevRackPrice: row["T-1's Rack"],
            // Use dynamic override value; if it results in null, gracefully fall back to the DB default 'Rec Price'
            recPrice:
              customPriceResult.recPrice !== null
                ? customPriceResult.recPrice
                : row["Rec Price"],
            priceExplanation: customPriceResult.explanation,
            low: row["Low"],
            prevLow: row["T-1 Low"],
            avg: row["Avg"],
            prevAvg: row["T-1 Avg"],
            high: row["High"],
            prevHigh: row["T-1 High"],
          },
          competitors: [],
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

      if (
        row.Competitor &&
        String(row.Competitor).trim().toUpperCase() !== "NULL"
      ) {
        const compTypeRaw =
          row["Competitor Type"] != null
            ? String(row["Competitor Type"]).trim()
            : "";

        let assignedType = "City Area";
        if (compTypeRaw === "Local Reserve") {
          assignedType = "Reserve Area";
        } else if (compTypeRaw === "Local City") {
          assignedType = "City Area";
        }

        pricingMap[cso][grade].competitors.push({
          type: assignedType,
          name: String(row.Competitor).trim(),
          address:
            row["Competitor Address"] != null &&
            String(row["Competitor Address"]).toUpperCase() !== "NULL"
              ? String(row["Competitor Address"]).trim()
              : "N/A",
          price: row["Competitor Price"],
          updatedDate:
            row["C_Updated Date"] &&
            String(row["C_Updated Date"]).toUpperCase() !== "NULL"
              ? row["C_Updated Date"]
              : "N/A",
          updatedTime:
            row["C_Updated Time"] &&
            String(row["C_Updated Time"]).toUpperCase() !== "NULL"
              ? row["C_Updated Time"]
              : "N/A",
        });
      }
    });

    return res.status(200).json({
      stations: stores.map((s) => ({
        csoCode: s.csoCode,
        stationName: s.stationName,
        address: s.address,
      })),
      pricingData: pricingMap,
    });
  } catch (error) {
    console.error("Error processing fuel pricing metrics:", error);
    return res
      .status(500)
      .json({ error: "Internal server error assembly failed." });
  }
});

router.get("/prices-ticker", async (req, res) => {
  try {
    const db = getPg();

    // 1. Fetch all current active records from PostgreSQL first
    const currentPrices = await db("fuel_current_price")
      .orderBy("site")
      .orderBy("grade");

    if (!currentPrices || currentPrices.length === 0) {
      return res.json([]);
    }

    // Extract unique site IDs present in the pricing dataset
    const uniqueSiteIds = [...new Set(currentPrices.map((row) => row.site))];

    // 2. Query MongoDB ONLY for these active sites, making sure type is "store"
    const locations = await Location.find(
      {
        _id: { $in: uniqueSiteIds },
        type: "store",
      },
      "_id stationName",
    );

    // Map Mongo object IDs to their real station names for quick lookup
    const locationNameMap = {};
    locations.forEach((loc) => {
      locationNameMap[loc._id.toString()] = loc.stationName;
    });

    // 3. Group fuel metrics by station name, filtering out any records without a resolved store name
    const groupedTickerData = {};

    currentPrices.forEach((row) => {
      const resolvedStationName = locationNameMap[row.site];

      // If the location ID didn't match a type: "store" document in Mongo, exclude it
      if (!resolvedStationName) return;

      if (!groupedTickerData[resolvedStationName]) {
        groupedTickerData[resolvedStationName] = [];
      }

      groupedTickerData[resolvedStationName].push({
        grade: row.grade,
        price: parseFloat(row.price).toFixed(3),
        updatedAt: row.updated_at,
      });
    });

    // 4. Flatten the dictionary into the iterable list structure your frontend ticker expects
    const resultPayload = Object.entries(groupedTickerData).map(
      ([name, grades]) => ({
        stationName: name,
        grades: grades,
      }),
    );

    return res.status(200).json(resultPayload);
  } catch (err) {
    console.error(
      "Failed compiling global pricing marquee data from reversed flow:",
      err,
    );
    return res
      .status(500)
      .json({ message: "Ticker data aggregation breakdown." });
  }
});

// // =========================================================================
// // RETRIEVE CURRENT ACTIVE PRICE CONFIGURATIONS BY MONGO ID
// // =========================================================================
// router.get("/current/:locationId", async (req, res) => {
//   const { locationId } = req.params;
//   try {
//     const rows = await currentPriceModel.getCurrentPricesBySite(locationId);

//     // Return both the numeric price AND raw updated_at string for timezone conversion
//     const activeCurrentPrices = rows.reduce((acc, row) => {
//       const frontendCode = REVERSE_GRADE_MAP[row.grade];
//       if (frontendCode) {
//         acc[frontendCode] = {
//           price: parseFloat(row.price),
//           updatedAt: row.updated_at,
//         };
//       }
//       return acc;
//     }, {});

//     res.status(200).json(activeCurrentPrices);
//   } catch (err) {
//     console.error("Failed to query Postgres entries by locationId:", err);
//     res.status(500).json({ message: "Internal record lookup failure." });
//   }
// });
// =========================================================================
// RETRIEVE CURRENT ACTIVE PRICE CONFIGURATIONS BY MONGO ID (WITH SCHEDULES)
// =========================================================================
router.get("/current/:locationId", async (req, res) => {
  const { locationId } = req.params;
  try {
    const rows = await currentPriceModel.getCurrentPricesBySite(locationId);

    // Group rows by active vs scheduled status
    const activeCurrentPrices = rows.reduce((acc, row) => {
      const frontendCode = REVERSE_GRADE_MAP[row.grade];
      if (!frontendCode) return acc;

      // Initialize the object container for this fuel grade if not present
      if (!acc[frontendCode]) {
        acc[frontendCode] = {
          price: null,
          updatedAt: null,
          scheduled: null
        };
      }

      // Check if this record is a future scheduled price change
      // (Assumes your model/query flags rows, e.g., via a status, is_scheduled boolean, or future effective date)
      if (row.is_scheduled || new Date(row.effective_date || row.scheduled_datetime) > new Date()) {
        acc[frontendCode].scheduled = {
          price: parseFloat(row.price),
          scheduledAt: row.scheduled_datetime || row.effective_date,
        };
      } else {
        // Otherwise, it's the live active counter price
        acc[frontendCode].price = parseFloat(row.price);
        acc[frontendCode].updatedAt = row.updated_at;
      }

      return acc;
    }, {});

    res.status(200).json(activeCurrentPrices);
  } catch (err) {
    console.error("Failed to query Postgres entries by locationId:", err);
    res.status(500).json({ message: "Internal record lookup failure." });
  }
});

router.get("/check-pending-verification", async (req, res) => {
  const db = getPg();
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res
      .status(401)
      .json({ message: "Unauthorized user session context." });
  }

  try {
    const locationDoc = await Location.findOne({
      $or: [{ email: userEmail }, { managerEmails: userEmail }],
    });

    if (!locationDoc) {
      return res.status(200).json({ requiresVerification: false });
    }

    const locationMongoId = String(locationDoc._id);

    // Determine if this particular location bypasses InfoNet checks entirely
    const hasInfonet = !SITES_WITHOUT_INFONET.includes(locationMongoId);

    // 1. Look for any log rows created in the last 6 hours that are missing required images
    const unverifiedLogs = await db("fuel_price_logs")
      .where({ site: locationMongoId })
      .andWhere((builder) => {
        if (hasInfonet) {
          // Standard: Missing either the Bulloch report snapshot OR the InfoNet report snapshot
          builder.whereNull("image_url").orWhereNull("infonet_image_url");
        } else {
          // Exception Site: Only require verification on the core Bulloch snapshot report
          builder.whereNull("image_url");
        }
      })
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '6 hours'"))
      .orderBy("id", "asc");

    // If there are no unverified structural logs in the last 6 hours,
    // it means any recent action was completely unchanged, so we clear the dialog box!
    if (!unverifiedLogs || unverifiedLogs.length === 0) {
      return res.status(200).json({ requiresVerification: false });
    }

    // 2. Reconstruct the accurate delta state from those active unverified rows
    const unverifiedGradesMap = unverifiedLogs.reduce((acc, log) => {
      const frontendKey =
        Object.keys(GRADE_MAP).find((key) => GRADE_MAP[key] === log.grade) ||
        log.grade;
      acc[frontendKey] = parseFloat(log.price);
      return acc;
    }, {});

    const currentPrices =
      await currentPriceModel.getCurrentPricesBySite(locationMongoId);
    const changedGrades = [];
    const unchangedGrades = [];

    // 3. Re-hydrate the full grades accurately for display matching
    for (const r of currentPrices) {
      const frontendKey =
        Object.keys(GRADE_MAP).find((key) => GRADE_MAP[key] === r.grade) ||
        r.grade;
      const currentPriceNum = parseFloat(r.price);
      const wasChanged = unverifiedGradesMap[frontendKey] !== undefined;

      // Pull the old price by checking the log row right before our unverified change row
      let exactOldPrice = currentPriceNum;
      if (wasChanged) {
        const query = db("fuel_price_logs")
          .where({ site: locationMongoId, grade: r.grade })
          .whereNotNull("image_url");

        // Adapt baseline target matching strategy dynamically
        if (hasInfonet) {
          query.whereNotNull("infonet_image_url"); // Find last baseline containing BOTH confirmations
        }

        const previousLog = await query.orderBy("id", "desc").first();
        if (previousLog) exactOldPrice = parseFloat(previousLog.price);
      }

      const itemPayload = {
        gradeId: frontendKey,
        label: frontendKey,
        newPrice: currentPriceNum,
        oldPrice: exactOldPrice,
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
        hasStructuralChanges: changedGrades.length > 0,
        hasInfonet: hasInfonet, // Propagated cleanly to fix frontend conditional button lookups
      },
    });
  } catch (err) {
    console.error("Failed checkpoint state validation sequence:", err);
    return res
      .status(500)
      .json({ message: "Internal verification engine failure." });
  }
});

// router.get('/check-pending-verification', async (req, res) => {
//   const db = getPg();
//   const userEmail = req.user?.email;

//   if (!userEmail) {
//     return res.status(401).json({ message: "Unauthorized user session context." });
//   }

//   try {
//     const locationDoc = await Location.findOne({
//       $or: [
//         { email: userEmail },
//         { managerEmails: userEmail }
//       ]
//     });

//     if (!locationDoc) {
//       return res.status(200).json({ requiresVerification: false });
//     }

//     const locationMongoId = String(locationDoc._id);

//     // 1. Look for any log rows created in the last 6 hours that are missing EITHER the Bulloch or InfoNet image URL
//     const unverifiedLogs = await db('fuel_price_logs')
//       .where({ site: locationMongoId })
//       .andWhere((builder) => {
//         builder.whereNull('image_url').orWhereNull('infonet_image_url');
//       })
//       .where('created_at', '>=', db.raw("NOW() - INTERVAL '6 hours'"))
//       .orderBy('id', 'asc');

//     // If there are no unverified structural logs in the last 6 hours,
//     // it means any recent action was completely unchanged, so we clear the dialog box!
//     if (!unverifiedLogs || unverifiedLogs.length === 0) {
//       return res.status(200).json({ requiresVerification: false });
//     }

//     // 2. Reconstruct the accurate delta state from those active unverified rows
//     const unverifiedGradesMap = unverifiedLogs.reduce((acc, log) => {
//       const frontendKey = Object.keys(GRADE_MAP).find(key => GRADE_MAP[key] === log.grade) || log.grade;
//       acc[frontendKey] = parseFloat(log.price);
//       return acc;
//     }, {});

//     const currentPrices = await currentPriceModel.getCurrentPricesBySite(locationMongoId);
//     const changedGrades = [];
//     const unchangedGrades = [];

//     // 3. Re-hydrate the full 5 grades accurately for display matching
//     for (const r of currentPrices) {
//       const frontendKey = Object.keys(GRADE_MAP).find(key => GRADE_MAP[key] === r.grade) || r.grade;
//       const currentPriceNum = parseFloat(r.price);
//       const wasChanged = unverifiedGradesMap[frontendKey] !== undefined;

//       // Pull the old price by checking the log row right before our unverified change row
//       let exactOldPrice = currentPriceNum;
//       if (wasChanged) {
//         const previousLog = await db('fuel_price_logs')
//           .where({ site: locationMongoId, grade: r.grade })
//           .whereNotNull('image_url')
//           .whereNotNull('infonet_image_url') // Find the last confirmed baseline price with BOTH images
//           .orderBy('id', 'desc')
//           .first();
//         if (previousLog) exactOldPrice = parseFloat(previousLog.price);
//       }

//       const itemPayload = {
//         gradeId: frontendKey,
//         label: frontendKey,
//         newPrice: currentPriceNum,
//         oldPrice: exactOldPrice
//       };

//       if (wasChanged) {
//         changedGrades.push(itemPayload);
//       } else {
//         unchangedGrades.push(itemPayload);
//       }
//     }

//     return res.status(200).json({
//       requiresVerification: true,
//       payload: {
//         stationName: locationDoc.stationName,
//         locationId: locationMongoId,
//         changedGrades: changedGrades,
//         unchangedGrades: unchangedGrades,
//         hasStructuralChanges: changedGrades.length > 0
//       }
//     });

//   } catch (err) {
//     console.error("Failed checkpoint state validation sequence:", err);
//     return res.status(500).json({ message: "Internal verification engine failure." });
//   }
// });

/**
 * GET /api/fuel-pricing/logs/:locationId
 * Fetches historical pricing logs for a specific site and hydrates Mongo identity fields
 */
router.get("/logs/:locationId", async (req, res) => {
  const { locationId } = req.params;

  try {
    // 1. Fetch the raw sequential audit records from Postgres/MSSQL
    const rawLogs = await logsModel.getLogsBySite(locationId);

    if (!rawLogs || rawLogs.length === 0) {
      return res.status(200).json({ success: true, logs: [] });
    }

    // 2. Extract unique Mongo IDs to avoid redundant database calls
    const uniqueUserIds = new Set();
    uniqueUserIds.add(locationId); // The site itself is a Location ID

    rawLogs.forEach((log) => {
      if (log.posted_by) uniqueUserIds.add(log.posted_by);
      if (log.received_by) uniqueUserIds.add(log.received_by);
    });

    const idList = Array.from(uniqueUserIds);

    // 3. Query Mongo in parallel batches
    const [locations, users] = await Promise.all([
      Location.find({ _id: { $in: idList } }, "stationName email").lean(),
      User.find({ _id: { $in: idList } }, "firstName lastName email").lean(),
    ]);

    // 4. Create optimized hash lookups for quick dictionary access
    const locationMap = new Map(locations.map((loc) => [String(loc._id), loc]));
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // 5. Stitch, format, and align the fields specifically for your frontend layout
    const formattedLogs = rawLogs.map((log) => {
      const siteMeta = locationMap.get(String(log.site));
      const postedUser = log.posted_by
        ? userMap.get(String(log.posted_by))
        : null;
      const receivedUser = log.received_by
        ? userMap.get(String(log.received_by))
        : null;

      return {
        id: log.id,
        dateSK: log.date,
        dayName: log.day,
        fuelGrade: log.grade,
        currentPrice: parseFloat(log.price),
        previousPrice:
          log.old_price !== null ? parseFloat(log.old_price) : null,

        // Image Snapshots previews
        imageUrl: log.image_url || null,
        infonetImageUrl: log.infonet_image_url || null,

        // Hydrated Business Entities
        stationContext: {
          id: log.site,
          stationName: siteMeta ? siteMeta.stationName : "Unknown Station",
        },
        postedBy: postedUser
          ? {
              id: log.posted_by,
              fullName: `${postedUser.firstName} ${postedUser.lastName}`.trim(),
              email: postedUser.email,
            }
          : null,
        receivedBy: receivedByMeta(log, receivedUser, siteMeta),

        // ⏱️ Aligned Timestamp Semantics
        postedAt: log.created_at, // Created At = Sent/Posted Time
        receivedAt: log.updated_at, // Updated At = Final Register Sync Time
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedLogs.length,
      logs: formattedLogs,
    });
  } catch (error) {
    console.error(
      `💥 Failed to aggregate pricing log history matrix for location ${locationId}:`,
      error,
    );
    return res
      .status(500)
      .json({ message: "Internal metadata compilation failure." });
  }
});

/**
 * Helper to normalize structural fallback context for missing or automated operational accounts
 */
function receivedByMeta(log, receivedUser, siteMeta) {
  if (receivedUser) {
    return {
      id: log.received_by,
      fullName: `${receivedUser.firstName} ${receivedUser.lastName}`.trim(),
      email: receivedUser.email,
    };
  }
  if (
    log.received_by === "SYSTEM" ||
    (!log.received_by && log.infonet_image_url)
  ) {
    return {
      id: "SYSTEM",
      fullName: "Automated Hub Register Sync",
      email: "system@gen7fuel.com",
    };
  }
  return null;
}
router.put("/verify-price-receipt", async (req, res) => {
  const db = getPg();
  const userEmail = req.user?.email;
  const userIdStr = req.user?._id ? String(req.user._id) : null;
  const { locationId, filename, infonetFilename } = req.body;

  // 1. Determine if this site uses an InfoNet terminal dynamically
  const hasInfonet = !SITES_WITHOUT_INFONET.includes(String(locationId));

  // 2. Adjust standard parameter validations (infonetFilename is only mandatory if hasInfonet is true)
  if (
    !userEmail ||
    !locationId ||
    !filename ||
    (hasInfonet && !infonetFilename)
  ) {
    return res
      .status(400)
      .json({ message: "Missing required verification data coordinates." });
  }

  try {
    // 3. Update the targeted log records using conditional filter constraints
    const updatedRows = await db("fuel_price_logs")
      .where({ site: locationId })
      .andWhere((builder) => {
        if (hasInfonet) {
          // Standard check: Target rows where either image string is missing
          builder.whereNull("image_url").orWhereNull("infonet_image_url");
        } else {
          // Exception check: Target rows where only the primary Bulloch image string is missing
          builder.whereNull("image_url");
        }
      })
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '6 hours'"))
      .update({
        image_url: filename,
        // If it does not have InfoNet, save it explicitly as null (or keep a static string like 'N/A' if preferred)
        infonet_image_url: hasInfonet ? infonetFilename : null,
        received_by: userIdStr,
        updated_at: db.raw("CURRENT_TIMESTAMP"),
      });

    console.log(
      `⛽ Safe Audit Update Complete. Site: ${locationId} (Has InfoNet: ${hasInfonet}) | Rows Filled: ${updatedRows} within 6hr window.`,
    );
    // 🚀 NEW: Real-time broadcast to unlock all manager and main accounts on other devices
    const locationDoc = await Location.findById(locationId);
    if (locationDoc) {
      const criticalEmails = [
        locationDoc.email,
        ...(locationDoc.managerEmails || []),
      ].filter(Boolean);
      const targetedUsers = await User.find(
        { email: { $in: criticalEmails } },
        "_id",
      );
      const uniqueUserIds = targetedUsers.map((u) => String(u._id));

      const io = req.app.get("io");
      if (io && uniqueUserIds.length > 0) {
        uniqueUserIds.forEach((userId) => {
          // Emit unlock message targeting each channel room
          io.to(userId).emit("retail-price-verified", { locationId });
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: `Successfully verified and locked ${updatedRows} fuel grade rows.`,
    });
  } catch (err) {
    console.error("Critical failure during batch log image linking:", err);
    return res
      .status(500)
      .json({ message: "Failed to persist terminal verification asset." });
  }
});

// =========================================================================
// UPSERT WITH DELTA CHANGE-DETECTION CONSTRAINT
// =========================================================================
// router.post("/upsert-retail", async (req, res) => {
//   const { locationId, stationName, prices } = req.body;
//   const db = getPg();
//   const postedByUserIdStr = req.user?._id ? String(req.user._id) : null;
//   const userEmail = req.user?.email;

//   if (!locationId || !prices) {
//     return res
//       .status(400)
//       .json({ message: "Missing location identification parameters." });
//   }

//   const now = new Date();
//   const dateSK = parseInt(
//     `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`,
//     10,
//   );
//   const currentDayName = now.toLocaleDateString("en-US", { weekday: "long" });

//   try {
//     const locationDoc = await Location.findById(locationId);
//     if (!locationDoc) {
//       return res
//         .status(404)
//         .json({ message: "Target location context not found." });
//     }

//     const hasInfonet = !SITES_WITHOUT_INFONET.includes(locationId);

//     const criticalEmails = [
//       locationDoc.email,
//       ...(locationDoc.managerEmails || []),
//     ].filter(Boolean);
//     const targetedUsers = await User.find(
//       { email: { $in: criticalEmails } },
//       "_id email",
//     );
//     const uniqueUserIds = targetedUsers.map((u) => String(u._id));

//     // 🚀 FIX STEP 1: Pass the transaction manager here if your model layer supports it,
//     // to guarantee you aren't pulling from a dirty/stale outside read pool.
//     const existingRows =
//       await currentPriceModel.getCurrentPricesBySite(locationId);

//     const changedGradesList = [];
//     const unchangedGradesList = [];
//     let databaseWritesExecutedCount = 0;

//     const masterFrontendCodes = Object.keys(GRADE_MAP);

//     await db.transaction(async (trx) => {
//       for (const frontendCode of masterFrontendCodes) {
//         const correspondingDbGradeName = GRADE_MAP[frontendCode];

//         // Find if this grade already has a record in the database for this site
//         const matchingDbRow = existingRows.find(
//           (row) =>
//             String(row.grade).trim() ===
//             String(correspondingDbGradeName).trim(),
//         );

//         // 🚀 FIX STEP 2: Strict parsing check. If matchingDbRow exists and has a price, use it.
//         // Check for both null/undefined AND make sure it's not an empty string check.
//         const hasValidPriceRecord =
//           matchingDbRow &&
//           matchingDbRow.price !== null &&
//           matchingDbRow.price !== undefined;

//         const currentDbPrice = hasValidPriceRecord
//           ? parseFloat(matchingDbRow.price)
//           : 0;
//         const isNewRecordForSite = !hasValidPriceRecord;

//         const targetPriceRaw = prices[frontendCode];

//         if (targetPriceRaw === undefined || targetPriceRaw === null) {
//           if (isNewRecordForSite) {
//             continue; // No price provided for a brand new site grade? Skip it.
//           }
//         }

//         const parsedTargetPrice =
//           targetPriceRaw !== undefined && targetPriceRaw !== null
//             ? parseFloat(targetPriceRaw)
//             : currentDbPrice;

//         const itemStatePayload = {
//           gradeId: frontendCode,
//           label: correspondingDbGradeName,
//           oldPrice: isNewRecordForSite ? null : currentDbPrice, // 🚀 Will now accurately bind currentDbPrice float
//           newPrice: parsedTargetPrice,
//         };

//         // Delta Engine Validation:
//         if (!isNewRecordForSite && currentDbPrice === parsedTargetPrice) {
//           unchangedGradesList.push(itemStatePayload);
//         } else {
//           databaseWritesExecutedCount++;
//           changedGradesList.push(itemStatePayload);

//           // Pass structural fallback tracking arguments down to SQL layer
//           await currentPriceModel.upsertCurrentPrice(
//             {
//               site: locationId,
//               grade: correspondingDbGradeName,
//               price: parsedTargetPrice,
//               old_price: isNewRecordForSite ? null : currentDbPrice,
//               last_updated_by: postedByUserIdStr,
//             },
//             trx,
//           );

//           // Persist historical snapshot directly into audit logger row
//           await logsModel.createLog(
//             {
//               date: dateSK,
//               day: currentDayName,
//               site: locationId,
//               grade: correspondingDbGradeName,
//               price: parsedTargetPrice,
//               old_price: isNewRecordForSite ? null : currentDbPrice,
//               image_url: null,
//               infonet_image_url: null,
//               posted_by: postedByUserIdStr,
//             },
//             trx,
//           );
//         }
//       }
//     });

//     // -------------------------------------------------------------------------
//     // 🚀 UNCONDITIONAL GASBUDDY BACKGROUND BROADCAST (WITH SYSTEM INSULATION)
//     // -------------------------------------------------------------------------
//     try {
//       if (locationDoc.gasBuddyStationId) {
//         const normalizedPrices = {};

//         for (const [feCode, numericPrice] of Object.entries(prices)) {
//           // Explicitly drop Dyed Diesel so we don't pass untaxed commercial fuel to GasBuddy
//           if (feCode === 'DYED') continue;

//           // Lookup the readable name using your existing file-level GRADE_MAP (e.g., 'REG' -> 'Regular')
//           const gasBuddyLabel = GRADE_MAP[feCode];

//           // Pass the numeric decimal float (e.g., 1.532) directly to match your test harness format
//           if (gasBuddyLabel && numericPrice !== undefined && numericPrice !== null) {
//             normalizedPrices[gasBuddyLabel] = parseFloat(numericPrice);
//           }
//         }

//         // Verify we built a clean, qualified set of public fuel grades before pushing to Redis
//         if (Object.keys(normalizedPrices).length > 0) {
//           await gasBuddyQueue.add(
//             `gasbuddy-sync-${locationId}-${Date.now()}`,
//             {
//               gasBuddyStationId: locationDoc.gasBuddyStationId,
//               stationName: stationName,
//               prices: normalizedPrices // Dispatches clean format: { "Regular": 1.532, "Mid Grade": 1.694 }
//             },
//             {
//               removeOnComplete: true,
//               removeOnFail: false // Kept in BullMQ dashboard for fail-safe visual troubleshooting
//             }
//           );
//           console.log(`🤖 GasBuddy background verification job successfully queued for ${stationName}`);
//         } else {
//           console.log(`ℹ️ GasBuddy skipped: No qualifying public fuel grades provided in request payload.`);
//         }
//       } else {
//         console.log(`ℹ️ GasBuddy update skipped: No gasBuddyStationId configuration mapped for ${stationName}`);
//       }
//     } catch (gasBuddyQueueError) {
//       // 🛡️ Complete Isolation Guardrail
//       // Traps any Redis disconnects or BullMQ internal failures here so the main HTTP transaction remains unaffected.
//       console.error("💥 CRITICAL NON-BLOCKING EXCEPTION: GasBuddy queue dispatch failed.", gasBuddyQueueError);
//     }

//     // -------------------------------------------------------------------------
//     // DISPATCH NOTIFICATIONS & TIMER ON CHANGES DETECTED
//     // -------------------------------------------------------------------------
//     if (databaseWritesExecutedCount > 0) {
//       const storeEmail = locationDoc.email;
//       const targetStationName = stationName || locationDoc.stationName;

//       // Dynamically compile CC targets (Manager emails + user session context email)
//       const baseCCEmails = Array.isArray(locationDoc.managerEmails) ? [...locationDoc.managerEmails, "kporter@gen7fuel.com", "daksh@gen7fuel.com"] : ["kporter@gen7fuel.com", "daksh@gen7fuel.com"];

//       // 1. Send IMMEDIATE general update alert to store, copying managers & admin
//       const initialNoticeHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
//           <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
//             <h2 style="color: #14532d; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
//               🔔 Notice: Fuel Prices Updated
//             </h2>
//             <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
//               New retail prices have just been published for your station location. Please update your system registers immediately.
//             </p>
//           </div>

//           <div style="margin-bottom: 24px;">
//             <table style="width: 100%; border-collapse: collapse;">
//               <tr>
//                 <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
//                 <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${targetStationName}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
//                 <td style="padding: 6px 0; font-size: 14px; color: #16a34a; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
//               </tr>
//             </table>
//           </div>

//           <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
//             Please log into the Gen7 Fuel Hub on your station account, finalize the price adjustments on your physical point-of-sale registers, and upload the required Bulloch and InfoNet receipt imagery to complete the audit cycle.
//           </p>

//           <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
//             <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
//               Automated operational tracking notification — Gen 7 Fuel Hub System.
//             </span>
//           </div>
//         </div>
//       `;

//       await emailQueue.add(`immediate-price-notice-${locationId}-${Date.now()}`, {
//         to: storeEmail,
//         cc: baseCCEmails,
//         // to: "daksh@gen7fuel.com",
//         subject: `⛽ Notification: New Fuel Prices Published - ${targetStationName}`,
//         html: initialNoticeHtml
//       });
//       console.log(`📧 Immediate update notification queued into BullMQ for ${targetStationName}.`);

//       // 2. WATCHDOG DELAYED TIMER PIPELINE (BULLMQ)
//       // Admin routing for the 30-min escalation
//       const primaryAdminEmail = "Mandy@gen7fuel.com";
//       const adminCCEmails = ["kellie@gen7fuel.com", "daksh@gen7fuel.com", "kporter@gen7fuel.com"];

//       // -------------------------------------------------------------------------
//       // 1. TEMPLATE: 15-Minute Store Reminder Email (Kept your exact style)
//       // -------------------------------------------------------------------------
//       const storeReminderHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
//           <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
//             <h2 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
//               ⚠️ Action Required: Complete Fuel Price Update
//             </h2>
//             <p style="color: #78350f; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
//               New retail prices were published for your station 15 minutes ago. This is a friendly reminder to ensure your registers are updated and your confirmation snapshots are uploaded.
//             </p>
//           </div>

//           <div style="margin-bottom: 24px;">
//             <table style="width: 100%; border-collapse: collapse;">
//               <tr>
//                 <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold; width: 120px;">STATION SITE:</td>
//                 <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">${targetStationName}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">STATUS:</td>
//                 <td style="padding: 6px 0; font-size: 14px; color: #b45309; font-weight: bold;">Awaiting Bulloch & InfoNet Snapshots</td>
//               </tr>
//             </table>
//           </div>

//           <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
//             Please log into the Gen7 Fuel Hub on your station account, and finalize the price adjustments on your registers, and upload the required receipt imagery to resolve this flag.
//           </p>

//           <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
//             <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
//               Automated operational tracking reminder — Gen 7 Fuel Hub System.
//             </span>
//           </div>
//         </div>
//       `;

//       // -------------------------------------------------------------------------
//       // 2. TEMPLATE: 30-Minute Admin Escalation Email (Plain & understandable)
//       // -------------------------------------------------------------------------
//       const adminEscalationHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
//           <h2 style="color: #dc2626; font-size: 18px; margin-top: 0; font-weight: 800; text-transform: uppercase; tracking-tight">
//             🚨 Alert: Price Verification Overdue (30 Mins)
//           </h2>

//           <p style="font-size: 14px; color: #334155;">
//             The pricing change you pushed to <strong>${targetStationName}</strong> remains unverified.
//             The store has not uploaded any Bulloch or InfoNet register images to the Hub to complete the fuel price update workflow.
//           </p>

//           <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; margin: 18px 0; font-size: 13px;">
//             <table style="width: 100%; border-collapse: collapse;">
//               <tr>
//                 <td style="padding: 4px 0; color: #64748b; font-weight: bold; width: 110px;">LOCATION:</td>
//                 <td style="padding: 4px 0; color: #0f172a; font-weight: bold;">${targetStationName}</td>
//               </tr>
//               <tr>
//                 <td style="padding: 4px 0; color: #64748b; font-weight: bold;">ELAPSED TIME:</td>
//                 <td style="padding: 4px 0; color: #dc2626; font-weight: bold;">30 Minutes</td>
//               </tr>
//               <tr>
//                 <td style="padding: 4px 0; color: #64748b; font-weight: bold;">STATUS:</td>
//                 <td style="padding: 4px 0; color: #475569; font-weight: bold;">Awaiting Register Snapshots</td>
//               </tr>
//             </table>
//           </div>

//           <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 20px;">
//             <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
//               Automated pricing supervisor log — Gen 7 Fuel Hub Operational Pipeline.
//             </span>
//           </div>
//         </div>
//       `;

//       // -------------------------------------------------------------------------
//       // SCHEDULE TASKS
//       // -------------------------------------------------------------------------

//       // Task A: 15-Minute Store Watchdog Reminder
//       await priceTimeoutQueue.add(
//         `timeout-reminder-${locationId}-${Date.now()}`,
//         {
//           locationId: locationId,
//           stationName: targetStationName,
//           toEmail: storeEmail,
//           ccEmails: baseCCEmails,
//           // ccEmails: ["daksh@gen7fuel.com"],
//           subject: `⛽ Urgent Reminder: Update & Verify Fuel Prices - ${targetStationName}`,
//           html: storeReminderHtml,
//           hasInfonet: hasInfonet // 🚀 Target Flag
//         },
//         {
//           delay: 15 * 60 * 1000, // 15-Minute delay
//           removeOnComplete: true,
//           removeOnFail: true
//         }
//       );

//       // Task B: 30-Minute Admin Escalation Watchdog
//       await priceTimeoutQueue.add(
//         `timeout-admin-escalation-${locationId}-${Date.now()}`,
//         {
//           locationId: locationId,
//           stationName: targetStationName,
//           toEmail: userEmail || primaryAdminEmail,
//           ccEmails: adminCCEmails,
//           // toEmail: storeEmail,
//           // ccEmails: ["daksh@gen7fuel.com"],
//           subject: `🚨 Unverified Price Update Alert: ${targetStationName} (30 Mins Overdue)`,
//           html: adminEscalationHtml,
//           hasInfonet: hasInfonet // 🚀 Target Flag
//         },
//         {
//           delay: 30 * 60 * 1000, // 30-Minute delay
//           removeOnComplete: true,
//           removeOnFail: true
//         }
//       );

//       console.log(`⏱️ Multi-Tier Watchdog Initialized: Scheduled 15-min store reminder and 30-min admin alert for ${targetStationName}.`);
//       // -------------------------------------------------------------------------
//       // 🚀 3. MARKETING TEAM PRICE COMPARISON HIGHLIGHTS REPORT (NEW)
//       // -------------------------------------------------------------------------
//       let marketingRowsHtml = '';

//       // Compile changed rows into view engine
//       for (const item of changedGradesList) {
//         const displayOld = item.oldPrice !== null ? `${Number(item.oldPrice).toFixed(4)}¢` : '--';
//         marketingRowsHtml += `
//           <tr style="border-bottom: 1px solid #f1f5f9;">
//             <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #1e293b;">${item.label}</td>
//             <td style="padding: 12px; font-size: 14px; color: #64748b; text-decoration: line-through;">${displayOld}</td>
//             <td style="padding: 12px; font-size: 15px; font-weight: 800; color: #16a34a;">${Number(item.newPrice).toFixed(4)}¢</td>
//             <td style="padding: 12px; text-align: right;">
//               <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">
//                 Updated
//               </span>
//             </td>
//           </tr>
//         `;
//       }

//       // Compile unchanged rows into view engine
//       for (const item of unchangedGradesList) {
//         marketingRowsHtml += `
//           <tr style="border-bottom: 1px solid #f1f5f9; background-color: #f8fafc;">
//             <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #64748b;">${item.label}</td>
//             <td style="padding: 12px; font-size: 14px; color: #94a3b8;">--</td>
//             <td style="padding: 12px; font-size: 14px; font-weight: bold; color: #475569;">${Number(item.newPrice).toFixed(4)}¢</td>
//             <td style="padding: 12px; text-align: right;">
//               <span style="display: inline-block; background-color: #e2e8f0; color: #475569; font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">
//                 Unchanged
//               </span>
//             </td>
//           </tr>
//         `;
//       }

//       const marketingReportHtml = `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff;">
//           <div style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 16px; border-radius: 12px 12px 0 0; margin-bottom: 20px;">
//             <h3 style="color: #334155; margin: 0 0 4px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
//               📊 Fuel Price Ledger
//             </h3>
//             <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 900;">
//               ${targetStationName}
//             </h2>
//           </div>

//           <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
//             The retail pricing board for this station location has been altered. Here are the comparisons mapping against current vs old prices:
//           </p>

//           <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: left;">
//             <thead>
//               <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
//                 <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Fuel Grade</th>
//                 <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Old Price</th>
//                 <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">New Price</th>
//                 <th style="padding: 10px 12px; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; text-align: right;">Status</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${marketingRowsHtml}
//             </tbody>
//           </table>

//           <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
//             <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
//               Internal price distribution ledger — Gen 7 Fuel Hub Operational Network.
//             </span>
//           </div>
//         </div>
//       `;

//       await emailQueue.add(`marketing-price-sync-${locationId}-${Date.now()}`, {
//         to: "marketing@gen7fuel.com", // Keeping marketing layout to your email for initial preview testing
//         subject: `📊 Fuel Pricing Sync Summary: ${targetStationName}`,
//         html: marketingReportHtml
//       });
//       console.log(`📧 Marketing highlights overview report queued successfully into BullMQ for ${targetStationName}.`);
//     }

//     // BROADCAST PIPELINE: This payload will now ALWAYS contain the full 5 grades
//     const io = req.app.get("io");
//     if (io && uniqueUserIds.length > 0) {
//       const socketPayload = {
//         stationName: stationName,
//         locationId: locationId,
//         changedGrades: changedGradesList,
//         unchangedGrades: unchangedGradesList,
//         hasStructuralChanges: changedGradesList.length > 0,
//         hasInfonet: hasInfonet, // 🚀 Socket Broadcast Flag payload
//       };

//       uniqueUserIds.forEach((userId) => {
//         io.to(userId).emit("retail-price-published", socketPayload);
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       updatesApplied: databaseWritesExecutedCount,
//       notifiedUserCount: uniqueUserIds.length,
//     });
//   } catch (err) {
//     console.error("Transaction Pipeline Failed:", err);
//     return res.status(500).json({ message: "Persistence layer failure." });
//   }
// });

router.post("/upsert-retail", async (req, res) => {
  const { locationId, stationName, prices, isScheduled, scheduledDateTime } =
    req.body;
  const db = getPg();
  const postedByUserIdStr = req.user?._id ? String(req.user._id) : null;
  const userEmail = req.user?.email;

  if (!locationId || !prices) {
    return res
      .status(400)
      .json({ message: "Missing location identification parameters." });
  }

  try {
    const locationDoc = await Location.findById(locationId);
    if (!locationDoc) {
      return res
        .status(404)
        .json({ message: "Target location context not found." });
    }

    // Determine target location timezone (fallback to Americas/Toronto index configurations)
    const targetTimezone = locationDoc.timezone || "America/Toronto";
    const io = req.app.get("io");
    console.log("Scheduled?", isScheduled);
    console.log("Scheduled Date Time", scheduledDateTime);

    // -------------------------------------------------------------------------
    // BRANCH A: DELAYED TASK SCHEDULING PIPELINE (Per-Grade Rows)
    // -------------------------------------------------------------------------
    if (isScheduled && scheduledDateTime) {
      const nowInStationTZ = moment().tz(targetTimezone);
      const targetTimeInStationTZ = moment.tz(
        scheduledDateTime,
        targetTimezone,
      );

      let calculatedDelayMs = targetTimeInStationTZ.diff(nowInStationTZ);

      if (calculatedDelayMs <= 0) {
        return res
          .status(400)
          .json({ message: "Scheduled date and time must be in the future." });
      }

      // Subtract 10-second safety cushion buffer
      const safetyBufferMs = 10 * 1000;
      calculatedDelayMs = Math.max(0, calculatedDelayMs - safetyBufferMs);

      const masterFrontendCodes = Object.keys(GRADE_MAP);
      const dbTimestamp = targetTimeInStationTZ.toDate();

      // Update the scheduling details for EACH grade row for this site
      await db.transaction(async (trx) => {
        for (const frontendCode of masterFrontendCodes) {
          const correspondingDbGradeName = GRADE_MAP[frontendCode];
          const targetPriceRaw = prices[frontendCode];

          if (targetPriceRaw !== undefined && targetPriceRaw !== null) {
            await trx("fuel_current_price")
              .where({
                site: locationId,
                grade: correspondingDbGradeName,
              })
              .update({
                is_scheduled: true,
                scheduled_date_time: targetTimeInStationTZ.toDate(),
                scheduled_price: parseFloat(targetPriceRaw),
              });
          }
        }
      });

      // Dispatch a single worker trigger for the station safely
      await priceScheduleQueue.add(
        `execute-scheduled-price-${locationId}-${Date.now()}`,
        {
          locationId,
          stationName,
          postedByUserIdStr,
          userEmail,
          isSocketEnabled: true,
          lockScheduledDateTime: dbTimestamp.toISOString(), // ✅ The Validation Lock
        },
        {
          delay: calculatedDelayMs,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return res.status(200).json({
        success: true,
        message: `Price adjustments scheduled successfully across grades. Execution in ~${Math.round(calculatedDelayMs / 1000)}s.`,
        isScheduled: true,
      });
    }

    // -------------------------------------------------------------------------
    // BRANCH B: IMMEDIATE INTERACTIVE LIVE PUBLISH
    // -------------------------------------------------------------------------
    const executionResults = await executeRetailPriceUpdate({
      locationId,
      stationName,
      prices,
      postedByUserIdStr,
      userEmail,
      appIo: io,
    });

    return res.status(200).json({
      success: true,
      updatesApplied: executionResults.databaseWritesExecutedCount,
      notifiedUserCount: executionResults.uniqueUserIdsCount,
    });
  } catch (err) {
    console.error("Transaction Pipeline Process Interrupted:", err);
    return res
      .status(500)
      .json({ message: "Persistence engine operation failure." });
  }
});

// -------------------------------------------------------------------------
// ROUTE 1: CANCEL / DELETE ENTIRE SITE SCHEDULE
// -------------------------------------------------------------------------
router.delete("/cancel-schedule", async (req, res) => {
  const { locationId } = req.body;
  const db = getPg();

  if (!locationId) {
    return res.status(400).json({ message: "Missing location parameter context." });
  }

  try {
    // Clear all scheduling records for this site. 
    // Any existing BullMQ job still in Redis will now safely auto-abort on wake.
    await db("fuel_current_price")
      .where({ site: locationId })
      .update({
        is_scheduled: false,
        scheduled_date_time: null,
        scheduled_price: null
      });

    return res.status(200).json({
      success: true,
      message: "All pending scheduled price updates for this location have been successfully deleted."
    });
  } catch (err) {
    console.error("Failed to cancel station schedule:", err);
    return res.status(500).json({ message: "Persistence engine operation failure during removal." });
  }
});

// -------------------------------------------------------------------------
// ROUTE 2: EDIT BULK PRICE FOR EXISTING LOCKED SCHEDULE
// -------------------------------------------------------------------------
router.put("/edit-schedule-prices", async (req, res) => {
  const { locationId, prices, scheduledDateTime } = req.body;
  const db = getPg();

  if (!locationId || !prices || !scheduledDateTime) {
    return res.status(400).json({ message: "Missing required modification parameters." });
  }

  try {
    // 1. Fetch current database schedule to verify lock consistency
    const existingRows = await db("fuel_current_price")
      .where({ site: locationId, is_scheduled: true });

    if (!existingRows || existingRows.length === 0) {
      return res.status(400).json({ message: "No active schedule found to modify for this location." });
    }

    // 2. Concurrency Lock Verification: Check if scheduledDateTime matches database precisely
    const dbTimeStr = new Date(existingRows[0].scheduled_date_time).toISOString();
    const clientProvidedTimeStr = new Date(scheduledDateTime).toISOString();

    if (dbTimeStr !== clientProvidedTimeStr) {
      return res.status(409).json({ 
        message: "Schedule state mismatch. The schedule timeline has been altered or replaced by another coordinator." 
      });
    }

    // 3. Perform atomic bulk updates to prices ONLY (preserving original scheduled_date_time)
    const masterFrontendCodes = Object.keys(GRADE_MAP);

    await db.transaction(async (trx) => {
      for (const frontendCode of masterFrontendCodes) {
        const correspondingDbGradeName = GRADE_MAP[frontendCode];
        const targetPriceRaw = prices[frontendCode];

        if (targetPriceRaw !== undefined && targetPriceRaw !== null) {
          await trx("fuel_current_price")
            .where({ site: locationId, grade: correspondingDbGradeName, is_scheduled: true })
            .update({
              scheduled_price: parseFloat(targetPriceRaw)
            });
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Scheduled price parameters successfully updated. Original target execution window preserved."
    });

  } catch (err) {
    console.error("Failed to modify schedule price elements:", err);
    return res.status(500).json({ message: "Persistence engine operation failure during modification." });
  }
});

module.exports = router;
