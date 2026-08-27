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
 *
 * Returns { data, failedQueries } — failedQueries lists any SQL queries that
 * failed after retries. The payload still contains data (with [] in place of
 * whatever failed) so a caller can use it as a best-effort live response, but
 * callers MUST check failedQueries before caching the result: caching a
 * partial/degraded payload would bake a transient SQL failure into Redis for
 * the full TTL.
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

  const { _failedQueries: failedQueries, ...sqlData } = sqlResponse;

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
    const sqlRow = sqlData.shiftTransactionTimings.find((row) => row.Date_SK === sqlDateSK) || {};
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
    data: {
      ...sqlData,
      operationalTimings,
      lastUpdated: new Date().toISOString(),
    },
    failedQueries,
  };
}

/**
 * Refresh dashboard cache for a single site.
 *
 * Skips the Redis write (leaving whatever cache entry already exists in
 * place) if any of the underlying SQL queries failed after retries — a
 * transient MSSQL blip must not get baked into a 25-hour cache entry and
 * make the dashboard look blank all day. The freshly-built data is still
 * returned so callers (e.g. the admin refresh endpoint) get a best-effort
 * result even when caching was skipped.
 */
async function refreshSiteCache(siteName, csoCode) {
  const cacheKey = `dashboard:${siteName}:allSqlData`;
  const { data, failedQueries } = await buildDashboardData(csoCode, siteName);

  if (failedQueries.length > 0) {
    console.error(`  ⚠️ ${siteName}: SQL queries failed after retries (${failedQueries.join(", ")}) — not caching degraded data, leaving existing cache in place`);
    return data;
  }

  await redis.set(cacheKey, JSON.stringify(data), "EX", 90000); // 25 hours
  console.log(`  ✅ ${siteName} cached`);
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
    } catch (err) {
      console.error(`  ❌ ${loc.stationName} failed:`, err.message);
    }
  }

  console.log("📊 Dashboard cache cron complete.");
}

// Schedule: 8:00 AM America/Toronto daily
cron.schedule("0 8 * * *", async () => {
  try {
    await refreshAllSitesCache();
  } catch (err) {
    console.error("Dashboard cache cron error:", err);
  }
}, { timezone: "America/Toronto" });

console.log("📊 Dashboard cache cron registered (daily at 8:00 AM America/Toronto)");

module.exports = { refreshSiteCache, refreshAllSitesCache, buildDashboardData };
