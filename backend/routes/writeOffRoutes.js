const express = require('express');
const router = express.Router();
const WriteOff = require('../models/WriteOff');
const { getBulkOnHandQtyCSO } = require('../services/sqlService');


// GET /api/write-off/list?site=RANKIN
router.get('/list', async (req, res) => {
  const { site, listType } = req.query; // Accept listType (WO or ATE)

  if (!site) return res.status(400).json({ error: "Site is required" });

  try {
    const query = { site };
    if (listType) query.listType = listType;

    const lists = await WriteOff.find(query)
      .select('listNumber status submittedBy items createdAt listType')
      .lean();

    const statusPriority = { 'Incomplete': 1, 'Partial': 2, 'Complete': 3 };

    const sortedLists = lists.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sortedLists);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/write-off/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await WriteOff.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Error fetching record details" });
  }
});

// Create a new write-off list
router.post('/', async (req, res) => {
  const { site, submittedBy, items, timestamp } = req.body;
  const siteCode = site?.toUpperCase() || 'NA';

  try {
    // 1. Extract unique GTINs for bulk lookup
    const gtins = [...new Set(items.map(i => i.gtin).filter(Boolean))];

    // 2. Fetch Bulk Stock Levels from SQL
    const stockMap = await getBulkOnHandQtyCSO(site, gtins);

    // 3. Attach the fresh stock levels to each item
    const processedItems = items.map(item => {
      // If item has a GTIN and exists in SQL results, use that. 
      // Otherwise, fallback to what the frontend sent or 0.
      const freshQty = item.gtin && stockMap[item.gtin] !== undefined 
        ? stockMap[item.gtin] 
        : (item.onHandAtWriteOff || 0);

      return {
        ...item,
        onHandAtWriteOff: freshQty
      };
    });

    // 4. Split items into two categories
    const standardItems = processedItems.filter(i => i.reason !== 'About to Expire');
    const ateItems = processedItems.filter(i => i.reason === 'About to Expire');

    const createdLists = [];

    // 5. Save Standard Write-Off List
    if (standardItems.length > 0) {
      const woList = new WriteOff({
        listNumber: `WO-${siteCode}-${timestamp}`,
        listType: 'WO',
        site,
        submittedBy,
        items: standardItems,
        status: 'Incomplete',
        submitted: false
      });
      await woList.save();
      createdLists.push(woList.listNumber);
    }

    // 6. Save About to Expire List
    if (ateItems.length > 0) {
      const ateList = new WriteOff({
        listNumber: `ATE-${siteCode}-${timestamp}`,
        listType: 'ATE',
        site,
        submittedBy,
        items: ateItems,
        status: 'Incomplete',
        submitted: false
      });
      await ateList.save();
      createdLists.push(ateList.listNumber);
    }

    // --- EMAIL QUEUE PLACEHOLDER ---
    // Logic for adding to email queue will go here later
    // --------------------------------
    
    res.status(201).json({
      success: true,
      lists: createdLists
    });

  } catch (err) {
    console.error("Creation Error:", err);
    res.status(500).json({ error: "Server failed to process write-off lists" });
  }
});

// PATCH /api/write-off/:id/items/:itemId/details
router.patch('/:id/items/:itemId/details', async (req, res) => {
  const { qty, reason, markdownAction } = req.body; // Add markdownAction here

  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    const item = list.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Update common fields
    item.qty = qty;
    item.isEdited = true;

    // Conditionally update based on List Type
    if (list.listType === 'ATE') {
      item.markdownAction = markdownAction;
    } else {
      item.reason = reason;
    }

    await list.save();
    res.json(list);
  } catch (err) {
    console.error("Patch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/write-off/:id/items/:itemId
router.patch('/:id/items/:itemId', async (req, res) => {
  const { completed } = req.body;

  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    // Find index instead of using .id() helper to be safer with string vs ObjectId
    const itemIndex = list.items.findIndex(i => i._id.toString() === req.params.itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in this list" });
    }

    // Update the item
    list.items[itemIndex].completed = completed;

    // Recalculate Master Status
    const totalItems = list.items.length;
    const completedCount = list.items.filter(i => i.completed).length;

    if (completedCount === 0) {
      list.status = 'Incomplete';
    } else if (completedCount === totalItems) {
      list.status = 'Complete';
    } else {
      list.status = 'Partial';
    }

    // Mark as modified (Mongoose sometimes needs this for subdocument arrays)
    list.markModified('items');

    const updatedList = await list.save();
    res.json(updatedList);

  } catch (err) {
    console.error("PATCH ERROR:", err); // Look at your terminal for this!
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// PATCH /api/write-off/:id/finalize
router.patch('/:id/finalize', async (req, res) => {
  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    if (list.submitted) {
      return res.status(400).json({ error: "This list has already been submitted." });
    }

    // 1. Mark as submitted and ensure status is Complete
    list.submitted = true;
    list.status = 'Complete';

    // 2. Save the document
    const finalizedList = await list.save();

    // --- EMAIL QUEUE PLACEHOLDER ---
    // Logic for adding to email queue will go here later
    // --------------------------------

    console.log(`List ${list.listNumber} finalized by ${req.user.email}`);
    res.json(finalizedList);
  } catch (err) {
    console.error("Finalize Error:", err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;