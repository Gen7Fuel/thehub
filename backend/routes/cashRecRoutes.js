const express = require('express')
const multer = require('multer')
const { BankStatement, KardpollReport } = require('../models/CashRec')
const CashSummary = require('../models/CashSummaryNew')
const Transactions = require('../models/Transactions')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

// Number parser (handles commas, currency, parentheses)
function toNum(s) {
  if (s == null) return 0
  const t = String(s)
    .replace(/^\uFEFF/, '')
    .replace(/[\s$,]/g, '')
    .replace(/^\((.*)\)$/, '-$1')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Fully exposed card => AR; masked (contains *) => not AR
function isARCard(value) {
  const str = String(value || '')
  if (!str) return false
  if (str.includes('*')) return false
  const digitsOnly = str.replace(/\D/g, '')
  return digitsOnly.length >= 12
}

// Extract a single YYYY-MM-DD date from header From/To lines
function extractDateFromHeader(lines) {
  let fromStr, toStr
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i]
    const both = line.match(/\bFrom\b\s*:\s*(.*?)\s+\bTo\b\s*:\s*(.*)/i)
    if (both) {
      fromStr = both[1].trim()
      toStr = both[2].trim()
      break
    }
    const mFrom = line.match(/\bFrom\b\s*:\s*([^\t]+?)(?:\s{2,}|$)/i)
    const mTo = line.match(/\bTo\b\s*:\s*([^\t]+?)(?:\s{2,}|$)/i)
    if (mFrom && !fromStr) fromStr = mFrom[1].trim()
    if (mTo && !toStr) toStr = mTo[1].trim()
  }
  const toYmd = (s) => {
    if (!s) return undefined
    const ymdMatch = String(s).match(/(\d{4}-\d{2}-\d{2})/)
    if (ymdMatch) return ymdMatch[1]
    const mdyMatch = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (mdyMatch) {
      const [_, mm, dd, yy] = mdyMatch
      return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    return undefined
  }
  return toYmd(fromStr) || toYmd(toStr)
}

function extractSiteFromHeader(lines) {
  let raw
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i]
    const m = line.match(/^\s*Site\s*:\s*(.+)$/i) // avoid "Site Grp"
    if (m) {
      raw = m[1].replace(/,\s*$/, '').trim()
      break
    }
  }
  if (!raw) return undefined

  const up = raw.toUpperCase()

  if (up.includes('RANKINGEN7')) return 'Rankin'
  if (up.includes('JOCKOPOINT')) return 'Jocko Point'
  if (up.includes('COUCHICING')) return 'Couchiching'
  if (up.includes('PENTICTON')) return 'Silver Grizzly'

  return raw // fallback to the original string if no match
}

