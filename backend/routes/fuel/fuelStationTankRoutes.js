const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Location = require('../../models/Location');
const FuelStationTank = require('../../models/fuel/FuelStationTank');
const FuelSales = require('../../models/fuel/FuelSales');
const FuelOrder = require('../../models/fuel/FuelOrder');
const { getLiveTankVolumes } = require('../../services/supaBaseService');
const { subDays, format } = require('date-fns');
const { moment } = require('moment-timezone');


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

// This route will filter in manage configuration to show all stations without any filter
router.get('/stations', async (req, res) => {
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
    });

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

  Object.keys(gradeVolumes).forEach(grade => {
    let volumes = gradeVolumes[grade];

    if (volumes.length > 2) { // Need at least 3 points to detect an outlier effectively
      volumes = volumes.filter((val, index, self) => {
        const others = self.filter((_, i) => i !== index);
        const avgOfOthers = others.reduce((a, b) => a + b, 0) / others.length;

        const isTooLow = val < (avgOfOthers * 0.5);   // 50% below average
        const isTooHigh = val > (avgOfOthers * 1.5);  // 50% above average

        return !isTooLow && !isTooHigh;
      });
    }

    if (volumes.length > 0) {
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
        const startVol = todayHist?.openingVolume || 0;
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

    // ENRICHMENT LOGIC (Now outside the if-block so Past dates work)
    const enrichedTanks = tanks.map(tank => {
      let openingL = 0;
      let estSalesL = 0;
      let currentSalesL = 0;
      let closingL = 0;

      const tanksOfSameGrade = tanks.filter(t => t.grade === tank.grade).length || 1;
      const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

      const totalGradeOrders = orders.reduce((sum, order) => {
        const item = order.items.find(i => i.grade === tank.grade);
        return sum + (item?.ltrs || 0);
      }, 0);

      const splitOrders = totalGradeOrders / tanksOfSameGrade;

      if (isPast || isToday) {
        const hist = tank.historicalVolume?.find(h =>
          new Date(h.date).toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0]
        );

        openingL = hist?.openingVolume || 0;

        if (isPast) {
          estSalesL = (salesEntry?.volume || 0) / tanksOfSameGrade;
          closingL = hist?.closingVolume || 0;
        } else {
          // TODAY logic
          estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
          currentSalesL = (actualSalesRecord?.isLive) ? (salesEntry?.volume || 0) / tanksOfSameGrade : 0;
          closingL = (openingL + splitOrders) - estSalesL;
        }
      }
      else if (isFuture) {
        const totalGradeVolume = (gradePipeline[tank.grade] || 0);
        const totalSales = (avgSales[tank.grade] || 0);

        openingL = totalGradeVolume / tanksOfSameGrade;
        estSalesL = totalSales / tanksOfSameGrade;
        closingL = (openingL + splitOrders) - estSalesL;
      }

      return {
        ...tank,
        openingL: Math.round(openingL),
        estSalesL: Math.round(estSalesL),
        currentSalesL: Math.round(currentSalesL),
        closingL: Math.round(closingL),
        orderL: Math.round(splitOrders)
      };
    });

    res.json({
      tanks: enrichedTanks,
      lastTransaction: actualSalesRecord?.lastTransactionAt || null
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// router.get('/station/:stationId', async (req, res) => {
//   try {
//     // const { stationId } = req.params;
//     // const selectedDate = new Date(req.query.date);
//     // const today = new Date();
//     // today.setHours(0, 0, 0, 0);

//     // const compareDate = new Date(selectedDate);
//     // compareDate.setHours(0, 0, 0, 0);

//     // const isPast = compareDate < today;
//     // const isToday = compareDate.getTime() === today.getTime();
//     // const isFuture = compareDate > today;
//     const { stationId } = req.params;
//     const { date: dateStr } = req.query; // e.g., "2026-04-22"

//     const location = await Location.findById(stationId).lean();
//     const tz = location.timezone || 'America/Toronto';

//     // "Today" relative to the station's location
//     const stationNow = moment().tz(tz).startOf('day');
//     const compareDate = moment.tz(dateStr, tz).startOf('day');

//     const isPast = compareDate.isBefore(stationNow);
//     const isToday = compareDate.isSame(stationNow);
//     const isFuture = compareDate.isAfter(stationNow);

//     // Normalize start/end for queries
//     const startOfDay = compareDate.clone().startOf('day').toDate();
//     const endOfDay = compareDate.clone().endOf('day').toDate();

//     // const [tanks, avgSales] = await Promise.all([
//     //   FuelStationTank.find({ stationId }).lean(),
//     //   getAverageSales(stationId, selectedDate)
//     // ]);

//     const [tanks, avgSales] = await Promise.all([
//       FuelStationTank.find({ stationId }).lean(),
//       getAverageSales(stationId, compareDate.toDate()) // Use the moment object
//     ]);

//     // PIPELINE: Aggregate all tanks of the same grade into one "Grade Volume"
//     let gradePipeline = {};

//     if (isFuture || isToday) {
//       // Initialize the pipeline with the sum of all tanks per grade for Today
//       tanks.forEach(tank => {
//         // const todayHist = tank.historicalVolume?.find(h =>
//         //   new Date(h.date).toDateString() === today.toDateString()
//         // );
//         const todayHist = tank.historicalVolume?.find(h =>
//           moment(h.date).tz(tz).format('YYYY-MM-DD') === dateStr
//         );
//         const startVol = todayHist?.openingVolume || 0;
//         gradePipeline[tank.grade] = (gradePipeline[tank.grade] || 0) + startVol;
//       });

//       // If looking at a future date, run the daily recursion
//       if (isFuture) {
//         let tempDate = new Date(today);
//         while (tempDate < compareDate) {
//           const dayAvg = await getAverageSales(stationId, tempDate);
//           const dayOrders = await FuelOrder.find({
//             station: stationId,
//             estimatedDeliveryDate: {
//               $gte: new Date(tempDate).setHours(0, 0, 0, 0),
//               $lte: new Date(tempDate).setHours(23, 59, 59, 999)
//             }
//           }).lean();

//           // Calculate for each grade across all its tanks
//           Object.keys(gradePipeline).forEach(grade => {
//             const dailyOrderVol = dayOrders.reduce((sum, order) => {
//               const item = order.items.find(i => i.grade === grade);
//               return sum + (item?.ltrs || 0);
//             }, 0);

//             const dailySales = dayAvg[grade] || 0;
//             // Carrying the total grade volume forward
//             gradePipeline[grade] = (gradePipeline[grade] + dailyOrderVol) - dailySales;
//           });

//           tempDate.setDate(tempDate.getDate() + 1);
//         }
//       }
//     }

//     // Fetch orders and actual sales for the target date
//     const [orders, actualSalesRecord] = await Promise.all([
//       FuelOrder.find({
//         station: stationId,
//         estimatedDeliveryDate: { $gte: startOfDay, $lte: endOfDay }
//       }).lean(),
//       FuelSales.findOne({
//         stationId,
//         date: { $gte: startOfDay, $lte: endOfDay }
//       }).lean()
//     ]);

//     // const enrichedTanks = tanks.map(tank => {
//     //   let openingL = 0;
//     //   let estSalesL = 0;
//     //   let currentSalesL = 0;
//     //   let closingL = 0;

//     //   // Sales are usually grade-based, so we split them across tanks of the same grade
//     //   // (Assuming equal draw or just for display purposes)
//     //   const tanksOfSameGrade = tanks.filter(t => t.grade === tank.grade).length;
//     //   const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

//     //   const gradeOrders = orders.reduce((sum, order) => {
//     //     const item = order.items.find(i => i.grade === tank.grade);
//     //     return sum + (item?.ltrs || 0);
//     //   }, 0);

//     //   if (isPast || isToday) {
//     //     const hist = tank.historicalVolume?.find(h =>
//     //       new Date(h.date).toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0]
//     //     );
//     //     openingL = hist?.openingVolume || 0;

//     //     if (isPast) {
//     //       // Show actual historical sales split by tank
//     //       estSalesL = (salesEntry?.volume || 0) / tanksOfSameGrade;
//     //       closingL = hist?.closingVolume || 0;
//     //     } else {
//     //       estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
//     //       currentSalesL = (actualSalesRecord?.isLive) ? (salesEntry?.volume || 0) / tanksOfSameGrade : 0;
//     //       closingL = (openingL + gradeOrders) - estSalesL;
//     //     }
//     //   }
//     //   // else if (isFuture) {
//     //   //   // FUTURE: Use the recursive pipeline total divided by number of tanks
//     //   //   openingL = (gradePipeline[tank.grade] || 0) / tanksOfSameGrade;
//     //   //   estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
//     //   //   closingL = (openingL + gradeOrders) - estSalesL;
//     //   // }
//     //   else if (isFuture) {
//     //     // FIX: Instead of giving the WHOLE pipeline volume to each tank,
//     //     // divide it by the number of tanks so the frontend SUM is correct.

//     //     const totalGradeVolume = (gradePipeline[tank.grade] || 0);

//     //     // Calculate the Opening, Sales, and Closing for the WHOLE grade first
//     //     const totalOpening = totalGradeVolume;
//     //     const totalSales = (avgSales[tank.grade] || 0);
//     //     const totalClosing = (totalOpening + gradeOrders) - totalSales;

//     //     // Split them equally across the tanks
//     //     openingL = totalOpening / tanksOfSameGrade;
//     //     estSalesL = totalSales / tanksOfSameGrade;
//     //     closingL = totalClosing / tanksOfSameGrade;
//     //   }
//     //   return {
//     //     ...tank,
//     //     openingL: Math.round(openingL),
//     //     estSalesL: Math.round(estSalesL),
//     //     currentSalesL: Math.round(currentSalesL),
//     //     closingL: Math.round(closingL)
//     //   };
//     // });
//     const enrichedTanks = tanks.map(tank => {
//       let openingL = 0;
//       let estSalesL = 0;
//       let currentSalesL = 0;
//       let closingL = 0;

//       const tanksOfSameGrade = tanks.filter(t => t.grade === tank.grade).length;
//       const salesEntry = actualSalesRecord?.salesData?.find(s => s.grade === tank.grade);

//       // Total volume ordered for this specific grade today
//       const totalGradeOrders = orders.reduce((sum, order) => {
//         const item = order.items.find(i => i.grade === tank.grade);
//         return sum + (item?.ltrs || 0);
//       }, 0);

//       // DIVIDE the orders by number of tanks so the frontend sum is correct
//       const splitOrders = totalGradeOrders / tanksOfSameGrade;

//       if (isPast || isToday) {
//         // const hist = tank.historicalVolume?.find(h =>
//         //   new Date(h.date).toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0]
//         // );
//         // Replace the .find inside enrichedTanks:
//         const hist = tank.historicalVolume?.find(h =>
//           moment(h.date).tz(tz).format('YYYY-MM-DD') === dateStr
//         );

//         openingL = hist?.openingVolume || 0;

//         if (isPast) {
//           estSalesL = (salesEntry?.volume || 0) / tanksOfSameGrade;
//           closingL = hist?.closingVolume || 0;
//         } else {
//           // TODAY logic
//           estSalesL = (avgSales[tank.grade] || 0) / tanksOfSameGrade;
//           currentSalesL = (actualSalesRecord?.isLive) ? (salesEntry?.volume || 0) / tanksOfSameGrade : 0;

//           // FIX: Ensure closing volume includes the split orders
//           closingL = (openingL + splitOrders) - estSalesL;
//         }
//       }
//       else if (isFuture) {
//         const totalGradeVolume = (gradePipeline[tank.grade] || 0);
//         const totalSales = (avgSales[tank.grade] || 0);

//         // Split everything equally
//         openingL = totalGradeVolume / tanksOfSameGrade;
//         estSalesL = totalSales / tanksOfSameGrade;
//         // Closing = (Grade Opening / n + Grade Orders / n) - (Grade Sales / n)
//         closingL = (openingL + splitOrders) - estSalesL;
//       }

//       return {
//         ...tank,
//         openingL: Math.round(openingL),
//         estSalesL: Math.round(estSalesL),
//         currentSalesL: Math.round(currentSalesL),
//         closingL: Math.round(closingL),
//         orderL: Math.round(splitOrders) // Adding this helps debugging on frontend
//       };
//     });

//     // res.json(enrichedTanks);
//     res.json({
//       tanks: enrichedTanks,
//       // Add this metadata to the top level of the response
//       lastTransaction: actualSalesRecord?.lastTransactionAt || null
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// GET /api/fuel-station-tanks/sync-all-volumes
// router.get('/sync-all-volumes', async (req, res) => {
//   try {
//     const liveReadings = await getLiveTankVolumes();
//     // Populate stationId to access stationName and csoCode
//     const allTanks = await FuelStationTank.find({}).populate('stationId');

//     const updatePromises = allTanks.map(async (tank) => {
//       const reading = liveReadings.find(r =>
//         r.Station_SK === tank.stationId?.csoCode &&
//         Number(r.Tank_No) === tank.tankNo
//       );

//       let updatedDoc = tank;
//       if (reading) {
//         updatedDoc = await FuelStationTank.findByIdAndUpdate(tank._id, {
//           currentVolume: Math.round(reading.Volume),
//           lastUpdatedVolumeReadingDateTime: reading.ReadingTime
//         }, { new: true }).populate('stationId'); // Re-populate for the response
//       }

//       // Return a flattened object so stationName is at the top level
//       return {
//         ...updatedDoc.toObject(),
//         stationName: updatedDoc.stationId?.stationName || "Unknown"
//       };
//     });

//     const results = await Promise.all(updatePromises);
//     res.json(results);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// router.get('/sync-all-volumes', async (req, res) => {
//   try {
//     const liveReadings = await getLiveTankVolumes();
//     const allTanks = await FuelStationTank.find({}).populate('stationId');

//     const updatePromises = allTanks.map(async (tank) => {
//       const reading = liveReadings.find(r =>
//         r.Station_SK === tank.stationId?.csoCode &&
//         Number(r.Tank_No) === tank.tankNo
//       );

//       let statusString = "No latest reading available";
//       let currentVolume = tank.currentVolume;

//       if (reading) {
//         // 1. Get current date at the station's timezone
//         const stationTimezone = tank.stationId?.timezone || 'UTC';
//         const nowAtStation = new Intl.DateTimeFormat('en-CA', {
//           timeZone: stationTimezone,
//           year: 'numeric', month: '2-digit', day: '2-digit'
//         }).format(new Date()); // Returns YYYY-MM-DD

//         const yesterdayAtStation = format(subDays(new Date(nowAtStation), 1), 'yyyy-MM-dd');
//         const readingDateStr = reading.ReadingDate; // Already YYYY-MM-DD from Supabase

//         // 2. Logic Check
//         if (readingDateStr === nowAtStation) {
//           statusString = reading.ReadingTime; // Normal
//         } else if (readingDateStr === yesterdayAtStation) {
//           statusString = `${reading.ReadingTime} (Yesterday)`;
//         } else {
//           statusString = "No latest reading available";
//         }

//         currentVolume = Math.round(reading.Volume);
//       } else if (tank.lastUpdatedVolumeReadingDateTime?.includes("(Manual)")) {
//         // ATG failed, but check if we have a manual reading
//         // Format is "HH:mm YYYY-MM-DD (Manual)"
//         const parts = tank.lastUpdatedVolumeReadingDateTime.split(" ");
//         const manualDateStr = parts[1]; // Get YYYY-MM-DD

//         const stationTimezone = tank.stationId?.timezone || 'UTC';
//         const nowAtStation = new Intl.DateTimeFormat('en-CA', {
//           timeZone: stationTimezone,
//           year: 'numeric', month: '2-digit', day: '2-digit'
//         }).format(new Date());

//         const yesterdayAtStation = format(subDays(new Date(nowAtStation), 1), 'yyyy-MM-dd');

//         if (manualDateStr === nowAtStation) {
//           statusString = tank.lastUpdatedVolumeReadingDateTime; // Keep as is
//         } else if (manualDateStr === yesterdayAtStation) {
//           // Inject (Yesterday) before (Manual)
//           statusString = `${parts[0]} ${parts[1]} (Yesterday) (Manual)`;
//         } else {
//           statusString = "No latest reading available";
//         }
//       }

//       const updatedDoc = await FuelStationTank.findByIdAndUpdate(tank._id, {
//         currentVolume: currentVolume,
//         lastUpdatedVolumeReadingDateTime: statusString
//       }, { new: true }).populate('stationId');

//       return {
//         ...updatedDoc.toObject(),
//         stationName: updatedDoc.stationId?.stationName || "Unknown"
//       };
//     });

//     const results = await Promise.all(updatePromises);
//     res.json(results);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

router.get('/sync-all-volumes', async (req, res) => {
  try {
    const liveReadings = await getLiveTankVolumes();
    const allTanks = await FuelStationTank.find({}).populate('stationId');

    const updatePromises = allTanks.map(async (tank) => {
      const reading = liveReadings.find(r =>
        r.Station_SK === tank.stationId?.csoCode &&
        Number(r.Tank_No) === tank.tankNo
      );

      // Default state
      let statusString = "No latest reading available";
      let currentVolume = tank.currentVolume;

      // 1. Calculate Station Context
      const stationTimezone = tank.stationId?.timezone || 'UTC';
      const nowAtStation = new Intl.DateTimeFormat('en-CA', {
        timeZone: stationTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      const yesterdayAtStation = format(subDays(new Date(nowAtStation), 1), 'yyyy-MM-dd');

      // 2. Logic Check - Check Supabase Freshness
      const isSupabaseFresh = reading && (reading.ReadingDate === nowAtStation || reading.ReadingDate === yesterdayAtStation);

      if (isSupabaseFresh) {
        // PRIORITY 1: Supabase has current/yesterday data
        statusString = reading.ReadingDate === nowAtStation
          ? reading.ReadingTime
          : `${reading.ReadingTime} (Yesterday)`;
        currentVolume = Math.round(reading.Volume);
      } else if (tank.lastUpdatedVolumeReadingDateTime?.includes("(Manual)")) {
        // PRIORITY 2: Supabase is stale/missing, but we have a Manual reading record
        const parts = tank.lastUpdatedVolumeReadingDateTime.split(" ");
        const manualDateStr = parts[0]; // "2026-04-20"
        const manualTimeStr = parts[1]; // "14:30"

        if (manualDateStr === nowAtStation) {
          // It's from today - Keep the original manual string as is
          statusString = tank.lastUpdatedVolumeReadingDateTime;
        }
        else if (manualDateStr === yesterdayAtStation) {
          // It's from yesterday - Inject the (Yesterday) tag if not already present
          statusString = tank.lastUpdatedVolumeReadingDateTime.includes("(Yesterday)")
            ? tank.lastUpdatedVolumeReadingDateTime
            : `${manualDateStr} ${manualTimeStr} (Yesterday) (Manual)`;
        }
        else {
          // Too old
          statusString = "No latest reading available";
        }
      }
      else {
        statusString = "No latest reading available";
      }

      const updatedDoc = await FuelStationTank.findByIdAndUpdate(tank._id, {
        currentVolume: currentVolume,
        lastUpdatedVolumeReadingDateTime: statusString
      }, { new: true }).populate('stationId');

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

// for attempting manual override of current volume with a timestamp note in the UI during atg failure
router.patch('/manual-update/:tankId', async (req, res) => {
  try {
    const { volume, manualTime, manualDate } = req.body;

    // Combine strings: "YYYY-MM-DD HH:mm (Manual)"
    const statusString = `${manualDate} ${manualTime} (Manual)`;

    const updatedTank = await FuelStationTank.findByIdAndUpdate(
      req.params.tankId,
      {
        currentVolume: Number(volume),
        lastUpdatedVolumeReadingDateTime: statusString
      },
      { new: true }
    );

    res.json(updatedTank);
  } catch (err) {
    res.status(500).json({ message: err.message });
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