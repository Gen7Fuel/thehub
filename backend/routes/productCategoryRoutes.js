const express = require("express");
const router = express.Router();
const ProductCategory = require("../models/ProductCategory");
const CycleCount = require('../models/CycleCount');
const OrderRec = require('../models/OrderRec');
const { logChange } = require('../middleware/changeLogger');

// ------------------- GET all categories (optionally with search) -------------------
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};
    if (search) {
      // Search by name or number
      query = {
        $or: [
          { Name: { $regex: search, $options: 'i' } },
          { Number: Number(search) || -1 } // if search is a number
        ]
      };
    }

    const categories = await ProductCategory.find(query).sort({ Number: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ------------------- POST: Create new category -------------------
router.post('/', async (req, res) => {
  try {
    const { Name, Number, CycleCountVariance, OrderRecVariance } = req.body;

    if (!Name || Number === undefined) {
      return res.status(400).json({ message: 'Name and Number are required.' });
    }

    const newCategory = new ProductCategory({
      Name,
      Number,
      CycleCountVariance: CycleCountVariance ?? 1,
      OrderRecVariance: OrderRecVariance ?? 1
    });

    const savedCategory = await newCategory.save();
    await logChange(req, {
      action: 'create',
      resourceType: 'product-category',
      resourceId: savedCategory._id,
      success: true,
      statusCode: 201,
      source: 'category.management',
      resourceLabel: `${savedCategory.Number} — ${savedCategory.Name}`,
      before: null,
      after: savedCategory.toObject(),
    });
    res.status(201).json(savedCategory);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Category with this Name and Number already exists.' });
    }
    res.status(500).json({ message: err.message });
  }
});

// ------------------- PUT: Update existing category -------------------
router.put('/:id', async (req, res) => {
  try {
    const { Name, Number, CycleCountVariance, OrderRecVariance } = req.body;

    const category = await ProductCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });

    const before = category.toObject();
    const oldNumber = category.Number;

    if (Name !== undefined) category.Name = Name;
    if (Number !== undefined) category.Number = Number;
    if (CycleCountVariance !== undefined) category.CycleCountVariance = CycleCountVariance;
    if (OrderRecVariance !== undefined) category.OrderRecVariance = OrderRecVariance;

    const updatedCategory = await category.save();

    // If Number has changed, propagate to CycleCount and OrderRec
    let cycleCountResult;
    let orderRecResult;
    const numberChanged = Number !== undefined && Number !== oldNumber;
    if (numberChanged) {
      // Update CycleCount.categoryNumber
      cycleCountResult = await CycleCount.updateMany(
        { categoryNumber: oldNumber },
        { $set: { categoryNumber: Number } }
      );

      // Update OrderRec.categories.number
      orderRecResult = await OrderRec.updateMany(
        { 'categories.number': oldNumber },
        { $set: { 'categories.$[elem].number': Number } },
        { arrayFilters: [{ 'elem.number': oldNumber }] }
      );
    }

    const propagatedCount = (cycleCountResult?.modifiedCount || 0) + (orderRecResult?.modifiedCount || 0);
    await logChange(req, {
      action: 'update',
      resourceType: 'product-category',
      resourceId: updatedCategory._id,
      success: true,
      statusCode: 200,
      source: 'category.management',
      message: numberChanged
        ? `Product category ${updatedCategory.Name} updated; category number changed from ${oldNumber} to ${updatedCategory.Number} and propagated to ${propagatedCount} related records`
        : undefined,
      resourceLabel: `${updatedCategory.Number} — ${updatedCategory.Name}`,
      before,
      after: updatedCategory.toObject(),
      bulk: numberChanged
        ? { affectedCount: propagatedCount, truncated: false }
        : undefined,
    });
    res.json(updatedCategory);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Category with this Name and Number already exists.' });
    }
    res.status(500).json({ message: err.message });
  }
});

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