// Parse tab-delimited Kardpoll/Transaction Detail file
function parseTransactionDetailTab(text) {
  const clean = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const lines = clean.split('\n').map(l => l.trimEnd()).filter(Boolean)

  // Locate header with required columns
  let headerIdx = -1
  let headers = []
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim())
    const lower = cols.map(c => c.toLowerCase())
    const hasCard = lower.includes('card1/card2')
    const hasQty = lower.includes('quantity') || lower.includes('qty')
    const hasTotal = lower.includes('total') || lower.includes('amount')
    if (hasCard && hasQty && hasTotal) {
      headerIdx = i
      headers = cols
      break
    }
  }

  if (headerIdx === -1) {
    return {
      litresSold: 0,
      sales: 0,
      ar: 0,
      date: undefined,
      ar_rows: [],
      warning: 'Header row not found. Expected columns: Card1/Card2, Quantity, Total',
    }
  }

  // Column indices
  const idxExact = (name) => headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase())
  const qtyIdx = idxExact('Quantity') >= 0 ? idxExact('Quantity') : headers.findIndex(h => h.toLowerCase().includes('qty'))
  const totalIdx = idxExact('Total') >= 0 ? idxExact('Total') : headers.findIndex(h => h.toLowerCase().includes('amount'))
  const cardIdx = idxExact('Card1/Card2')
  const priceIdx = idxExact('Price') >= 0 ? idxExact('Price') : headers.findIndex(h => h.toLowerCase().includes('price'))
  // const customerIdx = idxExact('Customer Name') >= 0 ? idxExact('Customer Name') : headers.findIndex(h => h.toLowerCase().includes('customer'))
  const customerIdx = headers.findIndex(h => h.toLowerCase() === 'customer')

  let litresSold = 0
  let sales = 0
  let ar = 0
  const ar_rows = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim())
    if (cols.length <= Math.max(qtyIdx, totalIdx, cardIdx)) continue
    const first = (cols[0] || '').toLowerCase()
    if (first.startsWith('total')) continue

    const qty = qtyIdx >= 0 ? toNum(cols[qtyIdx]) : 0
    const tot = totalIdx >= 0 ? toNum(cols[totalIdx]) : 0
    const cardVal = cardIdx >= 0 ? cols[cardIdx] : ''
    const price = priceIdx >= 0 ? toNum(cols[priceIdx]) : 0
    // const customer = customerIdx >= 0 ? cols[customerIdx] : ''

    if (qty === 0 && tot === 0) continue

    litresSold += qty
    sales += tot

    if (isARCard(cardVal)) {
      ar += tot
      // Use the next column (untitled) as the customer name, but keep the field key "customer"
      const customerName =
        customerIdx >= 0 && customerIdx + 1 < cols.length
          ? (cols[customerIdx + 1] || '').trim()
          : (cols[customerIdx] || '').trim()
      ar_rows.push({
        customer: customerName,
        card: cardVal,
        amount: round2(tot),
        quantity: round2(qty),
        price_per_litre: round2(price),
      })
    }
  }

  const date = extractDateFromHeader(lines)
  const site = extractSiteFromHeader(lines)

  return {
    litresSold: round2(litresSold),
    sales: round2(sales),
    ar: round2(ar),
    date,
    site,
    ar_rows,
  }
}

// router.post('/parse-kardpoll', express.json(), async (req, res) => {
//   try {
//     const { filename = 'report.txt', base64 } = req.body || {}
//     if (!base64) return res.status(400).json({ error: 'base64 is required' })
//     const text = Buffer.from(base64, 'base64').toString('utf8')
//     const result = parseTransactionDetailTab(text)
//     res.json({ filename, ...result })
//   } catch (e) {
//     res.status(500).json({ error: 'Failed to parse file' })
//   }
// })

router.post('/parse-kardpoll', express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const { base64 } = req.body || {}
    if (!base64) return res.status(400).json({ error: 'base64 is required' })

    const text = Buffer.from(base64, 'base64').toString('utf8')
    const parsed = parseTransactionDetailTab(text)

    // Build model doc (normalizes date to YYYY-MM-DD string via static)
    const doc = KardpollReport.fromParsed(parsed)

    // Optional: prevent duplicates by site+date; adjust if you want multiple per day
    const existing = await KardpollReport.findOne({ site: doc.site, date: doc.date }).lean()
    if (existing) {
      // update existing
      const updated = await KardpollReport.findByIdAndUpdate(
        existing._id,
        {
          litresSold: parsed.litresSold,
          sales: parsed.sales,
          ar: parsed.ar,
          ar_rows: parsed.ar_rows,
        },
        { new: true }
      ).lean()
      return res.json({ saved: true, upserted: true, report: updated })
    }

    const saved = await doc.save()
    return res.json({ saved: true, report: saved })
  } catch (e) {
    console.error('cashRecRoutes.save-kardpoll error:', e)
    res.status(500).json({ error: 'Failed to save Kardpoll report' })
  }
})

