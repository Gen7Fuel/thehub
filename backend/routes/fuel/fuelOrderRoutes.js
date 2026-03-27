const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelRack = require('../../models/fuel/FuelRack');

// GET count of orders for a station on a specific date
router.get('/count', async (req, res) => {
  try {
    const { stationId, date } = req.query;
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23,59,59,999);

    const count = await FuelOrder.countDocuments({
      station: stationId,
      orderDate: { $gte: startOfDay, $lte: endOfDay }
    });
    
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// fuelOrderRoutes.js
router.get('/check-existing', async (req, res) => {
  try {
    const { stationId, orderDate } = req.query;
    
    // 1. Precise Date Range for the Order Date
    const start = new Date(orderDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(orderDate);
    end.setUTCHours(23, 59, 59, 999);

    // 2. Find all orders for this station on this specific order date
    const existingOrders = await FuelOrder.find({
      station: stationId,
      orderDate: { $gte: start, $lte: end }
    }).select('deliveryDate poNumber');

    res.json({
      count: existingOrders.length,
      existingOrders: existingOrders // Send back dates to check on frontend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;