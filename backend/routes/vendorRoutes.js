const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');

// Create new vendor
router.post('/', async (req, res) => {
  console.log("Vendor POST request: ", req.body);
  try {
    const {
      name,
      location,
      station_supplies,
      email_order,
      email,
      order_placement_method,
      vendor_order_frequency,
      category,
    } = req.body;
    if (!name || !location || !Array.isArray(station_supplies)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const vendor = await Vendor.create({
      name,
      location,
      station_supplies,
      email_order,
      email,
      order_placement_method,
      vendor_order_frequency,
      category,
    });
    res.status(201).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create vendor.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { location, category } = req.query;
    const filter = {};
    if (location) filter.location = location;
    if (category) filter.category = category;
    const vendors = await Vendor.find(filter);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single vendor by ID
router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor.' });
  }
});

// Update a vendor by ID
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      location,
      station_supplies,
      email_order,
      email,
      order_placement_method,
      vendor_order_frequency,
      last_order_date,
      category,
    } = req.body;
    if (!name || !location || !Array.isArray(station_supplies)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        name,
        location,
        station_supplies,
        email_order,
        email,
        order_placement_method,
        vendor_order_frequency,
        last_order_date,
        category,
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
});

module.exports = router