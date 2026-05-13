const express = require('express')
const { DateTime } = require('luxon')
const { BankStatement, KardpollReport } = require('../models/CashRec')
const CashRecTag = require('../models/CashRecTag')
const CashSummary = require('../models/CashSummaryNew')
const Transactions = require('../models/Transactions')
const LotteryModule = require('../models/Lottery')
const Lottery = LotteryModule?.Lottery || LotteryModule?.default || LotteryModule
const Location = require('../models/Location')

const TIMEZONE = 'America/Toronto'

const router = express.Router()

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

// Parse Kardpoll/Transaction Detail file \u2014 supports both tab-delimited and fixed-width space-delimited formats
function parseTransactionDetailTab(text) {
  const clean = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const lines = clean.split('\n').map(l => l.trimEnd()).filter(Boolean)

  // Detect format: if any of the first 40 lines contain a tab, treat as tab-delimited
  const isTabDelimited = lines.slice(0, 40).some(l => l.includes('\t'))

  // Locate header with required columns
  let headerIdx = -1
  let headers = []       // tab format: array of column name strings
  let colPos = null      // fixed-width format: array of { name, start }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isTabDelimited) {
      const cols = line.split('\t').map(s => s.trim())
      const lower = cols.map(c => c.toLowerCase())
      if (lower.includes('card1/card2') && (lower.includes('quantity') || lower.includes('qty')) && (lower.includes('total') || lower.includes('amount'))) {
        headerIdx = i
        headers = cols
        break
      }
    } else {
      const lower = line.toLowerCase()
      if (lower.includes('card1/card2') && (lower.includes('quantity') || lower.includes('qty')) && (lower.includes('total') || lower.includes('amount'))) {
        headerIdx = i
        // Record start position of each whitespace-separated token
        const positions = []
        const re = /(\S+)/g
        let m
        while ((m = re.exec(line)) !== null) positions.push({ name: m[1].toLowerCase(), start: m.index })
        colPos = positions
        break
      }
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

  // Column index helpers
  let qtyIdx, totalIdx, cardIdx, priceIdx, customerIdx
  if (isTabDelimited) {
    const idxExact = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
    qtyIdx = idxExact('Quantity') >= 0 ? idxExact('Quantity') : headers.findIndex(h => h.toLowerCase().includes('qty'))
    totalIdx = idxExact('Total') >= 0 ? idxExact('Total') : headers.findIndex(h => h.toLowerCase().includes('amount'))
    cardIdx = idxExact('Card1/Card2')
    priceIdx = idxExact('Price') >= 0 ? idxExact('Price') : headers.findIndex(h => h.toLowerCase().includes('price'))
    customerIdx = headers.findIndex(h => h.toLowerCase() === 'customer')
  } else {
    const idxFw = (name) => colPos.findIndex(p => p.name === name.toLowerCase())
    const idxFwSub = (sub) => colPos.findIndex(p => p.name.includes(sub.toLowerCase()))
    qtyIdx = idxFw('quantity') >= 0 ? idxFw('quantity') : idxFwSub('qty')
    totalIdx = idxFw('total') >= 0 ? idxFw('total') : idxFwSub('amount')
    cardIdx = idxFw('card1/card2')
    priceIdx = idxFw('price') >= 0 ? idxFw('price') : idxFwSub('price')
    customerIdx = idxFw('customer')
  }

  // Extract a fixed-width column value using the colPos table
  const extractFw = (line, posIdx) => {
    if (posIdx < 0 || posIdx >= colPos.length) return ''
    const start = colPos[posIdx].start
    const end = posIdx + 1 < colPos.length ? colPos[posIdx + 1].start : undefined
    return (end !== undefined ? line.slice(start, end) : line.slice(start)).trim()
  }

  let litresSold = 0
  let sales = 0
  let ar = 0
  const ar_rows = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]

    let qty, tot, cardVal, price, customerName

    if (isTabDelimited) {
      const cols = line.split('\t').map(s => s.trim())
      if (cols.length <= Math.max(qtyIdx, totalIdx, cardIdx)) continue
      if ((cols[0] || '').toLowerCase().startsWith('total')) continue
      qty = toNum(cols[qtyIdx])
      tot = toNum(cols[totalIdx])
      cardVal = cardIdx >= 0 ? cols[cardIdx] : ''
      price = priceIdx >= 0 ? toNum(cols[priceIdx]) : 0
      customerName =
        customerIdx >= 0 && customerIdx + 1 < cols.length
          ? (cols[customerIdx + 1] || '').trim()
          : (cols[customerIdx] || '').trim()
    } else {
      // Skip separator lines (underscores/dashes) and repeated header rows
      if (/^[_\-\s]+$/.test(line)) continue
      if (line.toLowerCase().includes('card1/card2')) continue
      if (line.trim().toLowerCase().startsWith('total')) continue
      qty = toNum(extractFw(line, qtyIdx))
      tot = toNum(extractFw(line, totalIdx))
      cardVal = extractFw(line, cardIdx)
      price = priceIdx >= 0 ? toNum(extractFw(line, priceIdx)) : 0
      customerName = customerIdx >= 0 ? extractFw(line, customerIdx) : ''
    }

    if (qty === 0 && tot === 0) continue

    litresSold += qty
    sales += tot

    if (isARCard(cardVal)) {
      ar += tot
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
      gblCreditsFiltered,
      ontarioIntegratedTax,
      transferFrom,
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
      gblCreditsFiltered,
      ontarioIntegratedTax,
      transferFrom,
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
          ...(typeof doc.gblCreditsFiltered === 'number' && { gblCreditsFiltered: doc.gblCreditsFiltered }),
          ...(typeof doc.ontarioIntegratedTax === 'number' && { ontarioIntegratedTax: doc.ontarioIntegratedTax }),
          ...(typeof doc.transferFrom === 'number' && { transferFrom: doc.transferFrom }),
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

router.patch('/bank-statement/merchant-fees', express.json(), async (req, res) => {
  try {
    const { site, date, merchantFees } = req.body || {}
    if (!site || !date) return res.status(400).json({ error: 'site and date are required' })
    if (typeof merchantFees !== 'number') return res.status(400).json({ error: 'merchantFees must be a number' })
    // Bank statements are stored under nextDate (date + 1), matching the entries endpoint convention
    const nextDate = addDaysYmd(date, 1)
    if (!nextDate) return res.status(400).json({ error: 'Invalid date' })
    const saved = await BankStatement.findOneAndUpdate(
      { site, date: nextDate },
      { $set: { merchantFees } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()
    return res.json({ saved: true, statement: saved })
  } catch (e) {
    console.error('cashRecRoutes.update-merchant-fees error:', e)
    res.status(500).json({ error: 'Failed to update merchant fees' })
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
const startOfUtcDay = (ymd) =>
  DateTime.fromISO(`${ymd}T00:00:00`, { zone: TIMEZONE }).toJSDate()
const endOfUtcDay = (ymd) =>
  DateTime.fromISO(`${ymd}T00:00:00`, { zone: TIMEZONE }).plus({ days: 1 }).minus({ milliseconds: 1 }).toJSDate()

async function computeBankRecForDate(site, date) {
  const kardpoll = await KardpollReport.findOne({ site, date }).lean()
  const nextDate = addDaysYmd(date, 1)
  const bank = nextDate ? await BankStatement.findOne({ site, date: nextDate }).lean() : null

  const start = startOfUtcDay(date)
  const end = endOfUtcDay(date)
  const [agg] = await CashSummary.aggregate([
    { $match: { site, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        totalPos: { $sum: { $ifNull: ['$totalPos', 0] } },
        kioskGiftCard: { $sum: { $ifNull: ['$kioskGiftCard', 0] } },
        afdGiftCard: { $sum: { $ifNull: ['$afdGiftCard', 0] } },
      },
    },
  ])

  let handheldDebit = 0
  try {
    const { CashSummaryReport } = require('../models/CashSummaryNew')
    const reportDate = new Date(`${date}T00:00:00.000Z`) // CashSummaryReport stores date as UTC midnight
    const report = await CashSummaryReport.findOne({ site, date: reportDate }).lean()
    if (report && typeof report.handheldDebit === 'number') {
      handheldDebit = report.handheldDebit
    }
  } catch (e) {}

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
    (Number(bank?.balanceForward) || 0) - miscDebitsTotal - gblDebitsTotal - (Number(bank?.merchantFees) || 0) + miscCreditsTotal

  const endingBalance = Number(bank?.endingBalance) || 0
  const totalPos = Number(agg?.totalPos) || 0
  const kioskGC = Number(agg?.kioskGiftCard) || 0
  const afdGC = Number(agg?.afdGiftCard) || 0
  const kardpollSales = Number(kardpoll?.sales) || 0
  const kardpollAr = Number(kardpoll?.ar) || 0

  return endingBalance - bankStmtTrans - totalPos - kardpollSales + kioskGC + afdGC + kardpollAr - handheldDebit
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
      'giftCertificates',
      'cashOffCoupons',
      'otherCoupons',
      'canadianCash',
      'cashOnHand',
      'parsedCashBack',
      'parsedPayouts',
      'safedropsCount',
      'safedropsAmount',
      // Lotto fields
      'onlineLottoTotal',
      'instantLottTotal',
      'lottoPayout',
      'unsettledPrepays',
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

    // Use per-shift aggregated unsettledPrepays if available, otherwise fall back to CashSummaryReport
    const aggUnsettledPrepays = agg?.unsettledPrepays
    try {
      const { CashSummaryReport } = require('../models/CashSummaryNew')
      const reportDate = new Date(`${date}T00:00:00.000Z`) // CashSummaryReport stores date as UTC midnight
      const report = await CashSummaryReport.findOne({ site, date: reportDate }).lean()
      if (report) {
        cashSummary.unsettledPrepays = aggUnsettledPrepays || (typeof report.unsettledPrepays === 'number' ? report.unsettledPrepays : undefined)
        cashSummary.handheldDebit = typeof report.handheldDebit === 'number' ? report.handheldDebit : undefined
      } else {
        cashSummary.unsettledPrepays = aggUnsettledPrepays || undefined
      }
    } catch (e) {
      cashSummary.unsettledPrepays = aggUnsettledPrepays || undefined
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

    const bankRecDay = endingBalance - bankStmtTrans - totalPos - kardpollSales + kioskGC + afdGC + kardpollAr - handheldDebit
    let bankRec = bankRecDay

    // On Sundays, aggregate bankRec across Friday, Saturday, and Sunday
    const [yr, mo, dy] = date.split('-').map(Number)
    if (new Date(Date.UTC(yr, mo - 1, dy)).getUTCDay() === 0) {
      const fridayDate = addDaysYmd(date, -2)
      const saturdayDate = addDaysYmd(date, -1)
      const [fridayRec, saturdayRec] = await Promise.all([
        computeBankRecForDate(site, fridayDate),
        computeBankRecForDate(site, saturdayDate),
      ])
      bankRec = fridayRec + saturdayRec + bankRecDay
    }


    // Compute miscCreditDescTotal: sum of miscCredits where description contains 'credit' or 'tns' (case-insensitive)
    const miscCreditDescTotal = Array.isArray(bank?.miscCredits)
      ? bank.miscCredits.reduce((sum, tx) => {
          const desc = typeof tx.description === 'string' ? tx.description.toLowerCase() : ''
          return (desc.includes('credit') || desc.includes('tns'))
            ? sum + (Number(tx.amount) || 0)
            : sum
        }, 0)
      : 0

    // Compute Balance Check (moved from frontend):
    // totalPos + report_canadian_cash + couponsAccepted + giftCertificates + payouts - totalSales + totalReceivablesAmount
    const reportCanadianCash = Number(cashSummary?.totals?.report_canadian_cash) || 0
    const couponsAccepted = Number(cashSummary?.totals?.couponsAccepted) || 0
    const giftCertificates = Number(cashSummary?.totals?.giftCertificates) || 0
    const payouts = Number(cashSummary?.totals?.payouts) || 0
    const totalSalesNum = Number(cashSummary?.totals?.totalSales) || 0
    const missedCpl = Number(cashSummary?.totals?.missedCpl) || 0
    const otherCoupons = Number(cashSummary?.totals?.otherCoupons) || 0
    // Include both couponsAccepted and giftCertificates in balanceCheck
    const balanceCheck = totalPos + reportCanadianCash + couponsAccepted + giftCertificates + payouts - totalSalesNum + (Number(totalReceivablesAmount) || 0) + missedCpl + otherCoupons

    // Compute adjusted over/short for lottery sites
    let adjustedOverShort = null
    try {
      const location = await Location.findOne({ stationName: site }).lean()
      if (location?.sellsLottery) {
        const lotteryDoc = await Lottery.findOne({ site, date }).lean()
        if (lotteryDoc) {
          const shiftOnline = Number(cashSummary?.totals?.onlineLottoTotal) || 0
          const shiftInstant = Number(cashSummary?.totals?.instantLottTotal) || 0
          const onlineOverShort =
            shiftOnline -
            ((Number(lotteryDoc.onlineLottoTotal) || 0) -
              (Number(lotteryDoc.onlineCancellations) || 0) -
              (Number(lotteryDoc.onlineDiscounts) || 0))
          const scratchOverShort =
            shiftInstant -
            ((Number(lotteryDoc.instantLottTotal) || 0) +
              (Number(lotteryDoc.scratchFreeTickets) || 0) +
              (Number(lotteryDoc.oldScratchTickets) || 0))
          const adjustedReportedCash = reportCanadianCash + onlineOverShort + scratchOverShort
          const canadianCashCollected = Number(cashSummary?.totals?.canadian_cash_collected) || 0
          adjustedOverShort =
            canadianCashCollected -
            adjustedReportedCash +
            (Number(cashSummary?.handheldDebit) || 0) +
            (Number(cashSummary?.unsettledPrepays) || 0)
        }
      }
    } catch (e) {
      // silent — fall back to null so frontend uses regular formula
    }

    return res.json({
      kardpoll: kardpoll || null,
      bank: bank || null,
      cashSummary,
      totalReceivablesAmount,
      bankStmtTrans,
      bankRec,
      bankRecDay,
      balanceCheck,
      adjustedOverShort,
    })
  } catch (err) {
    console.error('cashRecRoutes.entries error:', err)
    return res.status(500).json({ error: 'Failed to load entries' })
  }
})

router.post('/kardpoll', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { site, date, litresSold, sales, ar, ar_rows } = req.body || {}

    if (!site || !date) {
      return res.status(400).json({ error: 'site and date (YYYY-MM-DD) are required' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' })
    }

    const parsed = {
      site,
      date,
      litresSold: round2(parseFloat(litresSold) || 0),
      sales: round2(parseFloat(sales) || 0),
      ar: round2(parseFloat(ar) || 0),
      ar_rows: Array.isArray(ar_rows) ? ar_rows : [],
    }

    const existing = await KardpollReport.findOne({ site, date }).lean()
    if (existing) {
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

    const doc = KardpollReport.fromParsed(parsed)
    const saved = await doc.save()
    return res.json({ saved: true, report: saved })
  } catch (e) {
    console.error('cashRecRoutes.kardpoll error:', e)
    res.status(500).json({ error: 'Failed to save Kardpoll report' })
  }
})

router.post('/parse-kardpoll-excel', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const { site, date, totalSales, totalLitres } = req.body || {}
    if (!site || !date || !totalSales || !totalLitres) {
      return res.status(400).json({ error: 'site, date, totalSales, and totalLitres are required' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' })
    }

    const sales = parseFloat(totalSales) || 0
    const litresSold = parseFloat(totalLitres) || 0

    const existing = await KardpollReport.findOne({ site, date }).lean()
    if (existing) {
      const updated = await KardpollReport.findByIdAndUpdate(
        existing._id,
        { sales, litresSold },
        { new: true }
      ).lean()
      return res.json({ saved: true, upserted: true, report: updated })
    }

    const doc = new KardpollReport({ site, date, sales, litresSold, ar: 0, ar_rows: [] })
    const saved = await doc.save()
    return res.json({ saved: true, report: saved })
  } catch (e) {
    console.error('cashRecRoutes.parse-kardpoll-excel error:', e)
    return res.status(500).json({ error: 'Failed to save Kardpoll report' })
  }
})

// Manually trigger the weekly AR report email (for testing)
router.post('/send-weekly-ar-report', async (req, res) => {
  try {
    const { sendWeeklyArReport } = require('../cron_jobs/weeklyArReportCron')
    await sendWeeklyArReport()
    return res.json({ success: true, message: 'Weekly AR report queued successfully.' })
  } catch (e) {
    console.error('send-weekly-ar-report error:', e)
    return res.status(500).json({ error: 'Failed to send weekly AR report', details: e.message })
  }
})

router.get('/tags', async (req, res) => {
  const { site, startDate, endDate } = req.query
  if (!site || !startDate) return res.status(400).json({ error: 'site and startDate required' })
  const dateFilter = endDate ? { $gte: startDate, $lte: endDate } : startDate
  const tags = await CashRecTag.find({ site, date: dateFilter }).lean()
  res.json(tags)
})

router.post('/tags', express.json(), async (req, res) => {
  const { site, date } = req.body || {}
  if (!site || !date) return res.status(400).json({ error: 'site and date required' })
  const tag = await CashRecTag.findOneAndUpdate(
    { site, date },
    { site, date },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  res.json(tag)
})

router.delete('/tags', async (req, res) => {
  const { site, date } = req.query
  if (!site || !date) return res.status(400).json({ error: 'site and date required' })
  await CashRecTag.deleteOne({ site, date })
  res.json({ ok: true })
})

module.exports = router