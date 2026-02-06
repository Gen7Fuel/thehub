const express = require('express');
const router = express.Router();
const Maintenance = require('../models/Maintenance'); 

// 1. POST: Create a new maintenance schedule
router.post('/', async (req, res) => {
  try {
    const maintenance = new Maintenance({
      ...req.body,
      createdBy: req.user.id,
      // Default to scheduled unless explicitly told otherwise
      status: req.body.status || 'scheduled' 
    });

    const saved = await maintenance.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: "Failed to create schedule", error: err.message });
  }
});

// 2. GET ALL: List all records
router.get('/', async (req, res) => {
  try {
    const records = await Maintenance.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ scheduleStart: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching schedules" });
  }
});

// 3. GET SINGLE: Get specific maintenance details
router.get('/:id', async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id)
      .populate('createdBy startedBy closedBy', 'firstName lastName');
    
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 4. PUT: Update/Edit schedule or change status (Start/End)
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Logic for tracking who starts/ends the maintenance
    if (updateData.status === 'ongoing') {
      updateData.actualStart = new Date();
      updateData.startedBy = req.user.id;
    } else if (updateData.status === 'completed' || updateData.status === 'cancelled') {
      updateData.actualEnd = new Date();
      updateData.closedBy = req.user.id;
    }

    const updated = await Maintenance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Record not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
});

// 5. DELETE: Remove a schedule
router.delete('/:id', async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // Industrial safety: don't delete if it's active
    if (record.status === 'ongoing') {
      return res.status(400).json({ message: "Cannot delete an active maintenance session." });
    }

    await record.deleteOne();
    res.json({ message: "Maintenance record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;