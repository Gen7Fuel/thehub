const express = require('express')
const router = express.Router()

// JSON body parsing
router.use(express.json({ limit: '1mb' }))

// Bridge to ESM auth middleware
let _auth
async function getAuth() {
  if (_auth) return _auth
  const mod = await import('../middleware/authMiddleware.js')
  _auth = mod.auth
  return _auth
}
router.use(async (req, res, next) => {
  try {
    const auth = await getAuth()
    return auth(req, res, next)
  } catch (e) {
    console.error('fuelRecRoutes auth bridge error:', e)
    return res.status(500).json({ error: 'Auth middleware load failed' })
  }
})

// Bridge to ESM BOLPhoto model
let _BOLPhoto
async function getBOLPhoto() {
  if (_BOLPhoto) return _BOLPhoto
  const mod = await import('../models/FuelRec.js')
  _BOLPhoto = mod.BOLPhoto || mod.default
  return _BOLPhoto
}

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// POST /api/fuel-rec/capture
// body: { site: string, date: 'YYYY-MM-DD', photo: string }  // photo = filename from CDN
router.post('/capture', async (req, res) => {
  const site = String(req.body?.site || '').trim()
  const date = String(req.body?.date || '').trim()
  const filename = String(req.body?.photo || '').trim()

  if (!site || !isYmd(date) || !filename) {
    return res.status(400).json({ error: 'site, date (YYYY-MM-DD) and photo filename are required' })
  }

  try {
    const BOLPhoto = await getBOLPhoto()
    const saved = await BOLPhoto.findOneAndUpdate(
      { site, date, filename },
      { $setOnInsert: { site, date, filename } },
      { new: true, upsert: true }
    ).lean()

    return res.status(200).json({ saved: true, photo: saved })
  } catch (e) {
    if (e && e.code === 11000) {
      const BOLPhoto = await getBOLPhoto()
      const existing = await BOLPhoto.findOne({ site, date, filename }).lean()
      return res.status(200).json({ saved: true, photo: existing })
    }
    console.error('fuelRec.capture error:', e)
    return res.status(500).json({ error: 'Failed to save BOL photo' })
  }
})

// GET /api/fuel-rec/list?site=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/list', async (req, res) => {
  try {
    const site = String(req.query?.site || '').trim()
    let from = String(req.query?.from || '').trim()
    let to = String(req.query?.to || '').trim()

    if (!site) return res.status(400).json({ error: 'site is required' })
    if (from && !isYmd(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' })
    if (to && !isYmd(to)) return res.status(400).json({ error: 'to must be YYYY-MM-DD' })

    if (from && to && from > to) [from, to] = [to, from]

    const filter = { site }
    if (from || to) {
      const range = {}
      if (from) range.$gte = from
      if (to) range.$lte = to
      filter.date = range
    }

    const BOLPhoto = await getBOLPhoto()
    const entries = await BOLPhoto.find(filter).sort({ date: -1, createdAt: -1 }).lean()

    return res.json({
      site,
      from: from || null,
      to: to || null,
      count: entries.length,
      entries,
    })
  } catch (e) {
    console.error('fuelRec.list error:', e)
    return res.status(500).json({ error: 'Failed to list BOL photos' })
  }
})

module.exports = router