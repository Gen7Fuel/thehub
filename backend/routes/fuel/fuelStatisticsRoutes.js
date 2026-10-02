const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { fromZonedTime } = require("date-fns-tz");
const { startOfMonth, endOfMonth, parseISO, addDays } = require("date-fns");

// Reuse existing registered models safely
const FuelOrder =
  mongoose.models.FuelOrder || require("../../models/fuel/FuelOrder");
const Location = mongoose.models.Location || require("../../models/Location");
const FuelSales =
  mongoose.models.FuelSales || require("../../models/fuel/FuelSales");
const FuelSalesArchived =
  mongoose.models.FuelSalesArchived ||
  require("../../models/fuel/FuelSalesArchived");
const FuelStationTank =
  mongoose.models.FuelStationTank || require("../../models/fuel/FuelStationTank");


function getStationLocalDate(timezone, offsetDays = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(new Date()).split("-").map(Number);
  return addDays(new Date(Date.UTC(year, month - 1, day)), offsetDays);
}

function getDayName(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
}

function removeSalesOutliers(volumes) {
  if (volumes.length <= 2) return volumes;

  return volumes.filter((value, index, self) => {
    const others = self.filter((_, i) => i !== index);
    const avgOfOthers = others.reduce((sum, item) => sum + item, 0) / others.length;

    if (avgOfOthers <= 0) return value > 0;

    return value >= avgOfOthers * 0.5 && value <= avgOfOthers * 1.5;
  });
}

