const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelSales = require('../../models/fuel/FuelSales');
const FuelOrder = require('../../models/fuel/FuelOrder');
const { getLiveTankVolumes } = require('../../services/supaBaseService');


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
        $group: {
          _id: "$stationId",
          count: { $sum: 1 },
          // Collect all fuel grades and then use $addToSet to get unique ones
          availableGrades: { $addToSet: "$grade" }
        }
      }
    ]);

    // 4. Merge the counts into the store objects
    const merged = locations.map(loc => {
      const data = tankCounts.find(t => t._id.toString() === loc._id.toString());
      return {
        ...loc,
        tankCount: data ? data.count : 0,
        // Default to empty array if no tanks found
        availableStationGrades: data ? data.availableGrades : []
      };
    }).filter(loc => loc.tankCount > 0);

    res.json(merged);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Native Helper: Get 3-week average for a specific day of week
async function getAverageSales(stationId, targetDate) {
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(targetDate);
  const startOfTarget = new Date(targetDate);
  startOfTarget.setHours(0, 0, 0, 0);

  // Fetch up to 5 instances to increase the chance of finding 3 "good" data points
  const pastSales = await FuelSales.find({
    stationId,
    dayOfWeek,
    date: { $lt: startOfTarget }
  })
    .sort({ date: -1 })
    .limit(5)
    .lean();

  if (!pastSales.length) return {};

  // 1. Group volumes by grade across all fetched days
  const gradeVolumes = {};
  pastSales.forEach(record => {
    record.salesData.forEach(item => {
      if (!gradeVolumes[item.grade]) gradeVolumes[item.grade] = [];
      // Only collect values > 0
      if (item.volume && item.volume > 0) {
        gradeVolumes[item.grade].push(item.volume);
      }
    });
  });

  const averages = {};

  // 2. Process each grade to filter outliers
  Object.keys(gradeVolumes).forEach(grade => {
    let volumes = gradeVolumes[grade];

    if (volumes.length > 1) {
      // Logic: If a value is > 50% lower than the average of the *other* values in the set, drop it.
      volumes = volumes.filter((val, index, self) => {
        const others = self.filter((_, i) => i !== index);
        const avgOfOthers = others.reduce((a, b) => a + b, 0) / others.length;

        // Return true only if it's not a massive outlier (e.g., 2000L vs 5000L avg)
        return val >= (avgOfOthers * 0.5);
      });
    }

    // 3. Final average calculation based on remaining "clean" data
    if (volumes.length > 0) {
      // We only take the top 3 clean values if more survived
      const finalVolumes = volumes.slice(0, 3);
      const sum = finalVolumes.reduce((a, b) => a + b, 0);
      averages[grade] = sum / finalVolumes.length;
    } else {
      averages[grade] = 0;
    }
  });

  return averages;
}

