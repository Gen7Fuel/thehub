const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { fromZonedTime } = require("date-fns-tz");
const { startOfMonth, endOfMonth, parseISO } = require("date-fns");

// Reuse existing registered models safely
const FuelOrder = mongoose.models.FuelOrder || require("../../models/Fuel/FuelOrder");
const Location = mongoose.models.Location || require("../../models/Location");
const FuelSales = mongoose.models.FuelSales || require("../../models/FuelSales");
const FuelSalesArchived =
  mongoose.models.FuelSalesArchived || require("../../models/FuelSalesArchived");

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

    // 3. Query Orders and populate Carrier & Rack for Dialog Details
    const orders = await FuelOrder.find(
      {
        station: { $in: validStationObjectIds },
        $or: dateFilters,
      },
      "poNumber orderDate estimatedDeliveryDate currentStatus station items carrier supplier rack"
    )
      .populate("carrier", "name carrierName")
      .populate("rack", "name rackName")
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