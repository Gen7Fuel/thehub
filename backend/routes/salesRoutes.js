const express = require('express');
const router = express.Router();
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')
const Location = require('../models/Location')
const { getCategorizedSalesData, getGradeVolumeFuelData, getTransTimePeriodData, getAllSQLData } = require('../services/sqlService');
const redis = require('../utils/redisClient');

router.get('/sales', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getCategorizedSalesData(csoCode, startDate, endDate);
  res.json(data);
});

router.get('/fuelsales', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getGradeVolumeFuelData(csoCode, startDate, endDate);
  res.json(data);
});

router.get('/transactions-data', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getTransTimePeriodData(csoCode, startDate, endDate);
  console.log('time period data:', data);
  res.json(data);
});

// router.get('/all-data', async (req, res) => {
//   const {
//     csoCode,

//     salesStart,
//     salesEnd,

//     fuelStart,
//     fuelEnd,

//     transStart,
//     transEnd,

//     shiftStart,
//     shiftEnd
//   } = req.query;

//   try {
//     const response = await getAllSQLData(csoCode, {
//       salesStart,
//       salesEnd,
//       fuelStart,
//       fuelEnd,
//       transStart,
//       transEnd,
//       shiftStart,
//       shiftEnd
//     });
//     // console.log('transstart:',transStart,'transend:',transEnd);
//     // console.log('salesstart:',salesStart,'salesend:',salesEnd);
//     // console.log('fuelsalesstart:',fuelStart,'fuelsalesend:',fuelEnd);

//     res.json(response);
//   } catch (err) {
//     console.error("❌ Failed to fetch combined SQL data:", err);
//     res.status(500).json({ error: "SQL fetch failed" });
//   }
// });

/**
 * Helper: Converts any date input (String or Date) to minutes relative to midnight 
 * of a specific reference date.
 */
const getMinutesFromMidnight = (input, referenceDateStr) => {
  if (!input) return null;
  const date = new Date(input);
  const ref = new Date(referenceDateStr);
  ref.setHours(0, 0, 0, 0);
  
  // Calculate difference in ms and convert to rounded minutes
  // (1 minute = 60,000 ms)
  return Math.round((date.getTime() - ref.getTime()) / 60000);
};

