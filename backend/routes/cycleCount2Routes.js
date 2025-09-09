const express = require('express');
const router = express.Router();
const { Cycle, Item, CycleItem } = require('../models/CycleCount2');

// Get the next Monday or today if it's Monday
function getNextMondayOrToday() {
  const today = new Date();
  const day = today.getDay();
  if (day === 1) return today;
  const diff = (8 - day) % 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + diff);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

function getCycleDays(startDate, totalItems, itemsPerDay = 30) {
  const days = [];
  let date = new Date(startDate);
  let itemsLeft = totalItems;
  while (itemsLeft > 0) {
    // Skip weekends
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      days.push({ date: new Date(date), completed: false });
      itemsLeft -= itemsPerDay;
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
}

router.post('/generate-cycle', async (req, res) => {
  try {
    // Get the site from the request body
    const { site } = req.body;
    if (!site) return res.status(400).json({ error: 'Site is required.' });

    // Get the start date for the cycle
    const startDate = getNextMondayOrToday();
    
    // Get all items for the site
    const items = await Item.find({ site });
    if (!items.length) {
      return res.status(400).json({ error: 'No items found for this site.' });
    }

    const days = getCycleDays(startDate, items.length, 30);
    const cycle = await Cycle.create({ site, startDate, completed: false, days });

    // Map items to cycle items
    const cycleItems = items
    .filter(item => item.upc) // Only include items with a valid upc
    .map(item => ({
      cycleId: cycle._id,
      upc: item.upc,
      name: item.name,
      category: item.category,
      grade: item.grade,
      foh: 0,
      boh: 0,
    }));

    // Create cycle items
    await CycleItem.insertMany(cycleItems);

    res.json({ success: true, cycleId: cycle._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate cycle.' });
  }
});

// Bulk upsert processed items
router.post('/items/bulk-create', async (req, res) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided.' });
    }

    // 1. Delete all existing items
    await Item.deleteMany({});

    // 2. Insert new items
    await Item.insertMany(items);

    // 3. For each site, check for active cycle, create if needed
    const sites = [...new Set(items.map(item => item.site))];
    for (const site of sites) {
      const activeCycle = await Cycle.findOne({ site, completed: { $ne: true } });
      if (!activeCycle) {
        const startDate = getNextMondayOrToday();
        const siteItems = items.filter(item => item.site === site);
        const days = getCycleDays(startDate, siteItems.length, 30);
        const cycle = await Cycle.create({ site, startDate, completed: false, days });
        const cycleItems = siteItems.map(item => ({
          cycleId: cycle._id,
          upc: item.upc,
          name: item.name,
          category: item.category,
          grade: item.grade,
          foh: 0,
          boh: 0,
        }));
        await CycleItem.insertMany(cycleItems);
      }
    }

    res.json({ success: true, message: 'Items replaced and cycles checked/created.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process items.' });
  }
});

// Get a cycle and its items, sorted by category, grade (A, B, C), then name
router.get('/cycles/:id', async (req, res) => {
  try {
    const cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found.' });

    // Fetch all CycleItems for this cycle
    const items = await CycleItem.find({ cycleId: cycle._id }).lean();

    // Sort by category, then grade (A, B, C), then name
    const gradeOrder = { A: 1, B: 2, C: 3 };
    items.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (gradeOrder[a.grade] !== gradeOrder[b.grade]) return gradeOrder[a.grade] - gradeOrder[b.grade];
      return a.name.localeCompare(b.name);
    });

    res.json({
      ...cycle.toObject(),
      items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cycle.' });
  }
});

router.post('/cycles/:id/complete', async (req, res) => {
  try {
    const cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found.' });

    cycle.completed = true;
    await cycle.save();

    // Generate new cycle for the same site, starting next Monday
    const startDate = (() => {
      const today = new Date();
      const day = today.getDay();
      const diff = (8 - day) % 7 || 7; // Always next Monday
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + diff);
      nextMonday.setHours(0, 0, 0, 0);
      return nextMonday;
    })();

    const items = await Item.find({ site: cycle.site });
    const newCycle = await Cycle.create({ site: cycle.site, startDate, completed: false });
    const cycleItems = items.map(item => ({
      cycleId: newCycle._id,
      upc: item.upc,
      name: item.name,
      category: item.category,
      grade: item.grade,
      foh: 0,
      boh: 0,
    }));
    await CycleItem.insertMany(cycleItems);

    res.json({ success: true, message: 'Cycle marked complete and new cycle created.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete cycle.' });
  }
});

router.put('/cycles/:id/items', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided.' });
    }

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { cycleId: req.params.id, upc: item.upc },
        update: {
          $set: {
            foh: item.foh ?? 0,
            boh: item.boh ?? 0,
          }
        }
      }
    }));

    await CycleItem.bulkWrite(bulkOps);

    // Update the Cycle's updatedAt timestamp
    await Cycle.findByIdAndUpdate(req.params.id, { $set: { updatedAt: new Date() } });

    res.json({ success: true, message: 'Cycle items updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cycle items.' });
  }
});

// GET /api/cycle-counts/cycles?site=SiteName
router.get('/cycles', async (req, res) => {
  try {
    const { site } = req.query;
    const query = site ? { site } : {};
    const cycles = await Cycle.find(query).sort({ startDate: -1 });
    res.json({ cycles });
  } catch (err) {
    console.error('Error fetching cycles:', err);
    res.status(500).json({ error: 'Failed to fetch cycles.' });
  }
});

router.put('/cycles/:id/day/:dayIndex/complete', async (req, res) => {
  try {
    const { completed } = req.body; // true or false
    const cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found.' });

    if (!cycle.days[req.params.dayIndex]) {
      return res.status(400).json({ error: 'Invalid day index.' });
    }

    cycle.days[req.params.dayIndex].completed = completed;
    await cycle.save();

    res.json({ success: true, days: cycle.days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update day status.' });
  }
});

module.exports = router;