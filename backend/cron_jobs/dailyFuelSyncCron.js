const cron = require("node-cron");
const moment = require('moment-timezone');
const Location = require('../models/Location');
const FuelStationTank = require('../models/fuel/FuelStationTank');
const FuelSales = require('../models/fuel/FuelSales');
const FuelSalesArchived = require('../models/fuel/FuelSalesArchived');
const FuelStationTankArchived = require('../models/fuel/FuelStationTankArchived');
const { getTankReadingsForCron, getProcessedFuelSales } = require('../services/supaBaseService');

const runSmartSync = async (targetStationId = null, retryAttempt = 1) => {
  console.log(`--- 🕒 [START] Smart Fuel Sync (Attempt ${retryAttempt}) ---`);

  const query = targetStationId ? { _id: targetStationId } : { type: 'store' };
  const locations = await Location.find(query);

  // Consistency: Day names for the database
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const loc of locations) {
    try {
      const tz = loc.timezone || 'America/Toronto';
      const stationNow = moment.tz(tz);

      // 1. String formats for Supabase queries
      const yesterdayStr = stationNow.clone().subtract(1, 'day').format('YYYY-MM-DD');
      const todayStr = stationNow.format('YYYY-MM-DD');

      // 2. Database Date Objects (Midnight UTC consistency)
      // This matches your existing 00:00:00.000Z format
      const yesterdayDate = new Date(yesterdayStr + 'T00:00:00.000Z');
      const todayDate = new Date(todayStr + 'T00:00:00.000Z');

      console.log(`\n📍 [${loc.stationName}] Local Time: ${stationNow.format('HH:mm')} | Processing: ${yesterdayStr}`);

      // --- STEP 1: SALES SYNC ---
      if (loc.csoCode) {
        // Check if finalized sales already exist
        const existingSales = await FuelSales.findOne({
          stationId: loc._id,
          date: yesterdayDate,
          isLive: false
        });

        // Only fetch if missing, or if we are retrying (to catch late data)
        if (!existingSales || retryAttempt > 1) {
          const { salesData } = await getProcessedFuelSales(loc.csoCode, yesterdayStr);

          if (salesData && salesData.length > 0) {
            await FuelSales.findOneAndUpdate(
              { stationId: loc._id, date: yesterdayDate },
              {
                salesData,
                // FIX: Calculate day of week from the station's yesterday
                dayOfWeek: dayNames[stationNow.clone().subtract(1, 'day').day()],
                isLive: false,
                lastFetchedAt: null,
                lastTransactionAt: null // Matches your existing reset logic
              },
              { upsert: true }
            );
            console.log(`   ✅ Sales Synced for ${yesterdayStr}`);
          }
        }
      }

      // --- STEP 2: TANK SYNC ---
      const tanks = await FuelStationTank.find({ stationId: loc._id });
      for (const tank of tanks) {
        // Fetch from Supabase using the two-date logic (Yesterday's close, Today's open)
        const { openingVolume: todayOpen, openingTime: todayOpenTime, closingVolume: yesterdayClose } =
          await getTankReadingsForCron(loc.csoCode, tank.tankNo, yesterdayStr, todayStr);

        // Validation: If data is missing (0), skip update on early retries to try again later
        if (todayOpen === 0 && retryAttempt < 3) {
          console.log(`   ⚠️ Tank ${tank.tankNo} opening is 0. Skipping for next retry window.`);
          continue;
        }

        const tankDoc = await FuelStationTank.findById(tank._id);
        if (!tankDoc) continue;

        // --- Historical Volume Logic (Yesterday) ---
        const yIdx = tankDoc.historicalVolume.findIndex(h =>
          h.date.toISOString().split('T')[0] === yesterdayStr
        );

        if (yIdx > -1) {
          tankDoc.historicalVolume[yIdx].closingVolume = yesterdayClose;
          // Fallback opening volume if missing
          if (!tankDoc.historicalVolume[yIdx].openingVolume || tankDoc.historicalVolume[yIdx].openingVolume === 0) {
            const prev = tankDoc.historicalVolume[yIdx - 1];
            if (prev) tankDoc.historicalVolume[yIdx].openingVolume = prev.closingVolume;
          }
        } else {
          const lastEntry = tankDoc.historicalVolume[tankDoc.historicalVolume.length - 1];
          tankDoc.historicalVolume.push({
            date: yesterdayDate,
            openingVolume: lastEntry ? lastEntry.closingVolume : 0,
            closingVolume: yesterdayClose
          });
        }

        // --- Historical Volume Logic (Today) ---
        const tIdx = tankDoc.historicalVolume.findIndex(h =>
          h.date.toISOString().split('T')[0] === todayStr
        );

        if (tIdx === -1) {
          tankDoc.historicalVolume.push({
            date: todayDate,
            openingVolume: todayOpen,
            closingVolume: 0
          });
        } else {
          tankDoc.historicalVolume[tIdx].openingVolume = todayOpen;
        }

        // --- Archive logic (Keep 40 days) ---
        if (tankDoc.historicalVolume.length > 40) {
          const toArchive = tankDoc.historicalVolume.slice(0, tankDoc.historicalVolume.length - 40);
          await FuelStationTankArchived.findOneAndUpdate(
            { stationId: loc._id, tankNo: tank.tankNo },
            {
              $push: { historicalVolume: { $each: toArchive } },
              $set: { grade: tank.grade, tankCapacity: tank.tankCapacity }
            },
            { upsert: true }
          );
          tankDoc.historicalVolume = tankDoc.historicalVolume.slice(-40);
        }

        // Finalize Tank Status
        tankDoc.currentVolume = todayOpen;
        tankDoc.lastUpdatedVolumeReadingDateTime = todayOpenTime;
        tankDoc.historicalVolume.sort((a, b) => a.date - b.date);
        await tankDoc.save();
      }

      // --- STEP 3: SALES ARCHIVING ---
      const salesCount = await FuelSales.countDocuments({ stationId: loc._id });
      if (salesCount > 40) {
        const moveCount = salesCount - 40;
        const oldestSales = await FuelSales.find({ stationId: loc._id }).sort({ date: 1 }).limit(moveCount);

        if (oldestSales.length > 0) {
          await FuelSalesArchived.insertMany(oldestSales);
          const idsToDelete = oldestSales.map(s => s._id);
          await FuelSales.deleteMany({ _id: { $in: idsToDelete } });
          console.log(`   📦 [Archive] Moved ${oldestSales.length} Sales records to Archive.`);
        }
      }

    } catch (err) {
      console.error(`   ❌ [ERROR] ${loc.stationName}:`, err.message);
    }
  }
};