router.get('/reconciliation/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    if (!stationId || stationId === "[object Object]") {
      return res.status(400).json({ message: "Invalid Station ID provided" });
    }

    const sId = new mongoose.Types.ObjectId(stationId);

    // 1. Get Today's date string in YYYY-MM-DD format
    const todayStr = new Date().toISOString().split('T')[0];

    const searchDate = new Date();
    searchDate.setDate(searchDate.getDate() - 15);

    const tanks = await FuelStationTank.find({ stationId: sId });
    const sales = await FuelSales.find({
      stationId: sId,
      date: { $gte: searchDate }
    }).sort({ date: -1 });

    // Helper: Consistent YYYY-MM-DD conversion
    const toISODate = (date) => new Date(date).toISOString().split('T')[0];

    const reconciliationData = sales
      .filter(saleDay => toISODate(saleDay.date) !== todayStr) // 2. Strictly exclude today
      .map(saleDay => {
        const saleDateStr = toISODate(saleDay.date);

        return {
          date: saleDay.date,
          grades: saleDay.salesData.map(s => {
            const gradeTanks = tanks.filter(t => t.grade === s.grade);
            let openingSum = 0;
            let closingSum = 0;

            gradeTanks.forEach(tank => {
              // 3. Match historical records using the ISO date string
              const hist = tank.historicalVolume?.find(h => toISODate(h.date) === saleDateStr);
              if (hist) {
                openingSum += hist.openingVolume;
                closingSum += hist.closingVolume;
              }
            });

            const draw = openingSum - closingSum;
            return {
              grade: s.grade,
              salesVolume: s.volume || 0,
              physicalDraw: draw,
              variance: (s.volume || 0) - draw
            };
          })
        };
      });

    res.json(reconciliationData);
  } catch (err) {
    console.error("Reconciliation Error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/station/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const selectedDate = new Date(req.query.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compareDate = new Date(selectedDate);
    compareDate.setHours(0, 0, 0, 0);

    const isPast = compareDate < today;
    const isToday = compareDate.getTime() === today.getTime();
    const isFuture = compareDate > today;

    const [tanks, avgSales] = await Promise.all([
      FuelStationTank.find({ stationId }).lean(),
      getAverageSales(stationId, selectedDate)
    ]);

    // PIPELINE: Aggregate all tanks of the same grade into one "Grade Volume"
    let gradePipeline = {};

    if (isFuture || isToday) {
      // Initialize the pipeline with the sum of all tanks per grade for Today
      tanks.forEach(tank => {
        const todayHist = tank.historicalVolume?.find(h =>
          new Date(h.date).toDateString() === today.toDateString()
        );
        const startVol = todayHist?.openingVolume || tank.currentVolume || 0;
        gradePipeline[tank.grade] = (gradePipeline[tank.grade] || 0) + startVol;
      });

      // If looking at a future date, run the daily recursion
      if (isFuture) {
        let tempDate = new Date(today);
        while (tempDate < compareDate) {
          const dayAvg = await getAverageSales(stationId, tempDate);
          const dayOrders = await FuelOrder.find({
            station: stationId,
            estimatedDeliveryDate: {
              $gte: new Date(tempDate).setHours(0, 0, 0, 0),
              $lte: new Date(tempDate).setHours(23, 59, 59, 999)
            }
          }).lean();

          // Calculate for each grade across all its tanks
          Object.keys(gradePipeline).forEach(grade => {
            const dailyOrderVol = dayOrders.reduce((sum, order) => {
              const item = order.items.find(i => i.grade === grade);
              return sum + (item?.ltrs || 0);
            }, 0);

            const dailySales = dayAvg[grade] || 0;
            // Carrying the total grade volume forward
            gradePipeline[grade] = (gradePipeline[grade] + dailyOrderVol) - dailySales;
          });

          tempDate.setDate(tempDate.getDate() + 1);
        }
      }
    }

    // Fetch orders and actual sales for the target date
    const [orders, actualSalesRecord] = await Promise.all([
      FuelOrder.find({
        station: stationId,
        estimatedDeliveryDate: {
          $gte: new Date(compareDate).setHours(0, 0, 0, 0),
          $lte: new Date(compareDate).setHours(23, 59, 59, 999)
        }
      }).lean(),
      FuelSales.findOne({
        stationId,
        date: { $gte: compareDate, $lte: new Date(compareDate).setHours(23, 59, 59, 999) }
      }).lean()
    ]);

    const enrichedTanks = tanks.map(tank => {
      let openingL = 0;
      let estSalesL = 0;
      let currentSalesL = 0;
      let closingL = 0;

      // Sales are usually grade-based, so we split them across tanks of the same grade
      // (Assuming equal draw or just for display purposes)
      const tanksOfSameGrade = tanks.filter(t => t.grade === tank.grade).length;
      const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

      const gradeOrders = orders.reduce((sum, order) => {
        const item = order.items.find(i => i.grade === tank.grade);
        return sum + (item?.ltrs || 0);
      }, 0);

      if (isPast || isToday) {
        const hist = tank.historicalVolume?.find(h =>
          new Date(h.date).toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0]
        );
        openingL = hist?.openingVolume || 0;

        if (isPast) {
          // Show actual historical sales split by tank
          estSalesL = (salesEntry?.volume || 0) / tanksOfSameGrade;
          closingL = hist?.closingVolume || 0;
        } else {
          estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
          currentSalesL = (actualSalesRecord?.isLive) ? (salesEntry?.volume || 0) / tanksOfSameGrade : 0;
          closingL = (openingL + gradeOrders) - estSalesL;
        }
      }
      // else if (isFuture) {
      //   // FUTURE: Use the recursive pipeline total divided by number of tanks
      //   openingL = (gradePipeline[tank.grade] || 0) / tanksOfSameGrade;
      //   estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
      //   closingL = (openingL + gradeOrders) - estSalesL;
      // }
      else if (isFuture) {
        // FIX: Instead of giving the WHOLE pipeline volume to each tank,
        // divide it by the number of tanks so the frontend SUM is correct.

        const totalGradeVolume = (gradePipeline[tank.grade] || 0);

        // Calculate the Opening, Sales, and Closing for the WHOLE grade first
        const totalOpening = totalGradeVolume;
        const totalSales = (avgSales[tank.grade] || 0);
        const totalClosing = (totalOpening + gradeOrders) - totalSales;

        // Split them equally across the tanks
        openingL = totalOpening / tanksOfSameGrade;
        estSalesL = totalSales / tanksOfSameGrade;
        closingL = totalClosing / tanksOfSameGrade;
      }
      return {
        ...tank,
        openingL: Math.round(openingL),
        estSalesL: Math.round(estSalesL),
        currentSalesL: Math.round(currentSalesL),
        closingL: Math.round(closingL)
      };
    });

    // res.json(enrichedTanks);
    res.json({
      tanks: enrichedTanks,
      // Add this metadata to the top level of the response
      lastTransaction: actualSalesRecord?.lastTransactionAt || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/fuel-station-tanks/sync-all-volumes
router.get('/sync-all-volumes', async (req, res) => {
  try {
    const liveReadings = await getLiveTankVolumes();
    // Populate stationId to access stationName and csoCode
    const allTanks = await FuelStationTank.find({}).populate('stationId');

    const updatePromises = allTanks.map(async (tank) => {
      const reading = liveReadings.find(r =>
        r.Station_SK === tank.stationId?.csoCode &&
        Number(r.Tank_No) === tank.tankNo
      );

      let updatedDoc = tank;
      if (reading) {
        updatedDoc = await FuelStationTank.findByIdAndUpdate(tank._id, {
          currentVolume: Math.round(reading.Volume),
          lastUpdatedVolumeReadingDateTime: reading.ReadingTime
        }, { new: true }).populate('stationId'); // Re-populate for the response
      }

      // Return a flattened object so stationName is at the top level
      return {
        ...updatedDoc.toObject(),
        stationName: updatedDoc.stationId?.stationName || "Unknown"
      };
    });

    const results = await Promise.all(updatePromises);
    res.json(results);
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