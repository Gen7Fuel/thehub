const express = require('express');
const router = express.Router();
const OrderRec = require('../models/OrderRec');

// Get all
router.get('/', async (req, res) => {
  try {
    const { site, vendor, date } = req.query;
    const query = {};

    if (site) query.site = site;
    if (vendor) query.vendor = vendor;
    if (date) {
      // Expecting date in 'YYYY-MM-DD' format
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orderRecs = await OrderRec.find(query).sort({ createdAt: -1 });
    res.json(orderRecs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec) return res.status(404).json({ message: 'Not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update item completion
router.put('/:id/item/:catIdx/:itemIdx', async (req, res) => {
  try {
    const { completed } = req.body;
    const orderRec = await OrderRec.findById(req.params.id);
    if (!orderRec) return res.status(404).json({ message: 'Not found' });

    const catIdx = Number(req.params.catIdx);
    const itemIdx = Number(req.params.itemIdx);

    // Validate indices
    if (
      !orderRec.categories ||
      catIdx < 0 ||
      catIdx >= orderRec.categories.length ||
      !orderRec.categories[catIdx].items ||
      itemIdx < 0 ||
      itemIdx >= orderRec.categories[catIdx].items.length
    ) {
      return res.status(400).json({ message: 'Invalid category or item index' });
    }

    const category = orderRec.categories[catIdx];
    const item = category.items[itemIdx];
    item.completed = completed;

    // Update category completion
    category.completed = category.items.every(i => i.completed);

    // Update orderRec completion
    orderRec.completed = orderRec.categories.every(c => c.completed);

    orderRec.markModified('categories'); // Ensure Mongoose tracks changes
    await orderRec.save();
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update one
router.put('/:id', async (req, res) => {
  try {
    const update = {};
    if ('categories' in req.body) update.categories = req.body.categories;
    if ('orderPlaced' in req.body) update.orderPlaced = req.body.orderPlaced;
    if ('delivered' in req.body) update.delivered = req.body.delivered;

    const orderRec = await OrderRec.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!orderRec) return res.status(404).json({ message: 'Not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// router.put('/:id', async (req, res) => {
//   try {
//     const { categories } = req.body;
//     const orderRec = await OrderRec.findByIdAndUpdate(
//       req.params.id,
//       { categories },
//       { new: true }
//     );
//     if (!orderRec) return res.status(404).json({ message: 'Not found' });
//     res.json(orderRec);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// Create one
router.post('/', async (req, res) => {
  try {
    const { categories, site, vendor, email } = req.body;
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'Categories are required.' });
    }
    if (!site) {
      return res.status(400).json({ message: 'Site is required.' });
    }
    if (!vendor) {
      return res.status(400).json({ message: 'Vendor is required.' });
    }

    // Set onHandQtyOld and casesToOrderOld for each item
    const categoriesWithOld = categories.map(category => ({
      ...category,
      items: category.items.map(item => ({
        ...item,
        onHandQtyOld: item.onHandQty,
        casesToOrderOld: item.casesToOrder,
      })),
    }));

    const orderRec = new OrderRec({ categories: categoriesWithOld, site, vendor, email });
    await orderRec.save();
    res.status(201).json(orderRec);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/order-rec/:id
router.patch('/:id', async (req, res) => {
  try {
    const { extraItemsNote } = req.body;
    const orderRec = await OrderRec.findByIdAndUpdate(
      req.params.id,
      { extraItemsNote },
      { new: true }
    );
    if (!orderRec) return res.status(404).json({ error: 'Order rec not found' });
    res.json(orderRec);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update extra items note' });
  }
});

// Delete an order rec by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await OrderRec.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Order rec not found.' });
    }
    res.json({ success: true, message: 'Order rec deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order rec.' });
  }
});

module.exports = router;