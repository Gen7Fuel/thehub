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
    site: siteParam,
    salesStart, salesEnd,
    fuelStart, fuelEnd,
    transStart, transEnd,
    shiftStart, shiftEnd,
    timesheetStart, timesheetEnd
  } = req.query;

  try {
    // 1. Check Redis cache
    const cacheKey = `dashboard:${siteParam}:allSqlData`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.json(parsed);
    }

    // 2. Date Range Setup (Past 10 Months)
    const targetEndDate = timesheetEnd ? new Date(timesheetEnd) : new Date();
    const targetStartDate = new Date(targetEndDate);
    targetStartDate.setMonth(targetStartDate.getMonth() - 10);
    targetStartDate.setDate(1);

    targetStartDate.setHours(0, 0, 0, 0);
    targetEndDate.setHours(23, 59, 59, 999);

    console.log(`\n🔍 [DEBUG] Fetching Mongo shifts for site: "${siteParam}"`);
    console.log(`📅 [DEBUG] Range: ${targetStartDate.toISOString()} to ${targetEndDate.toISOString()}`);

    // Fetch SQL & Mongo Data
    const [sqlResponse, shifts] = await Promise.all([
      getAllSQLData(csoCode, { 
        salesStart, salesEnd, 
        fuelStart, fuelEnd, 
        transStart, transEnd, 
        shiftStart, shiftEnd,
        timesheetStart, timesheetEnd
      }),
      CashSummary.find({ 
        site: siteParam, 
        date: { $gte: targetStartDate, $lte: targetEndDate } 
      }).lean(),
    ]);

    console.log(`📦 [DEBUG] Total MongoDB CashSummary shifts retrieved: ${shifts.length}`);

    const { _failedQueries: failedQueries, ...sqlData } = sqlResponse;

    // 3. Aggregate Dispenser Sales (AFD) from Mongo
    const dispenserSalesByDate = {};

    shifts.forEach((shift) => {
      if (!shift.date) return;

      // Extract raw YYYY-MM-DD cleanly regardless of timezone offset
      const dateStr = String(shift.date).slice(0, 10);

      const afdCredit = Number(shift.afdCredit) || 0;
      const afdDebit = Number(shift.afdDebit) || 0;
      const afdGiftCard = Number(shift.afdGiftCard) || 0;
      const totalShiftAFD = afdCredit + afdDebit + afdGiftCard;

      if (!dispenserSalesByDate[dateStr]) {
        dispenserSalesByDate[dateStr] = 0;
      }
      dispenserSalesByDate[dateStr] += totalShiftAFD;
    });

    console.log("📊 [DEBUG] Aggregated Mongo Dispenser Sales by Date:", dispenserSalesByDate);

    // 4. Merge into `employeeTimesheets`
    const updatedEmployeeTimesheets = (sqlData.employeeTimesheets || []).map((row) => {
      // Direct string extraction to avoid JS Date timezone shifting
      const rowDate = row.LaborDate ? String(row.LaborDate).slice(0, 10) : null;

      const dispenserSales = rowDate && dispenserSalesByDate[rowDate] 
        ? Math.round(dispenserSalesByDate[rowDate] * 100) / 100 
        : 0;

      return {
        ...row,
        dispenserSales // Injected property
      };
    });

    /* 
    ====================================================================
    COMMENTED OUT: Operational Timings logic retained for future reference
    ====================================================================
    const mongoDailyTimings = {};
    shifts.forEach(s => {
      const dayKey = new Date(s.date).toISOString().split('T')[0];

      if (!mongoDailyTimings[dayKey]) {
        mongoDailyTimings[dayKey] = {
          stationOpen: s.stationStart,
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

    const operationalTimings = [];
    let current = new Date(targetStartDate);

    while (current <= targetEndDate) {
      const dateStr = current.toISOString().split('T')[0];
      const sqlDateSK = dateStr.replace(/-/g, '');

      const sqlRow = sqlData.shiftTransactionTimings?.find(row => row.Date_SK === sqlDateSK) || {};
      const mongoRow = mongoDailyTimings[dateStr] || {};
      const reportEntry = reports?.find(r => new Date(r.date).toISOString().split('T')[0] === dateStr);

      const normOpen = mongoRow.stationOpen ? new Date(mongoRow.stationOpen) : null;
      const normClose = mongoRow.stationClose ? new Date(mongoRow.stationClose) : null;

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

        chartMetrics: {
          openMin, closeMin, regStartMin, regEndMin, clStartMin, clEndMin,
          isZombieShift: openMin !== null && openMin < 0,
          isMissingClose: normOpen && !normClose,
          hasActivityBeforeOpen: sqlRow.firstRegTrans && normOpen && (new Date(sqlRow.firstRegTrans) < normOpen)
        }
      });

      current.setDate(current.getDate() + 1);
    }
    ====================================================================
    */

    // Log the last 3 rows sent to the frontend for direct verification
    console.log("🚀 [DEBUG] Sample Updated Timesheets (Last 3 rows):");
    console.dir(updatedEmployeeTimesheets.slice(-3), { depth: null });

    const responseData = {
      ...sqlData,
      employeeTimesheets: updatedEmployeeTimesheets,
      operationalTimings: [],
      lastUpdated: new Date().toISOString(),
    };

    if (failedQueries.length === 0) {
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 90000);
    }

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
      const location = await Location.findOne({ site }).lean();
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