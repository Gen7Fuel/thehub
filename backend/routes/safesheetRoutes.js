const express = require('express');
const router = express.Router();
const Safesheet = require('../models/Safesheet');

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
router.get('/site/:site', async (req, res) => {
  try {
    const sheet = await Safesheet.findOne({ site: req.params.site });
    if (!sheet) return res.status(404).json({ error: 'Safesheet not found for site' });

    const entries = sheet.getEntriesWithRunningBalance();
    return res.json({
      _id: sheet._id,
      site: sheet.site,
      initialBalance: sheet.initialBalance,
      entries,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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

module.exports = router;