// Save parsed Bank Statement (from browser JSON)
router.post('/bank-statement', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const {
      site,
      date, // YYYY-MM-DD
      balanceForward,
      nightDeposit,
      transferTo,
      endingBalance,
      miscDebits,
      // NEW: accept miscCredits in payload
      miscCredits,
      // NEW: accept GBL buckets in payload
      gblDebits,
      gblCredits,
      // NEW: accept merchantFees in payload
      merchantFees,
    } = req.body || {}

    if (!site || !date) {
      return res.status(400).json({ error: 'site and date (YYYY-MM-DD) are required' })
    }

    // Build doc
    const doc = BankStatement.fromParsed({
      site,
      date,
      balanceForward,
      nightDeposit,
      transferTo,
      endingBalance,
      miscDebits,
      // NEW: include miscCredits
      miscCredits,
      // NEW: include GBL buckets
      gblDebits,
      gblCredits,
      merchantFees,
    })

    // Upsert per site+date
    const saved = await BankStatement.findOneAndUpdate(
      { site: doc.site, date: doc.date },
      {
        $set: {
          balanceForward: doc.balanceForward ?? 0,
          nightDeposit: doc.nightDeposit ?? 0,
          transferTo: doc.transferTo ?? 0,
          endingBalance: doc.endingBalance ?? 0,
          miscDebits: doc.miscDebits ?? [],
          // NEW: persist miscCredits
          miscCredits: doc.miscCredits ?? [],
          // NEW: persist GBL buckets
          gblDebits: doc.gblDebits ?? [],
          gblCredits: doc.gblCredits ?? [],
          merchantFees: typeof doc.merchantFees === 'number' ? doc.merchantFees : 0,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    return res.json({ saved: true, upserted: true, statement: saved })
  } catch (e) {
    console.error('cashRecRoutes.save-bank-statement error:', e)
    res.status(500).json({ error: 'Failed to save bank statement' })
  }
})

router.get('/kardpoll-entries', async (req, res) => {
  try {
    const site = String(req.query.site || '').trim()
    const date = String(req.query.date || '').trim()
    if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'site and date (YYYY-MM-DD) are required' })
    }

    const doc = await KardpollReport.findOne({ site, date }).lean()
    if (!doc) return res.status(404).json({ error: 'No Kardpoll report found for site/date' })

    // Return full document; ar_rows included
    res.json({
      _id: doc._id,
      site: doc.site,
      date: doc.date,
      litresSold: doc.litresSold,
      sales: doc.sales,
      ar: doc.ar,
      ar_rows: doc.ar_rows || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })
  } catch (err) {
    console.error('cashRecRoutes.entries error:', err)
    res.status(500).json({ error: 'Failed to load entries' })
  }
})

