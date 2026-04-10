const express = require('express');
const router = express.Router();
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelRack = require('../../models/fuel/FuelRack');

// @route   GET /api/fuel-carriers
// @desc    Get all carriers
router.get('/', async (req, res) => {
  try {
    const carriers = await FuelCarrier.find().populate('associatedRacks');
    res.json(carriers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/fuel-carriers/:id
// @desc    Get single carrier by ID
router.get('/:id', async (req, res) => {
  try {
    const carrier = await FuelCarrier.findById(req.params.id).populate('associatedRacks');
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });
    res.json(carrier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/fuel-carriers
// @desc    Create a new carrier
router.post('/', async (req, res) => {
  const { carrierName, carrierId, associatedRacks, contact } = req.body;

  const newCarrier = new FuelCarrier({
    carrierName,
    carrierId,
    associatedRacks,
    contact
  });

  try {
    const savedCarrier = await newCarrier.save();
    res.status(201).json(savedCarrier);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Carrier ID already exists." });
    }
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/fuel-carriers/:id
// @desc    Update a carrier
router.put('/:id', async (req, res) => {
  try {
    // We expect associatedRacks to be an array of IDs in req.body
    const updatedCarrier = await FuelCarrier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('associatedRacks');
    
    res.json(updatedCarrier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/fuel-carriers/:id
// @desc    Delete a carrier
router.delete('/:id', async (req, res) => {
  try {
    const carrier = await FuelCarrier.findById(req.params.id);
    
    if (!carrier) {
      return res.status(404).json({ message: 'Carrier not found' });
    }

    await FuelCarrier.findByIdAndDelete(req.params.id);
    res.json({ message: 'Carrier deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;