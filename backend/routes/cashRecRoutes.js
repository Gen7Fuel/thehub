const express = require('express')
const multer = require('multer')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

// Utility: robust number parser (handles commas, currency, parentheses)
function toNum(s) {
  if (s == null) return 0
  const t = String(s)
    .replace(/^\uFEFF/, '')
    .replace(/[\s$,]/g, '')
    .replace(/^\((.*)\)$/, '-$1')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

// Determine if a card value is AR (fully exposed) vs masked (e.g., 2222********0001)
function isARCard(value) {
  const str = String(value || '')
  if (!str) return false
  if (str.includes('*')) return false // masked => NOT AR
  const digitsOnly = str.replace(/\D/g, '')
  return digitsOnly.length >= 12 // fully exposed number => AR
}

function extractDateRangeFromHeader(lines) {
  let fromStr, toStr
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i]
    const both = line.match(/\bFrom\b\s*:\s*(.*?)\s+\bTo\b\s*:\s*(.*)/i)
    if (both) {
      fromStr = fromStr || both[1].trim()
      toStr = toStr || both[2].trim()
      break
    }
    const mFrom = line.match(/\bFrom\b\s*:\s*([^\t]+?)(?:\s{2,}|$)/i)
    const mTo = line.match(/\bTo\b\s*:\s*([^\t]+?)(?:\s{2,}|$)/i)
    if (mFrom && !fromStr) fromStr = mFrom[1].trim()
    if (mTo && !toStr) toStr = mTo[1].trim()
  }

  // Normalize to YYYY-MM-DD even if time is present (e.g., "2025-11-07 00:00")
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

  const dateFromYMD = toYmd(fromStr)
  const dateToYMD = toYmd(toStr)

  return {
    // keep raws internal if needed, but expose a single date
    date: dateFromYMD || dateToYMD,
  }
}

// Parse tab-delimited "Transaction Detail" report
function parseTransactionDetailTab(text) {
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
  const clean = String(text || '')
    .replace(/^\uFEFF/, '') // strip BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const lines = clean.split('\n').map(l => l.trimEnd()).filter(Boolean)

  // Find header row requiring "Card1/Card2" and "Quantity" and "Total"
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
      rows: 0,
      warning: 'Header row not found. Expected columns: Card1/Card2, Quantity, Total',
    }
  }

  // Exact column indices
  const idxOfExact = (name) =>
    headers.findIndex(h => h.toLowerCase() === String(name).toLowerCase())

  const qtyIdx =
    idxOfExact('Quantity') >= 0 ? idxOfExact('Quantity') :
    headers.findIndex(h => h.toLowerCase().includes('qty'))

  const totalIdx =
    idxOfExact('Total') >= 0 ? idxOfExact('Total') :
    headers.findIndex(h => h.toLowerCase().includes('amount'))

  const cardIdx = idxOfExact('Card1/Card2')

  let litresSold = 0
  let sales = 0
  let ar = 0
  let rows = 0

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim())
    if (cols.length <= Math.max(qtyIdx, totalIdx, cardIdx)) continue

    // Skip footer/grand total lines
    const first = (cols[0] || '').toLowerCase()
    if (first.startsWith('total')) continue

    const qty = qtyIdx >= 0 ? toNum(cols[qtyIdx]) : 0
    const tot = totalIdx >= 0 ? toNum(cols[totalIdx]) : 0
    const cardVal = cardIdx >= 0 ? cols[cardIdx] : ''

    // Skip empty rows
    if (qty === 0 && tot === 0) continue

    litresSold += qty
    sales += tot
    if (isARCard(cardVal)) ar += tot
    rows++
  }

  const headerDates = extractDateRangeFromHeader(lines)

  return {
    litresSold: round2(litresSold),
    sales: round2(sales),
    ar: round2(ar),
    rows,
    date: headerDates.date,
  }
}

// POST /api/cash-rec/parse-transactions
// Accepts multipart/form-data with field "file" containing a tab-delimited text report.
router.post('/parse-kardpoll', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file (use field name "file")' })
    const text = req.file.buffer.toString('utf8')
    const result = parseTransactionDetailTab(text)
    return res.json(result)
  } catch (err) {
    console.error('cashRecRoutes.parse-transactions error:', err)
    return res.status(500).json({ error: 'Failed to parse file' })
  }
})

module.exports = router