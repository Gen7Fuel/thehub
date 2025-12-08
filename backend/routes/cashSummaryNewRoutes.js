const express = require('express')
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')
const Safesheet = require('../models/Safesheet')
const { parseSftReport } = require('../utils/parseSftReport')
const { dateFromYMDLocal } = require('../utils/dateUtils')
const { sendEmail } = require('../utils/emailService')
const { generateCashSummaryPdf } = require('../utils/cashSummaryPdf')
const { generateShiftReportsPdf } = require('../utils/shiftReportsPdf')

const path = require('path')

const router = express.Router()

const CDN_BASE_URL = process.env.CDN_BASE_URL || process.env.PUBLIC_CDN_BASE_URL || 'http://cdn:5001'
const OFFICE_SFTP_API_BASE = 'http://24.50.55.130:5000'
const CASH_SUMMARY_EMAILS = (process.env.CASH_SUMMARY_EMAILS || 'reports@bosservicesltd.com')
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

async function getDepositSlipAttachment(req, site, start, end) {
  try {
    const sheet = await Safesheet.findOne({ site }).lean()
    if (!sheet || !Array.isArray(sheet.entries)) return null

    const sameDay = (d) => {
      const x = new Date(d)
      return x >= start && x < end
    }

    // Find the most recent entry on that date with a non-zero bank deposit and a photo
    const candidate = [...sheet.entries]
      .filter((e) => sameDay(e.date) && e.photo && Number(e.cashDepositBank || 0) > 0)
      .sort((a, b) => +new Date(b.updatedAt || b.date) - +new Date(a.updatedAt || a.date))[0]

    if (!candidate) return null

    const photoName = path.basename(String(candidate.photo))
    const origin = (CDN_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')
    console.log('Origin',origin)
    const url = `${origin}/cdn/download/${encodeURIComponent(photoName)}`

    const resp = await fetchWithTimeout(url, {}, 15000)
    if (!resp.ok) return null

    let buffer
    if (typeof resp.arrayBuffer === 'function') buffer = Buffer.from(await resp.arrayBuffer())
    else if (typeof resp.buffer === 'function') buffer = await resp.buffer()
    else buffer = Buffer.from(await resp.text(), 'binary')

    const contentType = resp.headers.get('content-type') || 'application/octet-stream'
    let ext = path.extname(photoName)
    if (!ext) {
      if (contentType.includes('png')) ext = '.png'
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg'
      else if (contentType.includes('pdf')) ext = '.pdf'
    }

    return {
      filename: `Bank-Deposit-Slip-${site}-${start.toISOString().slice(0, 10)}${ext || ''}`,
      content: buffer,
      contentType,
    }
  } catch (e) {
    console.warn('Deposit slip fetch failed:', e?.message || e)
    return null
  }
}

async function upsertDailyDepositForSiteDate(site, dateInput) {
  try {
    if (!site || !dateInput) return null
    const d = new Date(dateInput)
    if (Number.isNaN(d.getTime())) return null

    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const start = new Date(y, m, day, 0, 0, 0, 0)
    const end = new Date(y, m, day + 1, 0, 0, 0, 0)

    // Aggregate total canadian_cash_collected for the site/day
    const agg = await CashSummary.aggregate([
      { $match: { site, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$canadian_cash_collected', 0] } } } },
    ])
    const total = Number(agg[0]?.total || 0)

    // Find or create Safesheet
    let sheet = await Safesheet.findOne({ site })
    if (!sheet) sheet = await Safesheet.create({ site, initialBalance: 0, entries: [] })

    const sameDay = (dt) => dt >= start && dt < end

    // Prefer the most recent "Daily Deposit" on that date
    let idx = -1
    for (let j = sheet.entries.length - 1; j >= 0; j--) {
      const e = sheet.entries[j]
      if (sameDay(new Date(e.date)) && e.description === 'Daily Deposit') { idx = j; break }
    }

    const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const entryDate = dateFromYMDLocal(ymd)

    if (idx >= 0) {
      sheet.entries[idx].date = entryDate
      sheet.entries[idx].description = 'Daily Deposit'
      sheet.entries[idx].cashIn = total
      sheet.entries[idx].updatedAt = new Date()
    } else {
      sheet.entries.push({ date: entryDate, description: 'Daily Deposit', cashIn: total })
    }

    await sheet.save()
    return idx >= 0 ? sheet.entries[idx]._id : sheet.entries[sheet.entries.length - 1]._id
  } catch (e) {
    console.warn('Safesheet upsert failed:', e?.message || e)
    return null
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
      payouts,
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
      payouts: norm(payouts),
    }

    let content = ''
    let parsed = {}

    // Enrich from Office SFTP API (HTTP proxy) instead of direct SFTP
    if (site && shift_number) {
      try {
        const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift_number)}`, OFFICE_SFTP_API_BASE)
        url.searchParams.set('site', site)
        url.searchParams.set('type', 'sft')
        // console.log(`Fetching SFTP report for site=${site}, shift_number=${shift_number}`)

        const resp = await fetchWithTimeout(url.toString())
        if (resp.ok) {
          const data = await resp.json()
          content = String(data?.content || '').replace(/^\uFEFF/, '')
          parsed = parseSftReport(content)
          // console.log('Parsed SFT report:', parsed)

          values = {
            canadian_cash_collected: values.canadian_cash_collected, // keep user counted
            item_sales: parsed.itemSales ?? values.item_sales,
            cash_back: parsed.cashBack ?? values.cash_back,
            loyalty: parsed.couponsAccepted ?? values.loyalty,
            cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
            report_canadian_cash: parsed.canadianCash ?? values.report_canadian_cash,
            payouts: parsed.payouts ?? values.payouts,
          }
        } else {
          const msg = await resp.text().catch(() => `HTTP ${resp.status}`)
          console.warn(`Office SFTP API returned ${resp.status}: ${msg}`)
        }
      } catch (e) {
        console.warn(`Office SFTP enrichment failed for site ${site}:`, e?.message || e)
      }
    } else {
      console.log("WARNING: Skipping Office SFTP enrichment due to missing site or shift_number")
      console.log("Site:", site, "Shift Number:", shift_number)
    }

    // Helper: to number or undefined (leave missing values undefined in DB)
    const numOrUndef = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }

    // ...inside POST create handler, after parseSftReport(content):
    // parsed = parseSftReport(content) || {}

    // Build the document USING enriched values
    const doc = new CashSummary({
      site,
      shift_number: String(shift_number),
      date: new Date(date),

      // existing primary fields (now enriched)
      canadian_cash_collected: values.canadian_cash_collected,
      item_sales: values.item_sales,
      cash_back: values.cash_back,
      loyalty: values.loyalty,
      cpl_bulloch: values.cpl_bulloch,
      report_canadian_cash: values.report_canadian_cash,
      exempted_tax: norm(exempted_tax),
      payouts: numOrUndef(values.payouts),

      // parsed SFT extras
      fuelSales: numOrUndef(parsed.fuelSales),
      dealGroupCplDiscounts: numOrUndef(parsed.dealGroupCplDiscounts),
      fuelPriceOverrides: numOrUndef(parsed.fuelPriceOverrides),
      parsedItemSales: numOrUndef(parsed.itemSales),
      depositTotal: numOrUndef(parsed.depositTotal),
      pennyRounding: numOrUndef(parsed.pennyRounding),
      totalSales: numOrUndef(parsed.totalSales),
      afdCredit: numOrUndef(parsed.afdCredit),
      afdDebit: numOrUndef(parsed.afdDebit),
      kioskCredit: numOrUndef(parsed.kioskCredit),
      kioskDebit: numOrUndef(parsed.kioskDebit),
      kioskGiftCard: numOrUndef(parsed.kioskGiftCard),
      totalPos: numOrUndef(parsed.totalPos),
      arIncurred: numOrUndef(parsed.arIncurred),
      grandTotal: numOrUndef(parsed.grandTotal),
      couponsAccepted: numOrUndef(parsed.couponsAccepted),
      canadianCash: numOrUndef(parsed.canadianCash),
      cashOnHand: numOrUndef(parsed.cashOnHand),
      parsedCashBack: numOrUndef(parsed.cashBack),
      parsedPayouts: numOrUndef(parsed.payouts),
      safedropsCount: numOrUndef(parsed.safedrops?.count),
      safedropsAmount: numOrUndef(parsed.safedrops?.amount),
    })

    // const doc = new CashSummary({
    //   site,
    //   shift_number: String(shift_number),
    //   date: new Date(date),
    //   canadian_cash_collected: values.canadian_cash_collected,
    //   item_sales: values.item_sales,
    //   cash_back: values.cash_back,
    //   loyalty: values.loyalty,
    //   cpl_bulloch: values.cpl_bulloch,
    //   report_canadian_cash: values.report_canadian_cash,
    //   exempted_tax: norm(exempted_tax),
    //   payouts: values.payouts,
    // })

    const saved = await doc.save()

    await upsertDailyDepositForSiteDate(site, date).catch(() => {})

    res.status(201).json(saved)
  } catch (err) {
    console.error('CashSummary create error:', err)
    res.status(500).json({ error: err.message || 'Failed to save CashSummary' })
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
      .limit(30)
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

    // Mark summaries as submitted (optional)
    await CashSummary.updateMany(
      { site, date: { $gte: start, $lt: end } },
      { $set: { submitted: true } }
    )

    // Find or create Safesheet for site
    let sheet = await Safesheet.findOne({ site })
    if (!sheet) {
      sheet = await Safesheet.create({ site, initialBalance: 0, entries: [] })
    }

    // Upsert a single entry for that calendar day, specifically "Daily Deposit"
    const sameDay = (d) => d >= start && d < end

    // Prefer the most recent "Daily Deposit" on that date
    const idx = (() => {
      for (let j = sheet.entries.length - 1; j >= 0; j--) {
        const e = sheet.entries[j]
        if (sameDay(new Date(e.date)) && e.description === 'Daily Deposit') return j
      }
      return -1
    })()

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

    await CashSummaryReport.findOneAndUpdate(
      { site, date: start }, // normalized day start
      { $set: { site, date: start, submitted: true, submittedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // Respond to client first
    const entryId = idx >= 0 ? sheet.entries[idx]._id : sheet.entries[sheet.entries.length - 1]._id
    res.json({ site, date, cashIn: totalCanadianCashCollected, entryId })

    // Background: generate PDFs and email them with optional deposit slip image
    ;(async () => {
      try {
        // Load notes for this site+day and pass into PDF
        const reportForPdf = await CashSummaryReport.findOne({ site, date: start }).lean()
        const notes = reportForPdf?.notes || ''

        // Cash Summary PDF
        const cashSummaryPdf = await generateCashSummaryPdf({ site, date })

        // Shift Reports PDF (all shifts for the date)
        const shiftReportsPdf = await generateShiftReportsPdf({ site, date })

        // Bank Deposit Slip image (for entries on that date with photo and cashDepositBank > 0)
        const depositSlip = await getDepositSlipAttachment(req, site, start, end)

        const attachments = [
          { filename: `Cash-Summary-${site}-${date}.pdf`, content: cashSummaryPdf, contentType: 'application/pdf' },
        ]

        if (shiftReportsPdf) {
          attachments.push({
            filename: `Shift-Reports-${site}-${date}.pdf`,
            content: shiftReportsPdf,
            contentType: 'application/pdf',
          })
        }

        if (depositSlip) attachments.push(depositSlip)

        await sendEmail({
          to: CASH_SUMMARY_EMAILS.join(','),
          cc: ['mohammad@gen7fuel.com', 'JDzyngel@gen7fuel.com', 'ana@gen7fuel.com'],
          subject: `Daily Report – ${site} – ${date}`,
          text: `Attached are the Cash Summary${shiftReportsPdf ? ', Shift Reports' : ''}${depositSlip ? ' and Bank Deposit Slip' : ''} for ${site} on ${date}.`,
          attachments,
        })

        console.log(
          'Cash Summary email sent:',
          site,
          date,
          `[attachments: summary${shiftReportsPdf ? ', shifts' : ''}${depositSlip ? ', deposit-slip' : ''}]`
        )
      } catch (e) {
        console.error('Cash Summary email/PDF failed:', e?.message || e)
      }
    })()
  } catch (err) {
    console.error('CashSummary submit error:', err)
    return res.status(500).json({ error: 'Failed to submit' })
  }
})

function startEndOfYmd(ymd) {
  const [yy, mm, dd] = String(ymd).split('-').map(Number)
  const start = new Date(yy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0)
  const end = new Date(yy, (mm || 1) - 1, (dd || 1) + 1, 0, 0, 0, 0)
  return { start, end }
}

router.get('/report', async (req, res) => {
  try {
    const { site, date } = req.query
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const { start, end } = startEndOfYmd(date)

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
      payouts: rows.reduce((a,r)=> a + (r.payouts || 0), 0),
    }

    // Fetch or create the single report for site+day (normalized date)
    const reportDate = start // store normalized day start
    const reportDoc = await CashSummaryReport.findOne({ site, date: reportDate }).lean()

    res.json({
      site,
      date,
      rows,
      totals,
      report: reportDoc || null, // contains notes + submitted
    })
  } catch (err) {
    console.error('CashSummary report error:', err)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

router.put('/report', async (req, res) => {
  try {
    const { site, date, notes = '', submitted } = req.body || {}
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const { start } = startEndOfYmd(date)
    const update = {
      site,
      date: start,
      notes,
    }
    if (typeof submitted === 'boolean') {
      update.submitted = submitted
      update.submittedAt = submitted ? new Date() : undefined
    }

    const doc = await CashSummaryReport.findOneAndUpdate(
      { site, date: start },
      { $set: { site, date: start, notes } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()

    res.json(doc)
  } catch (err) {
    console.error('CashSummary report upsert error:', err)
    res.status(500).json({ error: 'Failed to save report notes' })
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

    // 1️⃣ Load existing document
    const existing = await CashSummary.findById(req.params.id).lean()
    if (!existing) return res.status(404).json({ error: 'Not found' })

    // 2️⃣ Determine if all five fields are missing (key does not exist)
    // const allMissing = !('report_canadian_cash' in existing) &&
    //                    !('item_sales' in existing) &&
    //                    !('cash_back' in existing) &&
    //                    !('loyalty' in existing) &&
    //                    !('cpl_bulloch' in existing)

    let enrichedValues = {}

    // 3️⃣ Call Office API only if all fields are missing
    if (site && shift_number) {
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

    // Auto-update Safesheet for the new site/date
    const newSite = finalValues.site || existing.site
    const newDate = finalValues.date
    await upsertDailyDepositForSiteDate(newSite, newDate).catch(() => {})

    // If site or date changed, also refresh the old site/date
    const siteChanged = String(existing.site) !== String(newSite)
    const dateChanged = new Date(existing.date).toDateString() !== new Date(newDate).toDateString()
    if (siteChanged || dateChanged) {
      await upsertDailyDepositForSiteDate(existing.site, existing.date).catch(() => {})
    }

    res.json(updated)
  } catch (err) {
    console.error('CashSummary update error:', err)
    res.status(500).json({ error: 'Failed to update CashSummary' })
  }
})

module.exports = router