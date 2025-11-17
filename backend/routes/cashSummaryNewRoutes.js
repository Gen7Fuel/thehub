const express = require('express')
const CashSummary = require('../models/CashSummaryNew')
const Safesheet = require('../models/Safesheet')
const { parseSftReport } = require('../utils/parseSftReport')
const { dateFromYMDLocal } = require('../utils/dateUtils')
const { sendEmail } = require('../utils/emailService')
const { generateCashSummaryPdf } = require('../utils/cashSummaryPdf')

const router = express.Router()

const OFFICE_SFTP_API_BASE = 'http://24.50.55.130:5000'
const APP_BASE_URL = process.env.PUBLIC_APP_BASE_URL || 'https://app.gen7fuel.com'
const CASH_SUMMARY_EMAILS = (process.env.CASH_SUMMARY_EMAILS || 'mohammad@gen7fuel.com')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default
    return await _fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

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

    // Enrich from Office SFTP API (HTTP proxy) instead of direct SFTP
    if (site) {
      try {
        const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift_number)}`, OFFICE_SFTP_API_BASE)
        url.searchParams.set('site', site)
        url.searchParams.set('type', 'sft')

        const resp = await fetchWithTimeout(url.toString())
        if (resp.ok) {
          const data = await resp.json()
          const content = String(data?.content || '').replace(/^\uFEFF/, '')
          const parsed = parseSftReport(content)

          if (parsed) {
            values = {
              canadian_cash_collected: values.canadian_cash_collected, // keep user counted
              item_sales: parsed.itemSales ?? values.item_sales,
              cash_back: parsed.cashBack ?? values.cash_back,
              loyalty: parsed.couponsAccepted ?? values.loyalty,
              cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
              report_canadian_cash: parsed.canadianCash ?? values.report_canadian_cash,
            }
          }
        } else {
          const msg = await resp.text().catch(() => `HTTP ${resp.status}`)
          console.warn(`Office SFTP API returned ${resp.status}: ${msg}`)
        }
      } catch (e) {
        console.warn(`Office SFTP enrichment failed for site ${site}:`, e?.message || e)
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

router.post('/submit/to/safesheet', async (req, res) => {
  try {
    const { site, date } = req.body || {}
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const [yy, mm, dd] = String(date).split('-').map(Number)
    const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
    const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

    // Aggregate total canadian_cash_collected for the site/day
    const agg = await CashSummary.aggregate([
      { $match: { site, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$canadian_cash_collected', 0] } } } },
    ])
    const totalCanadianCashCollected = Number(agg[0]?.total || 0)

    // Mark summaries as submitted (optional; keep if desired)
    await CashSummary.updateMany(
      { site, date: { $gte: start, $lt: end } },
      { $set: { submitted: true } }
    )

    // Find or create Safesheet for site
    let sheet = await Safesheet.findOne({ site })
    if (!sheet) {
      sheet = await Safesheet.create({ site, initialBalance: 0, entries: [] })
    }

    // Upsert a single entry for that calendar day
    const sameDay = (d) => d >= start && d < end
    const idx = sheet.entries.findIndex(e => sameDay(new Date(e.date)))

    const entryDate = dateFromYMDLocal(date)

    if (idx >= 0) {
      sheet.entries[idx].date = entryDate
      sheet.entries[idx].description = 'Daily Deposit'
      sheet.entries[idx].cashIn = totalCanadianCashCollected
      sheet.entries[idx].updatedAt = new Date()
    } else {
      sheet.entries.push({
        date: entryDate,
        description: 'Daily Deposit',
        cashIn: totalCanadianCashCollected,
      })
    }

    await sheet.save()

    // Respond to client first
    const entryId = (idx >= 0 ? sheet.entries[idx]._id : sheet.entries[sheet.entries.length - 1]._id)
    res.json({ site, date, cashIn: totalCanadianCashCollected, entryId })

    // Background: generate PDF and email it (React-PDF version, no Chrome deps)
    ;(async () => {
      try {
        // If you switched to the React-PDF util, ensure:
        // const { generateCashSummaryPdf } = require('../utils/cashSummaryPdfReact')
        const pdfBuffer = await generateCashSummaryPdf({ site, date })

        await sendEmail({
          to: CASH_SUMMARY_EMAILS.join(','),
          subject: `Cash Summary Report – ${site} – ${date}`,
          text: `Attached is the Cash Summary Report for ${site} on ${date}.`,
          attachments: [
            { filename: `Cash-Summary-${site}-${date}.pdf`, content: pdfBuffer },
          ],
        })
        console.log('Cash Summary email sent:', site, date)
      } catch (e) {
        console.error('Cash Summary email/PDF failed:', e?.message || e)
      }
    })()
  } catch (err) {
    console.error('CashSummary submit error:', err)
    return res.status(500).json({ error: 'Failed to submit' })
  }
})

// router.post('/submit/to/safesheet', async (req, res) => {
//   try {
//     const { site, date } = req.body || {}
//     if (!site) return res.status(400).json({ error: 'site is required' })
//     if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
//       return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
//     }

//     const [yy, mm, dd] = String(date).split('-').map(Number)
//     const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
//     const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

//     // Aggregate total canadian_cash_collected for the site/day
//     const agg = await CashSummary.aggregate([
//       { $match: { site, date: { $gte: start, $lt: end } } },
//       { $group: { _id: null, total: { $sum: { $ifNull: ['$canadian_cash_collected', 0] } } } },
//     ])
//     const totalCanadianCashCollected = Number(agg[0]?.total || 0)

//     // Mark summaries as submitted (optional; remove if not needed)
//     await CashSummary.updateMany(
//       { site, date: { $gte: start, $lt: end } },
//       { $set: { submitted: true } }
//     )

//     // Find or create Safesheet for site
//     let sheet = await Safesheet.findOne({ site })
//     if (!sheet) {
//       sheet = await Safesheet.create({ site, initialBalance: 0, entries: [] })
//     }

//     // Upsert a single entry for that calendar day
//     const sameDay = (d) => d >= start && d < end
//     const idx = sheet.entries.findIndex(e => sameDay(new Date(e.date)))

//     const entryDate = dateFromYMDLocal(date)

//     if (idx >= 0) {
//       sheet.entries[idx].date = entryDate
//       sheet.entries[idx].description = 'Daily Deposit'
//       sheet.entries[idx].cashIn = totalCanadianCashCollected
//       sheet.entries[idx].updatedAt = new Date()
//     } else {
//       sheet.entries.push({
//         date: entryDate,
//         description: 'Daily Deposit',
//         cashIn: totalCanadianCashCollected,
//       })
//     }

//     await sheet.save()

//     return res.json({
//       site,
//       date,
//       cashIn: totalCanadianCashCollected,
//       entryId: (idx >= 0 ? sheet.entries[idx]._id : sheet.entries[sheet.entries.length - 1]._id),
//     })
//   } catch (err) {
//     console.error('CashSummary submit error:', err)
//     return res.status(500).json({ error: 'Failed to submit' })
//   }
// })

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

// router.put('/:id', async (req, res) => {
//   try {
//     const {
//       site,
//       shift_number,
//       date,
//       canadian_cash_collected,
//       item_sales,
//       cash_back,
//       loyalty,
//       cpl_bulloch,
//       exempted_tax,
//       report_canadian_cash,
//     } = req.body || {}

//     if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
//     if (!date) return res.status(400).json({ error: 'date is required' })

//     const updated = await CashSummary.findByIdAndUpdate(
//       req.params.id,
//       {
//         site,
//         shift_number: String(shift_number),
//         date: new Date(date),
//         canadian_cash_collected: norm(canadian_cash_collected),
//         item_sales: norm(item_sales),
//         cash_back: norm(cash_back),
//         loyalty: norm(loyalty),
//         cpl_bulloch: norm(cpl_bulloch),
//         exempted_tax: norm(exempted_tax),
//         report_canadian_cash: norm(report_canadian_cash),
//       },
//       { new: true, runValidators: true }
//     ).lean()

//     if (!updated) return res.status(404).json({ error: 'Not found' })
//     res.json(updated)
//   } catch (err) {
//     console.error('CashSummary update error:', err)
//     res.status(500).json({ error: 'Failed to update CashSummary' })
//   }
// })
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

    // 1️⃣ Load existing document
    const existing = await CashSummary.findById(req.params.id).lean()
    if (!existing) return res.status(404).json({ error: 'Not found' })

    // 2️⃣ Determine if all five fields are missing (key does not exist)
    const allMissing = !('report_canadian_cash' in existing) &&
                       !('item_sales' in existing) &&
                       !('cash_back' in existing) &&
                       !('loyalty' in existing) &&
                       !('cpl_bulloch' in existing)

    let enrichedValues = {}

    // 3️⃣ Call Office API only if all fields are missing
    if (site && allMissing) {
      try {
        const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift_number)}`, OFFICE_SFTP_API_BASE)
        url.searchParams.set('site', site)
        url.searchParams.set('type', 'sft')

        const resp = await fetchWithTimeout(url.toString())
        if (resp.ok) {
          const data = await resp.json()
          const content = String(data?.content || '').replace(/^\uFEFF/, '')
          const parsed = parseSftReport(content)

          if (parsed) {
            enrichedValues = {
              item_sales: parsed.itemSales,
              cash_back: parsed.cashBack,
              loyalty: parsed.couponsAccepted,
              cpl_bulloch: parsed.fuelPriceOverrides,
              report_canadian_cash: parsed.canadianCash,
            }
          }
        } else {
          const msg = await resp.text().catch(() => `HTTP ${resp.status}`)
          console.warn(`Office SFTP API returned ${resp.status}: ${msg}`)
        }
      } catch (e) {
        console.warn(`Office SFTP enrichment failed for site ${site}:`, e?.message || e)
      }
    }

    // 4️⃣ Merge final values
    const finalValues = {
      site,
      shift_number: String(shift_number),
      date: new Date(date),

      canadian_cash_collected: norm(canadian_cash_collected),

      item_sales: norm(item_sales ?? enrichedValues.item_sales ?? existing.item_sales),
      cash_back: norm(cash_back ?? enrichedValues.cash_back ?? existing.cash_back),
      loyalty: norm(loyalty ?? enrichedValues.loyalty ?? existing.loyalty),
      cpl_bulloch: norm(cpl_bulloch ?? enrichedValues.cpl_bulloch ?? existing.cpl_bulloch),
      report_canadian_cash: norm(report_canadian_cash ?? enrichedValues.report_canadian_cash ?? existing.report_canadian_cash),

      exempted_tax: norm(exempted_tax),
    }

    // 5️⃣ Update and return
    const updated = await CashSummary.findByIdAndUpdate(
      req.params.id,
      finalValues,
      { new: true, runValidators: true }
    ).lean()

    res.json(updated)
  } catch (err) {
    console.error('CashSummary update error:', err)
    res.status(500).json({ error: 'Failed to update CashSummary' })
  }
})

module.exports = router