// This cron runs every hour at the 10th minute 
// between 10 PM (22) and 8 AM (08) Toronto time.
// Pattern: '10 22,23,0,1,2,3,4,5,6,7,8 * * *'
cron.schedule('10 22,23,0,1,2,3,4,5,6,7,8 * * *', async () => {
  console.log(`--- 🛰️ [Master Watcher] Checking local station windows at ${new Date().toISOString()} ---`);

  const locations = await Location.find({ type: 'store' });

  for (const loc of locations) {
    const tz = loc.timezone || 'America/Toronto';
    const localTime = moment.tz(tz);
    const hour = localTime.hour();
    const minutes = localTime.minutes();

    // Primary Sync (12:10 AM)
    if (hour === 0) {
      console.log(`🚀 Primary Sync window for ${loc.stationName}`);
      runSmartSync(loc._id, 1);
    }
    // First Retry (02:10 AM)
    else if (hour === 2) {
      console.log(`🔄 Retry 1 window for ${loc.stationName}`);
      runSmartSync(loc._id, 2);
    }
    // Final Retry (04:10 AM)
    else if (hour === 4) {
      console.log(`🔄 Final Retry window for ${loc.stationName}`);
      runSmartSync(loc._id, 3);
    }
  }
}, {
  scheduled: true,
  timezone: "America/Toronto"
});

module.exports = { runSmartSync };