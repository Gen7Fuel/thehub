const express = require('express')
const router = express.Router()
const multer = require('multer')

const Planogram = require('../models/Planogram')
const OrderRec = require('../models/OrderRec')
const Location = require('../models/Location')
const {
  parsePlanogramWorkbook,
  normalizeGtin,
  planogramKey,
  isOffPlanogram,
  loadPlanogramGtinSet,
} = require('../utils/planogram')

// An explicit size cap matters here: without one, any authenticated user can
// push an arbitrarily large buffer into memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
})

const MAX_ITEMS = 50000
const SHRINK_RATIO = 0.5
const STATION_SUPPLY_CATEGORY = '5001'

/**
 * POST /api/planogram?site=<site>[&confirm=true]
 * Upload a planogram workbook, replacing whatever that site had before.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // Read `site` from the query string first. multer only populates req.body
    // with multipart fields that arrive BEFORE the file part, so depending on
    // req.body alone would make this route sensitive to FormData append order.
    const site = String(req.query.site || req.body?.site || '').trim()
    if (!site) return res.status(400).json({ message: 'site is required' })
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

    // A typo'd site would store a planogram under a name no order rec can ever
    // match, and the feature would silently do nothing. Fail loudly instead.
    const location = await Location.findOne({ site })
    if (!location) {
      return res.status(404).json({ message: `Unknown site "${site}"` })
    }

    let parsed
    try {
      parsed = parsePlanogramWorkbook(req.file.buffer)
    } catch (e) {
      return res
        .status(400)
        .json({ message: 'Could not read workbook', error: e.message })
    }

    // Guard 1: never let an unreadable file wipe a good planogram.
    if (parsed.items.length === 0) {
      return res.status(422).json({
        message: 'No valid GTINs found. The existing planogram was NOT modified.',
        sheetNames: parsed.sheetNames,
        perSheet: parsed.perSheet,
        rejectedCells: parsed.rejectedCells,
        headerDetected: parsed.headerDetected,
      })
    }

    if (parsed.items.length > MAX_ITEMS) {
      return res
        .status(413)
        .json({ message: `Planogram exceeds ${MAX_ITEMS} items` })
    }

    const existing = await Planogram.findOne({ site }, { gtinCount: 1 }).lean()
    const previousCount = existing?.gtinCount ?? 0

    // Guard 2: a large shrink usually means the wrong or a truncated file, not
    // a deliberate reset. Make the caller say so explicitly.
    const confirmed = String(req.query.confirm ?? req.body?.confirm) === 'true'
    if (
      previousCount > 0 &&
      parsed.items.length < previousCount * SHRINK_RATIO &&
      !confirmed
    ) {
      return res.status(409).json({
        needsConfirmation: true,
        message: `New file has ${parsed.items.length} GTINs vs ${previousCount} currently on file. Re-submit with confirm=true to replace.`,
        previousCount,
        newCount: parsed.items.length,
      })
    }

    const $set = {
      site,
      items: parsed.items,
      gtinCount: parsed.items.length,
      sourceFilename: req.file.originalname || '',
      sheetNames: parsed.sheetNames,
      uploadedBy: req.user?.email || '',
      uploadedAt: new Date(),
    }

    // Replacing the items array on a single document is one atomic write, so
    // there is no window where the site has a partial planogram.
    let doc
    try {
      doc = await Planogram.findOneAndUpdate(
        { site },
        { $set },
        { upsert: true, new: true, setDefaultsOnInsert: true, projection: { items: 0 } }
      )
    } catch (e) {
      // Two concurrent first-time uploads for the same site can race on the
      // unique index; the loser just retries as a plain update.
      if (e?.code === 11000) {
        doc = await Planogram.findOneAndUpdate(
          { site },
          { $set },
          { new: true, projection: { items: 0 } }
        )
      } else {
        throw e
      }
    }

    res.status(201).json({
      message: `Planogram replaced for ${site}`,
      site,
      gtinCount: doc.gtinCount,
      previousCount,
      sheetNames: parsed.sheetNames,
      perSheet: parsed.perSheet,
      rejectedCells: parsed.rejectedCells,
      headerDetected: parsed.headerDetected,
    })
  } catch (err) {
    console.error('[planogram] upload failed:', err)
    res.status(500).json({ message: 'Failed to process planogram file' })
  }
})

/**
 * GET /api/planogram?site=<site>
 * Metadata for the site's current planogram, so the upload page can show what
 * is about to be replaced. Never returns the items array.
 */
