const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');


// @route   GET /api/fuel-station-tanks/all-locations
// @desc    Get only "store" locations with their fuel rack/carrier + tank count
router.get('/all-locations', async (req, res) => {
  try {
    // 1. Filter by type: 'store' to ignore offices/other entities
    const locations = await Location.find({ type: 'store' })
      .populate('defaultFuelRack', 'rackName')
      .populate('defaultFuelCarrier', 'carrierName')
      .lean();

    // 2. Get IDs of the filtered locations to narrow down the aggregation
    const storeIds = locations.map(loc => loc._id);

    // 3. Get tank counts only for these specific stores
    const tankCounts = await FuelStationTank.aggregate([
      { 
        $match: { stationId: { $in: storeIds } } 
      },
      { 
        $group: { _id: "$stationId", count: { $sum: 1 } } 
      }
    ]);

    // 4. Merge the counts into the store objects
    const merged = locations.map(loc => {
      const countData = tankCounts.find(t => t._id.toString() === loc._id.toString());
      return {
        ...loc,
        tankCount: countData ? countData.count : 0
      };
    });

    res.json(merged);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/fuel-station-tanks/location/:id
// @desc    Get location fuel settings and its tanks
router.get('/location/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('defaultFuelRack')
      .populate('defaultFuelCarrier');
    const tanks = await FuelStationTank.find({ stationId: req.params.id });
    res.json({ location, tanks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/fuel-station-tanks/location/:id
// @desc    Update only the 4 allowed fuel-related fields for a Location
router.put('/location/:id', async (req, res) => {
  const { fuelStationNumber, address, defaultFuelRack, defaultFuelCarrier } = req.body;
  try {
    const updated = await Location.findByIdAndUpdate(
      req.params.id,
      { fuelStationNumber, address, defaultFuelRack, defaultFuelCarrier },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   POST /api/fuel-station-tanks/tanks
// @desc    Add a new tank to a station
router.post('/tanks', async (req, res) => {
  try {
    const newTank = new FuelStationTank(req.body);
    const saved = await newTank.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   PUT /api/fuel-station-tanks/tanks/:id
// @desc    Update tank details (capacity, ullage, etc)
router.put('/tanks/:id', async (req, res) => {
  try {
    const updated = await FuelStationTank.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// @route   DELETE /api/fuel-station-tanks/tanks/:id
router.delete('/tanks/:id', async (req, res) => {
  try {
    await FuelStationTank.findByIdAndDelete(req.params.id);
    res.json({ message: "Tank removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;