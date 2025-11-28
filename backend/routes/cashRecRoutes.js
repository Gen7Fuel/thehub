const express = require('express')
const multer = require('multer')

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
  const customerIdx = idxExact('Customer Name') >= 0 ? idxExact('Customer Name') : headers.findIndex(h => h.toLowerCase().includes('customer'))

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
    const customer = customerIdx >= 0 ? cols[customerIdx] : ''

    if (qty === 0 && tot === 0) continue

    litresSold += qty
    sales += tot

    if (isARCard(cardVal)) {
      ar += tot
      ar_rows.push({
        customer,
        card: cardVal,
        amount: round2(tot),
        quantity: round2(qty),
        price_per_litre: round2(price),
      })
    }
  }

  const date = extractDateFromHeader(lines)

  return {
    litresSold: round2(litresSold),
    sales: round2(sales),
    ar: round2(ar),
    date,
    ar_rows,
  }
}

// POST /api/cash-rec/parse-kardpoll
router.post('/parse-kardpoll', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file (use field name "file")' })
    const text = req.file.buffer.toString('utf8')
    const result = parseTransactionDetailTab(text)
    return res.json(result)
  } catch (err) {
    console.error('cashRecRoutes.parse-kardpoll error:', err)
    return res.status(500).json({ error: 'Failed to parse file' })
  }
})

module.exports = router