// helper: YYYY-MM-DD <-> Date (UTC) utilities
const pad2 = (n) => String(n).padStart(2, '0')
const toYmdUtc = (d) => {
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return undefined
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`
}
const addDaysYmd = (ymd, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return toYmdUtc(dt)
}
const startOfUtcDay = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}
const endOfUtcDay = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
}

router.get('/entries', async (req, res) => {
  try {
    const site = String(req.query.site || '').trim()
    const date = String(req.query.date || '').trim() // YYYY-MM-DD

    if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'site and date (YYYY-MM-DD) are required' })
    }

    // 1) Kardpoll for same date (string date in DB)
    const kardpoll = await KardpollReport.findOne({ site, date }).lean()

    // 2) BankStatement for next day
    const nextDate = addDaysYmd(date, 1)
    const bank = nextDate
      ? await BankStatement.findOne({ site, date: nextDate }).lean()
      : null

    // 3) CashSummary aggregate (Date type, sum all numeric fields for the day)
    const start = startOfUtcDay(date)
    const end = endOfUtcDay(date)

    const numericFields = [
      'canadian_cash_collected',
      'item_sales',
      'cash_back',
      'loyalty',
      'cpl_bulloch',
      'exempted_tax',
      'report_canadian_cash',
      'payouts',
      'fuelSales',
      'dealGroupCplDiscounts',
      'fuelPriceOverrides',
      'parsedItemSales',
      'depositTotal',
      'pennyRounding',
      'totalSales',
      'afdCredit',
      'afdDebit',
      'afdGiftCard',
      'kioskCredit',
      'kioskDebit',
      'kioskGiftCard',
      'totalPos',
      'arIncurred',
      'grandTotal',
      'missedCpl',
      'couponsAccepted',
      'canadianCash',
      'cashOnHand',
      'parsedCashBack',
      'parsedPayouts',
      'safedropsCount',
      'safedropsAmount',
    ]

    const groupStage = numericFields.reduce(
      (acc, f) => {
        acc[f] = { $sum: { $ifNull: [`$${f}`, 0] } }
        return acc
      },
      { shiftCount: { $sum: 1 } }
    )

    const [agg] = await CashSummary.aggregate([
      { $match: { site, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, ...groupStage } },
      { $project: { _id: 0 } },
    ])

    const emptyTotals = numericFields.reduce((o, k) => ((o[k] = 0), o), {})
    const cashSummary = {
      site,
      date,
      shiftCount: agg?.shiftCount || 0,
      totals: agg ? agg : { ...emptyTotals, shiftCount: 0 },
    }

    // Fetch CashSummaryReport for unsettledPrepays and handheldDebit
    try {
      const { CashSummaryReport } = require('../models/CashSummaryNew')
      const report = await CashSummaryReport.findOne({ site, date: start }).lean()
      if (report) {
        cashSummary.unsettledPrepays = typeof report.unsettledPrepays === 'number' ? report.unsettledPrepays : undefined
        cashSummary.handheldDebit = typeof report.handheldDebit === 'number' ? report.handheldDebit : undefined
      }
    } catch (e) {
      // ignore errors, just don't include fields
    }

    // 4) Receivables total from Transactions (source: 'PO') for stationName/site and day range
    let totalReceivablesAmount = 0
    try {
      const [txAgg] = await Transactions.aggregate([
        {
          $match: {
            source: 'PO',
            stationName: site,
            date: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ])
      totalReceivablesAmount = txAgg?.total || 0
    } catch (e) {
      // Defensive: log but do not fail the endpoint
      console.error('Failed to aggregate receivables:', e)
    }

    // Compute Bank Stmt Trans:
    // balanceForward - sum(miscDebits.amount) - sum(gblDebits.amount) - merchantFees + sum(miscCredits.amount)
    const miscDebitsTotal = (bank?.miscDebits || []).reduce((sum, x) => {
      const amt = Number(x?.amount) || 0
      return sum + (amt > 0 ? amt : 0)
    }, 0)
    const gblDebitsTotal = (bank?.gblDebits || []).reduce((sum, x) => {
      const amt = Number(x?.amount) || 0
      return sum + (amt > 0 ? amt : 0)
    }, 0)
    const miscCreditsTotal = (bank?.miscCredits || []).reduce((sum, x) => {
      const amt = Number(x?.amount) || 0
      return sum + (amt > 0 ? amt : 0)
    }, 0)
    const bankStmtTrans =
      (Number(bank?.balanceForward) || 0)
      - miscDebitsTotal
      - gblDebitsTotal
      - (Number(bank?.merchantFees) || 0)
      + miscCreditsTotal

    // Compute Bank Rec:
    // Ending Balance - Bank Stmt Trans - Total POS - Kardpoll Sales + Kiosk GC + AFD GC + Kardpoll AR - Handheld Debit
    const endingBalance = Number(bank?.endingBalance) || 0
    const totalPos = Number(cashSummary?.totals?.totalPos) || 0
    const kioskGC = Number(cashSummary?.totals?.kioskGiftCard) || 0
    const afdGC = Number(cashSummary?.totals?.afdGiftCard) || 0
    const kardpollSales = Number(kardpoll?.sales) || 0
    const kardpollAr = Number(kardpoll?.ar) || 0
    const handheldDebit = Number(cashSummary?.handheldDebit) || 0

    const bankRec = endingBalance - bankStmtTrans - totalPos - kardpollSales + kioskGC + afdGC + kardpollAr - handheldDebit

    // Compute Balance Check (moved from frontend):
    // totalPos + report_canadian_cash + couponsAccepted + payouts - totalSales + totalReceivablesAmount
    const reportCanadianCash = Number(cashSummary?.totals?.report_canadian_cash) || 0
    const couponsAccepted = Number(cashSummary?.totals?.couponsAccepted) || 0
    const payouts = Number(cashSummary?.totals?.payouts) || 0
    const totalSalesNum = Number(cashSummary?.totals?.totalSales) || 0
    const balanceCheck = totalPos + reportCanadianCash + couponsAccepted + payouts - totalSalesNum + (Number(totalReceivablesAmount) || 0)

    return res.json({
      kardpoll: kardpoll || null,
      bank: bank || null,
      cashSummary,
      totalReceivablesAmount,
      bankStmtTrans,
      bankRec,
      balanceCheck,
    })
  } catch (err) {
    console.error('cashRecRoutes.entries error:', err)
    return res.status(500).json({ error: 'Failed to load entries' })
  }
})

module.exports = router