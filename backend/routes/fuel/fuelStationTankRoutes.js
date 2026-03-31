const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelSales = require('../../models/fuel/FuelSales');
const FuelOrder = require('../../models/fuel/FuelOrder');


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

// Native Helper: Get 3-week average for a specific day of week
async function getAverageSales(stationId, targetDate) {
  // Get English name of the day (e.g., "Tuesday")
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);

  // Create a boundary for "before this date"
  const startOfTarget = new Date(targetDate);
  startOfTarget.setHours(0, 0, 0, 0);

  // Look back at the previous 3 instances of this specific weekday
  const pastSales = await FuelSales.find({
    stationId,
    dayOfWeek,
    date: { $lt: startOfTarget }
  })
    .sort({ date: -1 })
    .limit(3)
    .lean();

  if (!pastSales.length) return {};

  const averages = {};
  const count = pastSales.length;

  pastSales.forEach(record => {
    record.salesData.forEach(item => {
      averages[item.grade] = (averages[item.grade] || 0) + (item.volume / count);
    });
  });

  return averages;
}

router.get('/station/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const selectedDate = new Date(req.query.date);

    // Normalize Dates for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compareDate = new Date(selectedDate);
    compareDate.setHours(0, 0, 0, 0);

    const isPast = compareDate < today;
    const isToday = compareDate.getTime() === today.getTime();
    const isFuture = compareDate > today;

    const dateStr = selectedDate.toISOString().split('T')[0];

    // 1. Fetch Data
    const [tanks, avgSales, orders] = await Promise.all([
      FuelStationTank.find({ stationId }).lean(),
      getAverageSales(stationId, selectedDate),
      FuelOrder.find({
        stationId,
        deliveryDate: {
          $gte: new Date(compareDate),
          $lte: new Date(compareDate.setHours(23, 59, 59, 999))
        },
        status: { $in: ['Delivered', 'In-Transit', 'Confirmed'] }
      }).lean()
    ]);

    // Reset compareDate for sales lookup
    compareDate.setHours(0, 0, 0, 0);
    const actualSalesRecord = await FuelSales.findOne({
      stationId,
      date: { $gte: compareDate, $lte: new Date(compareDate).setHours(23, 59, 59, 999) }
    }).lean();

    const enrichedTanks = tanks.map(tank => {
      let openingL = 0;
      let estSalesL = 0;
      let currentSalesL = 0;
      let closingL = 0;

      const gradeOrders = orders
        .filter(o => o.grade === tank.grade)
        .reduce((sum, o) => sum + (o.quantity || 0), 0);

      if (isPast) {
        const hist = tank.historicalVolume?.find(h =>
          h.date.toISOString().split('T')[0] === dateStr
        );
        const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

        openingL = hist?.openingVolume || 0;
        estSalesL = salesEntry?.volume || 0;
        closingL = hist?.closingVolume || 0;
      }
      else if (isToday) {
        const hist = tank.historicalVolume?.find(h =>
          h.date.toISOString().split('T')[0] === dateStr
        );
        const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

        openingL = hist?.openingVolume || 0;
        estSalesL = avgSales[tank.grade] || 0;
        currentSalesL = (actualSalesRecord?.isLive) ? (salesEntry?.volume || 0) : 0;
        closingL = (openingL + gradeOrders) - (isToday && currentSalesL > 0 ? currentSalesL : estSalesL);
      }
      else if (isFuture) {
        estSalesL = avgSales[tank.grade] || 0;
        // Pipeline logic: Future opening is usually today's estimated closing
        // For now set to 0 or implement a recursive lookback
        openingL = 0;
        closingL = (openingL + gradeOrders) - estSalesL;
      }

      return {
        ...tank,
        openingL: Math.round(openingL),
        estSalesL: Math.round(estSalesL),
        currentSalesL: Math.round(currentSalesL),
        closingL: Math.round(closingL)
      };
    });

    res.json(enrichedTanks);
  } catch (err) {
    console.error(err);
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
  const { fuelStationNumber, address, defaultFuelRack, defaultFuelCarrier, fuelCustomerName } = req.body;
  try {
    const updated = await Location.findByIdAndUpdate(
      req.params.id,
      { fuelStationNumber, address, defaultFuelRack, defaultFuelCarrier, fuelCustomerName },
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