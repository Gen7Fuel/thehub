const express = require('express');
const router = express.Router();
const Safesheet = require('../models/Safesheet');


/**
 * check for a existing safesheet for a site
 * GET /api/safesheets/:site (here :site is site name)
 */
router.get('/:site', async (req, res) => {
  try {
    const { site } = req.params;
    const sheet = await Safesheet.findOne({ site });
    return res.status(200).json({ exists: !!sheet });
  } catch (err) {
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
    return res.status(201).json(sheet);
  } catch (err) {
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
    return res.status(201).json({ entries: entriesWithRunning });
  } catch (err) {
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

    // Use model method to compute running balance, then filter by range
    const allEntries = sheet.getEntriesWithRunningBalance()
    const inRange = allEntries.filter(e => {
      const d = new Date(e.date)
      return d >= start && d <= end
    })

    return res.json({
      _id: sheet._id,
      site: sheet.site,
      initialBalance: sheet.initialBalance,
      from: fromYmd,
      to: toYmd,
      entries: inRange,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt,
    })
  } catch (err) {
    console.error('Safesheet site range error:', err)
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

    return res.json({ site: sheet.site, cashOnHandSafe: Number(current.toFixed(2)) });
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
    sheet.entries[entryIndex] = { ...sheet.entries[entryIndex].toObject(), ...updates, updatedAt: new Date() };

    await sheet.save();

    const entriesWithRunning = sheet.getEntriesWithRunningBalance();
    return res.json({ entries: entriesWithRunning });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;