router.get('/', async (req, res) => {
  try {
    const site = String(req.query.site || '').trim()
    if (!site) return res.status(400).json({ message: 'site is required' })

    const doc = await Planogram.findOne({ site }, { items: 0 }).lean()
    if (!doc) return res.status(404).json({ exists: false, site })

    res.json({ exists: true, ...doc })
  } catch (err) {
    console.error('[planogram] fetch failed:', err)
    res.status(500).json({ message: 'Failed to load planogram' })
  }
})

/**
 * POST /api/planogram/recheck/:orderRecId[?dryRun=true]
 * Re-evaluate an existing order rec against the site's current planogram —
 * for order recs created before their planogram was uploaded.
 *
 * Run with dryRun=true first: the flagged/total ratio tells you whether the
 * planogram and the order rec are keyed the same way before you write anything.
 */
router.post('/recheck/:orderRecId', async (req, res) => {
  try {
    const dryRun = String(req.query.dryRun) === 'true'

    const orderRec = await OrderRec.findById(req.params.orderRecId).lean()
    if (!orderRec) return res.status(404).json({ message: 'Order rec not found' })

    const planogramGtins = await loadPlanogramGtinSet(orderRec.site)
    if (!planogramGtins) {
      return res.json({
        checked: false,
        reason: 'no-planogram',
        site: orderRec.site,
        flagged: 0,
        changed: 0,
      })
    }

    const $set = {}
    let total = 0
    let flagged = 0
    let changed = 0
    let exempt = 0
    let unparseable = 0
    // Which side of the crtCode/gtin fallback each item was matched on. The
    // dry run exists to tell you whether the two files are keyed the same way,
    // and that question is now per-item rather than per-order-rec.
    let byCrtCode = 0
    let byGtin = 0
    const samples = []

    ;(orderRec.categories || []).forEach((cat, ci) => {
      const isStationSupply = String(cat?.number ?? '') === STATION_SUPPLY_CATEGORY

      ;(cat.items || []).forEach((item, ii) => {
        total++

        if (isStationSupply) exempt++
        else if (planogramKey(item) === null) unparseable++
        else if (normalizeGtin(item.crtCode) !== null) byCrtCode++
        else byGtin++

        const next = isOffPlanogram(item, planogramGtins, isStationSupply)

        if (next) {
          flagged++
          if (samples.length < 20) {
            samples.push({
              gtin: item.gtin,
              crtCode: item.crtCode || '',
              matchedOn: planogramKey(item),
              itemName: item.itemName,
              category: cat.number,
            })
          }
        }

        if (item.offPlanogram !== next) {
          $set[`categories.${ci}.items.${ii}.offPlanogram`] = next
          changed++
        }
      })
    })

    if (!dryRun && changed > 0) {
      $set.planogramCheckedAt = new Date()

      // Dotted-path updateOne rather than doc.save(): it skips whole-document
      // validation (a legacy item with a blank required gtin would otherwise
      // throw on what is really a metadata update), writes only the leaves that
      // changed so a concurrent item toggle isn't clobbered, and needs no
      // markModified() on the nested categories array.
      await OrderRec.updateOne({ _id: orderRec._id }, { $set })

      const io = req.app.get('io')
      if (io) io.emit('orderUpdated', await OrderRec.findById(orderRec._id).lean())
    }

    res.json({
      checked: true,
      dryRun,
      site: orderRec.site,
      total,
      flagged,
      changed,
      exempt,
      unparseable,
      byCrtCode,
      byGtin,
      planogramSize: planogramGtins.size,
      samples,
    })
  } catch (err) {
    console.error('[planogram] recheck failed:', err)
    res.status(500).json({ message: 'Recheck failed' })
  }
})

module.exports = router
