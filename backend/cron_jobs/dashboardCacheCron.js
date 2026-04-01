const cron = require("node-cron");
const Location = require("../models/Location");
const { CashSummary, CashSummaryReport } = require("../models/CashSummaryNew");
const { getAllSQLData } = require("../services/sqlService");
const redis = require("../utils/redisClient");

// Helper: minutes from midnight for a given datetime and reference date
const getMinutesFromMidnight = (dt, dateStr) => {
  if (!dt) return null;
  const d = new Date(dt);
  const ref = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - ref.getTime()) / 60000);
};

// Helper: format date as YYYY-MM-DD
const fmt = (d) => d.toISOString().slice(0, 10);

/**
 * Build the combined SQL + Mongo dashboard payload for a single site.
 * Mirrors the logic in GET /api/sql/all-data (salesRoutes.js).
 */
async function buildDashboardData(csoCode, siteName) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1); // yesterday

  // Date ranges matching the frontend
  const salesStart = new Date(end); salesStart.setDate(salesStart.getDate() - 59);
  const fuelStart = new Date(end); fuelStart.setDate(fuelStart.getDate() - 60);
  const transStart = new Date(end); transStart.setDate(transStart.getDate() - 14);
  const shiftStart = new Date(end); shiftStart.setDate(shiftStart.getDate() - 7);

  const dates = {
    salesStart: fmt(salesStart),
    salesEnd: fmt(end),
    fuelStart: fmt(fuelStart),
    fuelEnd: fmt(end),
    transStart: fmt(transStart),
    transEnd: fmt(end),
    shiftStart: fmt(shiftStart),
    shiftEnd: fmt(end),
  };

  const startDate = new Date(dates.shiftStart);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dates.shiftEnd);
  endDate.setHours(23, 59, 59, 999);

  const [sqlResponse, reports, shifts] = await Promise.all([
    getAllSQLData(csoCode, dates),
    CashSummaryReport.find({ site: siteName, date: { $gte: startDate, $lte: endDate } }).lean(),
    CashSummary.find({ site: siteName, date: { $gte: startDate, $lte: endDate } }).lean(),
  ]);

  // Aggregate Mongo Shifts
  const mongoDailyTimings = {};
  shifts.forEach((s) => {
    const dayKey = new Date(s.date).toISOString().split("T")[0];
    if (!mongoDailyTimings[dayKey]) {
      mongoDailyTimings[dayKey] = { stationOpen: s.stationStart, stationClose: s.stationEnd };
    } else {
      if (s.stationStart && s.stationStart < mongoDailyTimings[dayKey].stationOpen) {
        mongoDailyTimings[dayKey].stationOpen = s.stationStart;
      }
      if (s.stationEnd && (!mongoDailyTimings[dayKey].stationClose || s.stationEnd > mongoDailyTimings[dayKey].stationClose)) {
        mongoDailyTimings[dayKey].stationClose = s.stationEnd;
      }
    }
  });

  // Merge & compute operational timings
  const operationalTimings = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    const sqlDateSK = dateStr.replace(/-/g, "");
    const sqlRow = sqlResponse.shiftTransactionTimings.find((row) => row.Date_SK === sqlDateSK) || {};
    const mongoRow = mongoDailyTimings[dateStr] || {};
    const reportEntry = reports.find((r) => new Date(r.date).toISOString().split("T")[0] === dateStr);

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
        hasActivityBeforeOpen: sqlRow.firstRegTrans && normOpen && new Date(sqlRow.firstRegTrans) < normOpen,
      },
    });

    current.setDate(current.getDate() + 1);
  }

  return {
    ...sqlResponse,
    operationalTimings,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Refresh dashboard cache for a single site.
 */
async function refreshSiteCache(siteName, csoCode) {
  const cacheKey = `dashboard:${siteName}:allSqlData`;
  const data = await buildDashboardData(csoCode, siteName);
  await redis.set(cacheKey, JSON.stringify(data), "EX", 90000); // 25 hours
  return data;
}

/**
 * Refresh dashboard cache for all sites.
 */
async function refreshAllSitesCache() {
  const locations = await Location.find({ type: "store" }).lean();
  console.log(`📊 Dashboard cache cron: refreshing ${locations.length} sites...`);

  for (const loc of locations) {
    try {
      await refreshSiteCache(loc.stationName, loc.csoCode);
      console.log(`  ✅ ${loc.stationName} cached`);
    } catch (err) {
      console.error(`  ❌ ${loc.stationName} failed:`, err.message);
    }
  }

  console.log("📊 Dashboard cache cron complete.");
}

// Schedule: 5:00 AM America/Toronto daily
cron.schedule("0 5 * * *", async () => {
  try {
    await refreshAllSitesCache();
  } catch (err) {
    console.error("Dashboard cache cron error:", err);
  }
}, { timezone: "America/Toronto" });

console.log("📊 Dashboard cache cron registered (daily at 5:00 AM America/Toronto)");

module.exports = { refreshSiteCache, refreshAllSitesCache, buildDashboardData };
