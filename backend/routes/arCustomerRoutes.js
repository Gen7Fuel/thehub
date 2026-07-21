const express = require('express')
const router = express.Router()
const ArCustomer = require('../models/ArCustomer')

// GET / — all customers sorted by name asc
router.get('/', async (req, res) => {
  try {
    const customers = await ArCustomer.find().sort({ name: 1 })
    res.json(customers)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /quick-select — active quick-select buttons for a site, sorted by order
// NOTE: must stay above GET /:id so Express doesn't match "quick-select" as an :id
router.get('/quick-select', async (req, res) => {
  try {
    const { stationName } = req.query
    if (!stationName) return res.status(400).json({ error: 'stationName is required' })

    const customers = await ArCustomer.find({ 'quickSelectSites.stationName': stationName })
      .select('name fleetCardNumber quickSelectSites')

    const result = customers
      .map((c) => {
        const entry = c.quickSelectSites.find((s) => s.stationName === stationName)
        return {
          _id: c._id,
          name: c.name,
          fleetCardNumber: c.fleetCardNumber || '',
          label: entry?.label || '',
          order: entry?.order ?? 0,
        }
      })
      .sort((a, b) => a.order - b.order)

    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /:id — one customer by Mongo _id
router.get('/:id', async (req, res) => {
  try {
    const customer = await ArCustomer.findById(req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /:id — update editable fields only
router.put('/:id', async (req, res) => {
  try {
    const { creditLimit, phone, email, notes } = req.body
    const customer = await ArCustomer.findByIdAndUpdate(
      req.params.id,
      { $set: { creditLimit, phone, email, notes } },
      { new: true, runValidators: true }
    )
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /:id — delete by Mongo _id
router.delete('/:id', async (req, res) => {
  try {
    const customer = await ArCustomer.findByIdAndDelete(req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /sync — upsert + prune customer list
router.post('/sync', async (req, res) => {
  try {
    const { customers } = req.body

    if (!customers || customers.length === 0) {
      return res.status(400).json({ error: 'No valid customer rows provided' })
    }

    const ops = customers.map(({ customerId, name }) => ({
      updateOne: {
        filter: { customerId },
        update: {
          $set: { name },
          $setOnInsert: { creditLimit: null, phone: '', email: '', notes: '' },
        },
        upsert: true,
      },
    }))

    const result = await ArCustomer.bulkWrite(ops)

    const customerIds = customers.map((c) => c.customerId)
    const deleteResult = await ArCustomer.deleteMany({
      customerId: { $nin: customerIds },
    })

    res.json({
      created: result.upsertedCount,
      updated: result.modifiedCount,
      deleted: deleteResult.deletedCount,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /:id/quick-select — add this customer as a quick-select button for a site
router.post('/:id/quick-select', async (req, res) => {
  try {
    const { stationName, label } = req.body
    if (!stationName) return res.status(400).json({ error: 'stationName is required' })

    const customer = await ArCustomer.findById(req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    if (customer.quickSelectSites.some((s) => s.stationName === stationName)) {
      return res.status(409).json({ error: 'Customer is already a quick-select for this site' })
    }

    const siblings = await ArCustomer.find({ 'quickSelectSites.stationName': stationName })
      .select('quickSelectSites')
    const maxOrder = siblings.reduce((max, c) => {
      const entry = c.quickSelectSites.find((s) => s.stationName === stationName)
      return entry ? Math.max(max, entry.order) : max
    }, -1)

    customer.quickSelectSites.push({ stationName, order: maxOrder + 1, label: (label || '').trim() })
    await customer.save()
    res.status(201).json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /:id/quick-select/label — set/clear this customer's quick-select button
// text for a site, overriding the default (first word of the customer's name)
router.put('/:id/quick-select/label', async (req, res) => {
  try {
    const { stationName, label } = req.body
    if (!stationName) return res.status(400).json({ error: 'stationName is required' })

    const customer = await ArCustomer.findOneAndUpdate(
      { _id: req.params.id, 'quickSelectSites.stationName': stationName },
      { $set: { 'quickSelectSites.$.label': (label || '').trim() } },
      { new: true }
    )
    if (!customer) return res.status(404).json({ error: 'Customer or quick-select entry not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /:id/quick-select?stationName=<name> — remove this customer's quick-select button for a site
router.delete('/:id/quick-select', async (req, res) => {
  try {
    const { stationName } = req.query
    if (!stationName) return res.status(400).json({ error: 'stationName is required' })

    const customer = await ArCustomer.findByIdAndUpdate(
      req.params.id,
      { $pull: { quickSelectSites: { stationName } } },
      { new: true }
    )
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /quick-select/move — swap order with the adjacent sibling for a site
router.put('/quick-select/move', async (req, res) => {
  try {
    const { stationName, id, direction } = req.body
    if (!stationName || !id || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'stationName, id, and direction (up|down) are required' })
    }

    const siblings = await ArCustomer.find({ 'quickSelectSites.stationName': stationName })
      .select('name quickSelectSites')
    const ordered = siblings
      .map((c) => ({ id: c._id.toString(), order: c.quickSelectSites.find((s) => s.stationName === stationName).order }))
      .sort((a, b) => a.order - b.order)

    const idx = ordered.findIndex((x) => x.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) {
      return res.status(400).json({ error: 'Cannot move in that direction' })
    }

    const a = ordered[idx]
    const b = ordered[swapIdx]
    await ArCustomer.updateOne(
      { _id: a.id, 'quickSelectSites.stationName': stationName },
      { $set: { 'quickSelectSites.$.order': b.order } }
    )
    await ArCustomer.updateOne(
      { _id: b.id, 'quickSelectSites.stationName': stationName },
      { $set: { 'quickSelectSites.$.order': a.order } }
    )

    const customers = await ArCustomer.find({ 'quickSelectSites.stationName': stationName })
      .select('name fleetCardNumber quickSelectSites')
    const result = customers
      .map((c) => {
        const entry = c.quickSelectSites.find((s) => s.stationName === stationName)
        return {
          _id: c._id,
          name: c.name,
          fleetCardNumber: c.fleetCardNumber || '',
          label: entry?.label || '',
          order: entry?.order ?? 0,
        }
      })
      .sort((a2, b2) => a2.order - b2.order)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /:id/fleet-card — assign or clear this customer's dedicated fleet card number
router.put('/:id/fleet-card', async (req, res) => {
  try {
    const raw = (req.body.fleetCardNumber ?? '').toString().trim()

    if (raw && !/^\d{16}$/.test(raw)) {
      return res.status(400).json({ error: 'Fleet card number must be exactly 16 digits' })
    }

    if (raw) {
      const conflict = await ArCustomer.findOne({ fleetCardNumber: raw, _id: { $ne: req.params.id } })
      if (conflict) return res.status(409).json({ error: 'This fleet card number is already assigned to another customer' })
    }

    // Use $unset (not $set to null) when clearing — the sparse unique index only
    // excludes documents where the field is absent, not documents with value null.
    const update = raw ? { $set: { fleetCardNumber: raw } } : { $unset: { fleetCardNumber: '' } }
    const customer = await ArCustomer.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    )
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
