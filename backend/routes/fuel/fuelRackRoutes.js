const express = require('express');
const router = express.Router();
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelRack = require('../../models/fuel/FuelRack');
const { logChange } = require('../../middleware/changeLogger');

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
    await logChange(req, {
      action: 'create', resourceType: 'fuel-rack', resourceId: saved._id,
      resourceLabel: saved.rackName, before: null, after: saved.toObject(),
      success: true, statusCode: 201, source: 'fuel-management.manage.racks',
    });
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update rack
router.put('/:id', async (req, res) => {
  try {
    const before = await FuelRack.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Rack not found' });
    const updated = await FuelRack.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await logChange(req, {
      action: 'update', resourceType: 'fuel-rack', resourceId: updated._id,
      resourceLabel: updated.rackName, before, after: updated.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.manage.racks',
    });
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
    await logChange(req, {
      action: 'delete', resourceType: 'fuel-rack', resourceId: rack._id,
      resourceLabel: rack.rackName, before: rack.toObject(), after: null,
      success: true, statusCode: 200, source: 'fuel-management.manage.racks',
    });
    res.json({ message: 'Rack deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
