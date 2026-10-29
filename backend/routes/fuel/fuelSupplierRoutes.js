const express = require('express');
const router = express.Router();
const FuelSupplier = require('../../models/fuel/FuelSupplier');
const FuelRack = require('../../models/fuel/FuelRack');
const { logChange } = require('../../middleware/changeLogger');

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const { associatedRack } = req.query;

    // Create a filter object. If associatedRack is provided, 
    // it filters; otherwise, it stays empty and finds all.
    const queryFilter = associatedRack ? { associatedRack } : {};

    const suppliers = await FuelSupplier.find(queryFilter)
      .populate('associatedRack');

    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await FuelSupplier.findById(req.params.id).populate('associatedRack');
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new supplier
router.post('/', async (req, res) => {
  try {
    const newSupplier = new FuelSupplier(req.body);
    const saved = await newSupplier.save();
    await logChange(req, {
      action: 'create', resourceType: 'fuel-supplier', resourceId: saved._id,
      resourceLabel: saved.supplierName, before: null, after: saved.toObject(),
      success: true, statusCode: 201, source: 'fuel-management.manage.suppliers',
    });
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "This supplier already exists for this rack." });
    }
    res.status(400).json({ message: err.message });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const before = await FuelSupplier.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Supplier not found' });
    const updated = await FuelSupplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await logChange(req, {
      action: 'update', resourceType: 'fuel-supplier', resourceId: updated._id,
      resourceLabel: updated.supplierName, before, after: updated.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.manage.suppliers',
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a supplier
router.delete('/:id', async (req, res) => {
  try {
    const deletedSupplier = await FuelSupplier.findByIdAndDelete(req.params.id);

    if (!deletedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    await logChange(req, {
      action: 'delete', resourceType: 'fuel-supplier', resourceId: deletedSupplier._id,
      resourceLabel: deletedSupplier.supplierName, before: deletedSupplier.toObject(), after: null,
      success: true, statusCode: 200, source: 'fuel-management.manage.suppliers',
    });

    res.json({ message: "Supplier deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
