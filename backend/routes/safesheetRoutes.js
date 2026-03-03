const express = require('express');
const router = express.Router();
const Safesheet = require('../models/Safesheet');
const { logAction } = require('../middleware/actionLogger');


/**
 * check for a existing safesheet for a site
 * GET /api/safesheets/:site (here :site is site name)
 */
router.get('/:site', async (req, res) => {
  try {
    const { site } = req.params;
    const sheet = await Safesheet.findOne({ site });
    try {
      await logAction(req, {
        action: 'read',
        resourceType: 'safesheet',
        resourceId: sheet?._id,
        success: true,
        statusCode: 200,
        message: `Safesheet exists check for site: ${site}`,
      });
    } catch (e) { }
    return res.status(200).json({ exists: !!sheet });
  } catch (err) {
    try { await logAction(req, { action: 'read', resourceType: 'safesheet', success: false, statusCode: 500, message: err.message }); } catch (_) { }
    return res.status(500).json({ error: err.message });
  }
});
/**
 * Create a new safesheet (site)
 * POST /api/safesheets
 * body: { site: string, initialBalance?: number }
 */
router.post('/', async (req, res) => {
  try {
    const { site, initialBalance } = req.body;
    if (!site) return res.status(400).json({ error: 'site is required' });
    const sheet = await Safesheet.create({ site, initialBalance });
    try {
      await logAction(req, {
        action: 'create',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 201,
        message: `Safesheet created for site: ${site}`,
        after: { site, initialBalance },
      });
    } catch (e) { }
    return res.status(201).json(sheet);
  } catch (err) {
    if (!req.body?.site) {
      try { await logAction(req, { action: 'create', resourceType: 'safesheet', success: false, statusCode: 400, message: 'site is required' }); } catch (_) { }
    } else {
      try { await logAction(req, { action: 'create', resourceType: 'safesheet', success: false, statusCode: 500, message: err.message }); } catch (_) { }
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Add an entry to a safesheet by site
 * POST /api/safesheets/site/:site/entries
 * body: { date, description?, cashIn?, cashExpenseOut?, cashDepositBank? }
 */
router.post('/site/:site/entries', async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.date) return res.status(400).json({ error: 'entry.date is required' });

    const sheet = await Safesheet.findOne({ site: req.params.site });
    if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' });

    sheet.entries.push(entry);
    await sheet.save();

    const entriesWithRunning = sheet.getEntriesWithRunningBalance();
    try {
      await logAction(req, {
        action: 'update',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 201,
        message: `Safesheet entry added for site: ${req.params.site}`,
        after: {
          entryDate: entry.date,
          cashIn: entry.cashIn,
          cashExpenseOut: entry.cashExpenseOut,
          cashDepositBank: entry.cashDepositBank,
        },
      });
    } catch (e) { }
    return res.status(201).json({ entries: entriesWithRunning });
  } catch (err) {
    try { await logAction(req, { action: 'update', resourceType: 'safesheet', success: false, statusCode: err.status || 500, message: err.message }); } catch (_) { }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get a safesheet and its entries with computed running balance
 * GET /api/safesheets/site/:site
 */
// Helpers for YYYY-MM-DD parsing
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Get a safesheet and entries (filtered by date range) with running balance
// GET /api/safesheets/site/:site?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/site/:site', async (req, res) => {
  try {
    const site = req.params.site
    if (!site) return res.status(400).json({ error: 'site is required' })

    // Build 7-day default range including today if missing or invalid
    const { from, to } = req.query || {}
    const today = new Date()
    const endD = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
    const startD = new Date(endD); startD.setDate(endD.getDate() - 6)

    const fromYmd = isYmd(from) ? String(from) : ymd(startD)
    const toYmd = isYmd(to) ? String(to) : ymd(endD)

    const [fy, fm, fd] = fromYmd.split('-').map(Number)
    const [ty, tm, td] = toYmd.split('-').map(Number)
    const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0)
    const end = new Date(ty, tm - 1, td, 23, 59, 59, 999)

    const sheet = await Safesheet.findOne({ site })
    if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' })

    // Use alternate sorting if sortAssigned=true
    let allEntries;
    if (req.query.sortAssigned === 'true') {
      allEntries = sheet.getEntriesWithAssignedDateGrouping();
    } else {
      allEntries = sheet.getEntriesWithRunningBalance();
    }
    const inRange = allEntries.filter(e => {
      // Use assignedDate for range if sorting by assignedDate
      const d = (req.query.sortAssigned === 'true' && e.assignedDate && /^\d{4}-\d{2}-\d{2}$/.test(e.assignedDate))
        ? new Date(e.assignedDate)
        : new Date(e.date);
      return d >= start && d <= end;
    });

    const payload = {
      _id: sheet._id,
      site: sheet.site,
      initialBalance: sheet.initialBalance,
      from: fromYmd,
      to: toYmd,
      entries: inRange,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt,
    };

    try {
      await logAction(req, {
        action: 'read',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 200,
        message: `Safesheet read for site: ${site} (${fromYmd} to ${toYmd})`,
      });
    } catch (e) { }
    return res.json(payload)
  } catch (err) {
    console.error('Safesheet site range error:', err)
    try { await logAction(req, { action: 'read', resourceType: 'safesheet', success: false, statusCode: 500, message: 'Failed to load safesheet range' }); } catch (_) { }
    return res.status(500).json({ error: 'Failed to load safesheet range' })
  }
})
// router.get('/site/:site', async (req, res) => {
//   try {
//     const sheet = await Safesheet.findOne({ site: req.params.site });
//     if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' });

//     const entries = sheet.getEntriesWithRunningBalance();
//     return res.json({
//       _id: sheet._id,
//       site: sheet.site,
//       initialBalance: sheet.initialBalance,
//       entries,
//       createdAt: sheet.createdAt,
//       updatedAt: sheet.updatedAt,
//     });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// });

/**
 * Get current Cash On Hand (Safe) for a site
 * GET /api/safesheets/site/:site/current
 * Response: { site: string, cashOnHandSafe: number }
 */
router.get('/site/:site/current', async (req, res) => {
  try {
    const sheet = await Safesheet.findOne({ site: req.params.site });
    if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' });

    const entries = sheet.getEntriesWithRunningBalance();
    let current = Number(sheet.initialBalance || 0);
    if (entries && entries.length) {
      const last = entries[entries.length - 1];
      current = Number(last.cashOnHandSafe ?? current);
    }

    const result = { site: sheet.site, cashOnHandSafe: Number(current.toFixed(2)) };
    try {
      await logAction(req, {
        action: 'read',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 200,
        message: `Safesheet current balance for site: ${req.params.site}`,
      });
    } catch (e) { }
    return res.json(result);
  } catch (err) {
    try { await logAction(req, { action: 'read', resourceType: 'safesheet', success: false, statusCode: 500, message: err.message }); } catch (_) { }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get running Cash On Hand (Safe) for a site for N Days
 * GET /api/safesheets/site/:site/daily-balances
 * Response: { data: array of { date: string, cashOnHandSafe: number, totalDepositBank: number } }
 */
router.get('/site/:site/daily-balances', async (req, res) => {
  try {
    const { site } = req.params;
    const { from, to } = req.query; // Extract date range

    const sheet = await Safesheet.findOne({ site });
    if (!sheet) {
      return res.status(404).json({ error: 'Safesheet not found for site' });
    }

    // Pass the strings directly to the method
    const data = sheet.getDailyBalances(from, to);

    try {
      await logAction(req, {
        action: 'read',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 200,
        message: `Safesheet daily balances for site: ${site} range: ${from} to ${to}`,
      });
    } catch (e) { }
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


/**
 * Update a specific entry by its _id
 * PUT /api/safesheets/site/:site/entries/:entryId
 * body: { description?, cashIn?, cashExpenseOut?, cashDepositBank? }
 */
router.put('/site/:site/entries/:entryId', async (req, res) => {
  try {
    const { site, entryId } = req.params;
    const updates = req.body;

    const sheet = await Safesheet.findOne({ site });
    if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' });

    const entryIndex = sheet.entries.findIndex(e => e._id.toString() === entryId);
    if (entryIndex === -1) return res.status(404).json({ error: 'Entry not found' });

    // Update the entry
    const beforeEntry = sheet.entries[entryIndex].toObject();
    sheet.entries[entryIndex] = { ...beforeEntry, ...updates, updatedAt: new Date() };

    await sheet.save();

    const entriesWithRunning = sheet.getEntriesWithRunningBalance();
    try {
      await logAction(req, {
        action: 'update',
        resourceType: 'safesheet',
        resourceId: sheet._id,
        success: true,
        statusCode: 200,
        message: `Safesheet entry updated for site: ${site}`,
        before: {
          entryDate: beforeEntry.date,
          description: beforeEntry.description,
          cashIn: beforeEntry.cashIn,
          cashExpenseOut: beforeEntry.cashExpenseOut,
          cashDepositBank: beforeEntry.cashDepositBank,
        },
        after: {
          entryDate: sheet.entries[entryIndex].date,
          description: sheet.entries[entryIndex].description,
          cashIn: sheet.entries[entryIndex].cashIn,
          cashExpenseOut: sheet.entries[entryIndex].cashExpenseOut,
          cashDepositBank: sheet.entries[entryIndex].cashDepositBank,
        },
      });
    } catch (e) { }
    return res.json({ entries: entriesWithRunning });
  } catch (err) {
    try { await logAction(req, { action: 'update', resourceType: 'safesheet', success: false, statusCode: 500, message: err.message }); } catch (_) { }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;