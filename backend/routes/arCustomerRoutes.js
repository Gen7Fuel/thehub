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

module.exports = router