router.get('/all-data', async (req, res) => {
  const {
    csoCode,
    site: siteParam,  // sent by client to skip the Location lookup
    salesStart, salesEnd,
    fuelStart, fuelEnd,
    transStart, transEnd,
    shiftStart, shiftEnd
  } = req.query;

  try {
    // 1. Check Redis cache
    const cacheKey = `dashboard:${siteParam}:allSqlData`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.json(parsed);
    }

    // 2. Cache miss — fetch from MSSQL + MongoDB
    const startDate = new Date(shiftStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(shiftEnd);
    endDate.setHours(23, 59, 59, 999);

    // Run SQL queries AND MongoDB shift queries in parallel — no sequential dependency
    const [sqlResponse, reports, shifts] = await Promise.all([
      getAllSQLData(csoCode, { salesStart, salesEnd, fuelStart, fuelEnd, transStart, transEnd, shiftStart, shiftEnd }),
      CashSummaryReport.find({ site: siteParam, date: { $gte: startDate, $lte: endDate } }).lean(),
      CashSummary.find({ site: siteParam, date: { $gte: startDate, $lte: endDate } }).lean(),
    ]);

    const site = siteParam;

    // Aggregate Mongo Shifts: Find Absolute Min Start / Max End per day
    const mongoDailyTimings = {};
    shifts.forEach(s => {
      const dayKey = new Date(s.date).toISOString().split('T')[0];

      if (!mongoDailyTimings[dayKey]) {
        mongoDailyTimings[dayKey] = {
          stationOpen: s.stationStart, // Format: "YYYY-MM-DD HH:mm"
          stationClose: s.stationEnd
        };
      } else {
        if (s.stationStart && s.stationStart < mongoDailyTimings[dayKey].stationOpen) {
          mongoDailyTimings[dayKey].stationOpen = s.stationStart;
        }
        if (s.stationEnd && (!mongoDailyTimings[dayKey].stationClose || s.stationEnd > mongoDailyTimings[dayKey].stationClose)) {
          mongoDailyTimings[dayKey].stationClose = s.stationEnd;
        }
      }
    });

    // Final Merge, Normalization & Metrics Calculation
    const operationalTimings = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const sqlDateSK = dateStr.replace(/-/g, '');

      // Locate data for this specific date
      const sqlRow = sqlResponse.shiftTransactionTimings.find(row => row.Date_SK === sqlDateSK) || {};
      const mongoRow = mongoDailyTimings[dateStr] || {};
      const reportEntry = reports.find(r => new Date(r.date).toISOString().split('T')[0] === dateStr);

      // Normalize raw inputs to standard JS Dates (or null)
      const normOpen = mongoRow.stationOpen ? new Date(mongoRow.stationOpen) : null;
      const normClose = mongoRow.stationClose ? new Date(mongoRow.stationClose) : null;

      // Minutes from midnight for easier UI rendering (0 to 1440+)
      const openMin = getMinutesFromMidnight(normOpen, dateStr);
      const closeMin = getMinutesFromMidnight(normClose, dateStr);
      const regStartMin = getMinutesFromMidnight(sqlRow.firstRegTrans, dateStr);
      const regEndMin = getMinutesFromMidnight(sqlRow.lastRegTrans, dateStr);
      const clStartMin = getMinutesFromMidnight(sqlRow.firstCardlockTrans, dateStr);
      const clEndMin = getMinutesFromMidnight(sqlRow.lastCardlockTrans, dateStr);

      operationalTimings.push({
        date: dateStr,
        stationOpen: normOpen,
        stationClose: normClose,
        firstRegTrans: sqlRow.firstRegTrans || null,
        lastRegTrans: sqlRow.lastRegTrans || null,
        firstCardlockTrans: sqlRow.firstCardlockTrans || null,
        lastCardlockTrans: sqlRow.lastCardlockTrans || null,
        firstShiftLogin: sqlRow.firstShiftLogin || null,
        lastShiftLogout: sqlRow.lastShiftLogout || null,
        isSubmitted: reportEntry ? reportEntry.submitted : false,

        // Metrics added back for "Store Activity Trend" section
        chartMetrics: {
          openMin,
          closeMin,
          regStartMin,
          regEndMin,
          clStartMin,
          clEndMin,
          isZombieShift: openMin !== null && openMin < 0,
          isMissingClose: normOpen && !normClose,
          hasActivityBeforeOpen: sqlRow.firstRegTrans && normOpen && (new Date(sqlRow.firstRegTrans) < normOpen)
        }
      });

      current.setDate(current.getDate() + 1);
    }

    // 3. Build response and cache it
    const responseData = {
      ...sqlResponse,
      operationalTimings,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 25 hours (90000 seconds) — cron refreshes daily, buffer for missed runs
    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 90000);

    res.json(responseData);

  } catch (err) {
    console.error("❌ Failed to fetch combined SQL and Mongo data:", err);
    res.status(500).json({ error: "Combined data fetch failed" });
  }
});

// Admin endpoint to manually refresh dashboard cache
router.post('/refresh-dashboard-cache', async (req, res) => {
  try {
    const { refreshSiteCache, refreshAllSitesCache } = require('../cron_jobs/dashboardCacheCron');
    const { site } = req.query;

    if (site) {
      const location = await Location.findOne({ stationName: site }).lean();
      if (!location) return res.status(404).json({ error: "Site not found" });
      await refreshSiteCache(location.stationName, location.csoCode);
      return res.json({ message: `Cache refreshed for ${site}` });
    }

    await refreshAllSitesCache();
    res.json({ message: "Cache refreshed for all sites" });
  } catch (err) {
    console.error("❌ Dashboard cache refresh failed:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;