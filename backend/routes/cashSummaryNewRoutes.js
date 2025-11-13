const express = require('express')
const CashSummary = require('../models/CashSummaryNew')
const { withSftp } = require('../utils/sftp')
const { getSftpConfig } = require('../config/sftpConfig')
const { parseSftReport } = require('../utils/parseSftReport')

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const {
      site,
      shift_number,
      date,
      canadian_cash_collected,
      item_sales,
      cash_back,
      loyalty,
      cpl_bulloch,
      exempted_tax,
    } = req.body || {}

    if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
    if (!date) return res.status(400).json({ error: 'date is required' })

    let values = {
      canadian_cash_collected: norm(canadian_cash_collected),
      item_sales: norm(item_sales),
      cash_back: norm(cash_back),
      loyalty: norm(loyalty),
      cpl_bulloch: norm(cpl_bulloch),
      report_canadian_cash: undefined,
    }

    // Enrich from SFTP if the selected site has credentials configured
    if (site && getSftpConfig(site)) {
      try {
        const { parsed } = await withSftp(site, async (sftp) => {
          const remoteDir = '/receive'
          const list = await sftp.list(remoteDir)
          const target = list.find(
            (f) =>
              typeof f.name === 'string' &&
              f.name.toLowerCase().endsWith('.sft') &&
              new RegExp(`\\b${shift_number}\\.sft$`).test(f.name)
          )
          if (!target) return { parsed: null }

          const remotePath = `${remoteDir}/${target.name}`
          const buf = await sftp.get(remotePath)
          const content = buf.toString('utf8').replace(/^\uFEFF/, '')
          const metrics = parseSftReport(content)
          return { parsed: metrics }
        })

        if (parsed) {
          values = {
            canadian_cash_collected: values.canadian_cash_collected, // do NOT overwrite user counted
            item_sales: parsed.itemSales ?? values.item_sales,
            cash_back: parsed.cashBack ?? values.cash_back,
            loyalty: parsed.couponsAccepted ?? values.loyalty,
            cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
            report_canadian_cash: parsed.canadianCash ?? values.report_canadian_cash,
          }
        }
      } catch (e) {
        console.warn(`SFTP enrichment skipped for site ${site}:`, e?.message || e)
      }
    }

    const doc = new CashSummary({
      site,
      shift_number: String(shift_number),
      date: new Date(date),
      canadian_cash_collected: values.canadian_cash_collected,
      item_sales: values.item_sales,
      cash_back: values.cash_back,
      loyalty: values.loyalty,
      cpl_bulloch: values.cpl_bulloch,
      report_canadian_cash: values.report_canadian_cash,
      exempted_tax: norm(exempted_tax),
    })

    const saved = await doc.save()
    res.status(201).json(saved)
  } catch (err) {
    console.error('CashSummary create error:', err)
    res.status(500).json({ error: 'Failed to save CashSummary' })
  }
})

function norm(v) {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

router.get('/', async (req, res) => {
  try {
    const { site } = req.query
    if (!site) {
      return res.status(400).json({ error: 'site query parameter is required' })
    }

    const docs = await CashSummary
      .find({ site })
      .sort({ date: -1, createdAt: -1 })
      .lean()

    res.json(docs)
  } catch (err) {
    console.error('CashSummary list error:', err)
    res.status(500).json({ error: 'Failed to fetch CashSummary list' })
  }
})

router.get('/report', async (req, res) => {
  try {
    const { site, date } = req.query
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const [yy, mm, dd] = String(date).split('-').map(Number)
    const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0) // local midnight
    const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

    const rows = await CashSummary.find({
      site,
      date: { $gte: start, $lt: end },
    })
      .sort({ shift_number: 1 })
      .lean()

    const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0)

    const totals = {
      count: rows.length,
      canadian_cash_collected: sum('canadian_cash_collected'),
      item_sales: sum('item_sales'),
      cash_back: sum('cash_back'),
      loyalty: sum('loyalty'),
      cpl_bulloch: sum('cpl_bulloch'),
      exempted_tax: sum('exempted_tax'),
      report_canadian_cash: sum('report_canadian_cash'),
    }

    res.json({ site, date, rows, totals })
  } catch (err) {
    console.error('CashSummary report error:', err)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

router.post('/submit', async (req, res) => {
  try {
    const { site, date } = req.body || {}
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const [yy, mm, dd] = String(date).split('-').map(Number)
    const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0) // local midnight
    const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

    const result = await CashSummary.updateMany(
      { site, date: { $gte: start, $lt: end } },
      { $set: { submitted: true } }
    )

    res.json({
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
    })
  } catch (err) {
    console.error('CashSummary submit error:', err)
    res.status(500).json({ error: 'Failed to submit' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const doc = await CashSummary.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) {
    console.error('CashSummary get error:', err)
    res.status(500).json({ error: 'Failed to fetch CashSummary' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const {
      site,
      shift_number,
      date,
      canadian_cash_collected,
      item_sales,
      cash_back,
      loyalty,
      cpl_bulloch,
      exempted_tax,
      report_canadian_cash,
    } = req.body || {}

    if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
    if (!date) return res.status(400).json({ error: 'date is required' })

    const updated = await CashSummary.findByIdAndUpdate(
      req.params.id,
      {
        site,
        shift_number: String(shift_number),
        date: new Date(date),
        canadian_cash_collected: norm(canadian_cash_collected),
        item_sales: norm(item_sales),
        cash_back: norm(cash_back),
        loyalty: norm(loyalty),
        cpl_bulloch: norm(cpl_bulloch),
        exempted_tax: norm(exempted_tax),
        report_canadian_cash: norm(report_canadian_cash),
      },
      { new: true, runValidators: true }
    ).lean()

    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    console.error('CashSummary update error:', err)
    res.status(500).json({ error: 'Failed to update CashSummary' })
  }
})

module.exports = router