const express = require('express');
const router = express.Router();
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelRack = require('../../models/fuel/FuelRack');

// GET all racks
router.get('/', async (req, res) => {
  try {
    const racks = await FuelRack.find()
      .populate('defaultSupplier')
      .populate('associatedCarriers');
    res.json(racks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single rack
router.get('/:id', async (req, res) => {
  try {
    const rack = await FuelRack.findById(req.params.id)
      .populate('defaultSupplier')
      .populate('associatedCarriers');
    res.json(rack);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new rack
router.post('/', async (req, res) => {
  try {
    const newRack = new FuelRack(req.body);
    const saved = await newRack.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update rack
router.put('/:id', async (req, res) => {
  try {
    const updated = await FuelRack.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/fuel-racks/:id
router.delete('/:id', async (req, res) => {
  try {
    const rack = await FuelRack.findById(req.params.id);
    if (!rack) return res.status(404).json({ message: 'Rack not found' });
    
    await FuelRack.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rack deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;