const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelOrder = require('../../models/fuel/FuelOrder');
const FuelCarrier = require('../../models/fuel/FuelCarrier');
const FuelRack = require('../../models/fuel/FuelRack');

// routes/fuelOrders.js
router.get('/workspace-orders', async (req, res) => {
  try {
    const { stationId, date } = req.query;

    if (!stationId || !date) {
      return res.status(400).json({ message: "Station ID and Date are required" });
    }

    // Use UTC to match how MongoDB stores the dates from your post route
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const orders = await FuelOrder.find({
      station: stationId,
      estimatedDeliveryDate: { $gte: start, $lte: end }
    })
    // Mapped to match your Schema exactly (removing 'Id' suffix)
    .populate('carrier', 'carrierName') 
    .populate('supplier', 'supplierName')
    .populate('rack', 'rackName')
    .lean();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// fuelOrderRoutes.js
// fuelOrderRoutes.js
router.get('/check-existing', async (req, res) => {
  try {
    const { stationId, orderDate } = req.query;

    const start = new Date(orderDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(orderDate);
    end.setUTCHours(23, 59, 59, 999);

    const existingOrders = await FuelOrder.find({
      station: stationId,
      orderDate: { $gte: start, $lte: end }
    }).select('originalDeliveryDate poNumber');

    res.json({
      count: existingOrders.length,
      existingOrders: existingOrders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      stationId, rackId, supplierId, carrierId,
      items, poNumber, orderDate, deliveryDate,
      startTime, endTime, badgeNo
    } = req.body;

    // 1. Check for duplicate PO Number
    const existing = await FuelOrder.findOne({ poNumber });
    if (existing) {
      return res.status(400).json({ message: "An order with this PO Number already exists." });
    }

    // 2. Map frontend data to the new FuelOrder schema
    const newOrder = new FuelOrder({
      poNumber,
      orderDate: new Date(orderDate),
      // Schema uses 'originalDeliveryDate'
      originalDeliveryDate: new Date(deliveryDate),
      // Schema uses 'originalDeliveryWindow'
      originalDeliveryWindow: {
        start: startTime,
        end: endTime
      },
      // Initialize estimates with original values for now
      estimatedDeliveryDate: new Date(deliveryDate),
      estimatedDeliveryWindow: {
        start: startTime,
        end: endTime
      },
      rack: rackId,
      supplier: supplierId,
      badgeNo: badgeNo,
      carrier: carrierId,
      station: stationId,
      items,
      currentStatus: "Pending",
      // History initialized with the creation timestamp
      statusHistory: [
        { status: "Pending", timestamp: new Date() }
      ]
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    console.error("Save Order Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;