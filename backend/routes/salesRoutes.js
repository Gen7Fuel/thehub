const express = require('express');
const router = express.Router();
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')
const Location = require('../models/Location')
const { getCategorizedSalesData, getGradeVolumeFuelData, getTransTimePeriodData, getAllSQLData } = require('../services/sqlService');

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
    salesStart, salesEnd,
    fuelStart, fuelEnd,
    transStart, transEnd,
    shiftStart, shiftEnd
  } = req.query;

  try {
    // 1. Resolve site name from Location collection
    const location = await Location.findOne({ csoCode }).lean();
    if (!location) {
      return res.status(404).json({ error: `Location not found for CSO Code: ${csoCode}` });
    }
    const site = location.stationName;

    // 2. Fetch SQL data using your existing aggregator
    const sqlResponse = await getAllSQLData(csoCode, {
      salesStart, salesEnd,
      fuelStart, fuelEnd,
      transStart, transEnd,
      shiftStart, shiftEnd
    });

    // 3. Normalize Dates for MongoDB query range
    const startDate = new Date(shiftStart);
    startDate.setHours(0, 0, 0, 0); 
    const endDate = new Date(shiftEnd);
    endDate.setHours(23, 59, 59, 999);

    // 4. Fetch MongoDB Data (Reports and Individual Shifts)
    const [reports, shifts] = await Promise.all([
      CashSummaryReport.find({
        site,
        date: { $gte: startDate, $lte: endDate }
      }).lean(),
      CashSummary.find({
        site,
        date: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    // 5. Aggregate Mongo Shifts: Find Absolute Min Start / Max End per day
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

    // 6. Final Merge, Normalization & Metrics Calculation
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
    // 7. Final Combined Response
    res.json({
      ...sqlResponse, 
      operationalTimings 
    });

  } catch (err) {
    console.error("❌ Failed to fetch combined SQL and Mongo data:", err);
    res.status(500).json({ error: "Combined data fetch failed" });
  }
});

module.exports = router;