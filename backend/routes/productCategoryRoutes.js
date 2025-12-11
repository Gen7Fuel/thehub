const express = require("express");
const router = express.Router();
const CycleCount = require("../models/CycleCount");
const ProductCategory = require("../models/ProductCategory");

/**
 * GET /api/variance
 * Returns a map of categoryNumber => CycleCountVariance
 * Example response:
 * { 130: 3, 160: 0, 105: 18 }
 */
router.get("/cycle-count-variance", async (req, res) => {
  try {
    // 1. Get all unique categoryNumbers from cyclecount
    const categoryNumbers = await CycleCount.distinct("categoryNumber", {
      categoryNumber: { $exists: true }
    });

    // 2. Fetch variance for those category numbers from ProductCategory
    const categories = await ProductCategory.find({
      Number: { $in: categoryNumbers }
    }).select("Number CycleCountVariance -_id");

    // 3. Create map
    const varianceMap = {};
    categories.forEach(cat => {
      varianceMap[cat.Number] = cat.CycleCountVariance;
    });

    res.json({ varianceMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;