async function getSixWeekAverageSales(stationId, grade, targetDate) {
  const dayOfWeek = getDayName(targetDate);
  const startOfTarget = new Date(targetDate);
  startOfTarget.setUTCHours(0, 0, 0, 0);

  const query = {
    stationId,
    dayOfWeek,
    date: { $lt: startOfTarget },
  };

  const [liveSales, archivedSales] = await Promise.all([
    FuelSales.find(query).sort({ date: -1 }).limit(8).lean(),
    FuelSalesArchived.find(query).sort({ date: -1 }).limit(8).lean(),
  ]);

  const salesByDate = new Map();
  [...liveSales, ...archivedSales]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((record) => {
      const key = new Date(record.date).toISOString().split("T")[0];
      if (!salesByDate.has(key)) salesByDate.set(key, record);
    });

  const volumes = Array.from(salesByDate.values())
    .slice(0, 6)
    .map((record) => {
      const salesEntry = (record.salesData || []).find((item) => item.grade === grade);
      return Number(salesEntry?.volume) || 0;
    })
    .filter((volume) => volume > 0);

  const cleaned = removeSalesOutliers(volumes);
  if (cleaned.length === 0) return 0;

  const sample = cleaned.slice(0, 6);
  return sample.reduce((sum, volume) => sum + volume, 0) / sample.length;
}
router.post("/pipeline-summary", async (req, res) => {
  try {
    const { stationIds, fromMonth, toMonth } = req.body;

    if (!fromMonth || !toMonth) {
      return res.status(400).json({ error: "both 'fromMonth' and 'toMonth' ISO strings are required." });
    }

    const parsedFrom = parseISO(fromMonth);
    const parsedTo = parseISO(toMonth);

    // Get true local month start (00:00:00.000) and month end (23:59:59.999)
    const localStart = startOfMonth(parsedFrom);
    const localEnd = endOfMonth(parsedTo);

    // 1. Fetch requested locations
    let stationQuery = {};
    if (stationIds && Array.isArray(stationIds) && stationIds.length > 0) {
      stationQuery._id = { $in: stationIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const locations = await Location.find(stationQuery, "_id timezone site stationName").lean();
    if (locations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const validStationObjectIds = locations.map((loc) => loc._id);

    // 2. Build precise date range bounds per station timezone
    const dateFilters = locations.map((loc) => {
      const tz = loc.timezone || "America/Toronto";

      // Accurately convert local target times in timezone 'tz' to UTC Date objects
      const startUtc = fromZonedTime(localStart, tz);
      const endUtc = fromZonedTime(localEnd, tz);

      return {
        station: loc._id,
        estimatedDeliveryDate: {
          $gte: startUtc,
          $lte: endUtc,
        },
      };
    });

    // 3. Query orders once and populate every relationship used by the charts.
    const orders = await FuelOrder.find(
      {
        station: { $in: validStationObjectIds },
        $or: dateFilters,
      },
      "poNumber orderDate originalDeliveryDate originalDeliveryWindow estimatedDeliveryDate estimatedDeliveryWindow currentStatus station items carrier supplier rack badgeNo comments"
    )
      .populate("carrier", "name carrierName")
      .populate("rack", "name rackName rackLocation")
      .populate("supplier", "name supplierName")
      .populate("station", "site stationName")
      .lean();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching pipeline summary data:", error);
    res.status(500).json({ error: "Failed to fetch pipeline analytics data." });
  }
});


router.post("/inventory-coverage", async (req, res) => {
  try {
    const { stationGradePairs, horizonDays = 14 } = req.body;

    if (!Array.isArray(stationGradePairs) || stationGradePairs.length === 0) {
      return res.json({ success: true, data: { byGrade: {}, forecastDays: [] } });
    }

    const normalizedPairs = stationGradePairs
      .map((pair) => ({
        stationId: String(pair.stationId || ""),
        grade: String(pair.grade || ""),
      }))
      .filter((pair) => mongoose.Types.ObjectId.isValid(pair.stationId) && pair.grade);

    if (normalizedPairs.length === 0) {
      return res.json({ success: true, data: { byGrade: {}, forecastDays: [] } });
    }

    const uniqueStationIds = [...new Set(normalizedPairs.map((pair) => pair.stationId))];
    const selectedStationObjectIds = uniqueStationIds.map((id) => new mongoose.Types.ObjectId(id));

    const [locations, tanks] = await Promise.all([
      Location.find({ _id: { $in: selectedStationObjectIds } }, "_id timezone").lean(),
      FuelStationTank.find({ stationId: { $in: selectedStationObjectIds } }, "stationId grade").lean(),
    ]);

    const locationById = new Map(locations.map((location) => [String(location._id), location]));
    const tankGradesByStation = new Map();
    tanks.forEach((tank) => {
      const stationId = String(tank.stationId);
      if (!tankGradesByStation.has(stationId)) tankGradesByStation.set(stationId, new Set());
      tankGradesByStation.get(stationId).add(tank.grade);
    });

    const uniquePairs = Array.from(
      new Map(normalizedPairs.map((pair) => [`${pair.stationId}:${pair.grade}`, pair])).values(),
    );
    const safeHorizonDays = Math.min(Math.max(Number(horizonDays) || 14, 1), 30);
    const byGrade = {};
    const forecastDays = [];

    for (let offset = 1; offset <= safeHorizonDays; offset += 1) {
      const dayTotals = {};

      await Promise.all(
        uniquePairs.map(async ({ stationId, grade }) => {
          const location = locationById.get(stationId);
          const timezone = location?.timezone || "America/Toronto";
          const targetDate = getStationLocalDate(timezone, offset);
          const stationGrades = tankGradesByStation.get(stationId) || new Set();
          const salesGrade = grade === "E15" && !stationGrades.has("E15") ? "Regular" : grade;
          const averageSales = await getSixWeekAverageSales(stationId, salesGrade, targetDate);

          byGrade[grade] = byGrade[grade] || { totalEstimatedSales: 0, forecast: [] };
          byGrade[grade].totalEstimatedSales += averageSales;
          byGrade[grade].forecast.push({
            stationId,
            date: targetDate.toISOString().split("T")[0],
            dayOfWeek: getDayName(targetDate),
            estimatedSales: Number(averageSales.toFixed(2)),
          });

          dayTotals[grade] = (dayTotals[grade] || 0) + averageSales;
        }),
      );

      forecastDays.push({
        offset,
        grades: Object.fromEntries(
          Object.entries(dayTotals).map(([grade, volume]) => [grade, Number(volume.toFixed(2))]),
        ),
      });
    }

    Object.keys(byGrade).forEach((grade) => {
      byGrade[grade].averageDailySales = Number(
        (byGrade[grade].totalEstimatedSales / safeHorizonDays).toFixed(2),
      );
      byGrade[grade].totalEstimatedSales = Number(byGrade[grade].totalEstimatedSales.toFixed(2));
    });

    res.json({
      success: true,
      data: {
        byGrade,
        forecastDays,
      },
    });
  } catch (error) {
    console.error("Error fetching inventory coverage forecast:", error);
    res.status(500).json({ error: "Failed to fetch inventory coverage forecast." });
  }
});

// --- 2. SALES SUMMARY ROUTE (Live + Archived) ---
router.post("/sales-summary", async (req, res) => {
  try {
    const { stationIds, fromMonth, toMonth } = req.body;

    if (!fromMonth || !toMonth) {
      return res.status(400).json({ error: "both 'fromMonth' and 'toMonth' ISO strings are required." });
    }

    const parsedFrom = parseISO(fromMonth);
    const parsedTo = parseISO(toMonth);

    const startDate = startOfMonth(parsedFrom);
    const endDate = endOfMonth(parsedTo);

    let stationFilter = [];
    if (stationIds && Array.isArray(stationIds) && stationIds.length > 0) {
      stationFilter = stationIds.map((id) => new mongoose.Types.ObjectId(id));
    }

    const matchStage = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    if (stationFilter.length > 0) {
      matchStage.stationId = { $in: stationFilter };
    }

    const pipeline = [
      { $match: matchStage },
      { $unwind: "$salesData" },
      {
        $group: {
          _id: {
            dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "UTC" } },
            grade: "$salesData.grade",
          },
          totalVolume: { $sum: "$salesData.volume" },
        },
      },
      {
        $group: {
          _id: "$_id.dateStr",
          salesData: {
            $push: {
              grade: "$_id.grade",
              volume: "$totalVolume",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    // Concurrently aggregate live and archived sales
    const [liveSales, archivedSales] = await Promise.all([
      FuelSales.aggregate(pipeline),
      FuelSalesArchived.aggregate(pipeline),
    ]);

    // Merge live & archived daily maps safely
    const mergedMap = new Map();

    [...archivedSales, ...liveSales].forEach((item) => {
      const dateStr = item._id;
      if (!mergedMap.has(dateStr)) {
        mergedMap.set(dateStr, new Map());
      }

      const gradeMap = mergedMap.get(dateStr);
      item.salesData.forEach(({ grade, volume }) => {
        gradeMap.set(grade, (gradeMap.get(grade) || 0) + volume);
      });
    });

    const result = Array.from(mergedMap.entries())
      .map(([date, gradeMap]) => ({
        date,
        salesData: Array.from(gradeMap.entries()).map(([grade, volume]) => ({
          grade,
          volume: Number(volume.toFixed(2)),
        })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching fuel sales summary:", error);
    res.status(500).json({ error: "Failed to fetch sales analytics data." });
  }
});

module.exports = router;



