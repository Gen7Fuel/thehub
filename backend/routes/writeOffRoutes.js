const express = require('express');
const router = express.Router();
const WriteOff = require('../models/WriteOff');
const { getBulkOnHandQtyCSO } = require('../services/sqlService');


// GET /api/write-off/list?site=RANKIN
router.get('/list', async (req, res) => {
  const { site } = req.query;

  if (!site) {
    return res.status(400).json({ error: "Site parameter is required" });
  }

  try {
    // 1. Fetch lists for the specific site
    const lists = await WriteOff.find({ site })
      .select('listNumber status submittedBy items createdAt') // Only fetch what we need for the cards
      .lean();

    // 2. Sort Logic: Incomplete first, then Partial, then Complete. 
    // Within those groups, newest created date first.
    const statusPriority = { 'Incomplete': 1, 'Partial': 2, 'Complete': 3 };

    const sortedLists = lists.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sortedLists);
  } catch (error) {
    console.error("Error fetching write-off lists:", error);
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
  const { listNumber, site, submittedBy, items } = req.body;

  try {
    // 1. Extract unique GTINs for the SQL lookup (ignore manual entries)
    const gtinsToLookup = [
      ...new Set(items.filter(i => !i.isManualEntry && i.gtin).map(i => i.gtin))
    ];

    // 2. Fetch live SQL On-Hand Data
    const sqlInventory = await getBulkOnHandQtyCSO(site, gtinsToLookup);
    console.log('SQL Inventory Snapshot:', sqlInventory);

    // 3. Map SQL values back to items before saving to MongoDB
    const finalizedItems = items.map(item => {
      // If we found a match in SQL, update the field
      if (item.gtin && sqlInventory[item.gtin] !== undefined) {
        return {
          ...item,
          onHandAtWriteOff: sqlInventory[item.gtin]
        };
      }
      return item;
    });

    // 4. Create and Save the record in MongoDB
    const newWriteOff = new WriteOff({
      listNumber,
      site,
      submittedBy,
      items: finalizedItems,
      createdAt: new Date()
    });

    await newWriteOff.save();

    res.status(201).json({ 
      message: 'Write-off submitted with live inventory snapshots', 
      listNumber 
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ error: 'Failed to process write-off submission' });
  }
});

router.patch('/:id/items/:itemId', async (req, res) => {
  const { completed } = req.body;
  
  try {
    const list = await WriteOff.findById(req.params.id);
    const item = list.items.id(req.params.itemId);
    item.completed = completed;

    // Recalculate Master Status
    const totalItems = list.items.length;
    const completedItems = list.items.filter(i => i.completed).length;

    if (completedItems === 0) list.status = 'Incomplete';
    else if (completedItems === totalItems) list.status = 'Complete';
    else list.status = 'Partial';

    await list.save();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;