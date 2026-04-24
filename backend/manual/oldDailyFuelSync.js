const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Location = require('../models/Location');
const FuelStationTank = require('../models/fuel/FuelStationTank');
const FuelSales = require('../models/fuel/FuelSales');
const FuelSalesArchived = require('../models/fuel/FuelSalesArchived');
const FuelStationTankArchived = require('../models/fuel/FuelStationTankArchived');
const { getTankReadingsForDate, getProcessedFuelSales } = require('../services/supaBaseService');

const runDailyFuelSync = async () => {
  console.log('--- 🕒 [START] Daily Fuel Sync & Archive Automation (5:00 AM) ---');

  const locations = await Location.find({ type: 'store' });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const loc of locations) {
    try {
      console.log(`\n📍 Processing Station: ${loc.stationName} [${loc.csoCode || 'NO_CSO'}]`);

      // --- STEP 1: SALES SYNC & ARCHIVE ---
      if (loc.csoCode) {
        console.log(`   [Sales] Fetching finalized sales for ${yesterdayStr}...`);
        const { salesData } = await getProcessedFuelSales(loc.csoCode, yesterdayStr);

        await FuelSales.findOneAndUpdate(
          { stationId: loc._id, date: yesterday },
          {
            salesData,
            dayOfWeek: dayNames[yesterday.getDay()],
            isLive: false,
            lastFetchedAt: null,
            lastTransactionAt: null
          },
          { upsert: true }
        );

        // Check for Archive (Keep 40 days)
        const salesCount = await FuelSales.countDocuments({ stationId: loc._id });
        if (salesCount > 40) {
          const moveCount = salesCount - 40;
          const oldestSales = await FuelSales.find({ stationId: loc._id }).sort({ date: 1 }).limit(moveCount);

          if (oldestSales.length > 0) {
            await FuelSalesArchived.insertMany(oldestSales);
            const idsToDelete = oldestSales.map(s => s._id);
            await FuelSales.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`   📦 [Archive] Moved ${oldestSales.length} old Sales records to Archived collection.`);
          }
        }
      }

      // --- STEP 2: TANK SYNC & ARCHIVE ---
      const tanks = await FuelStationTank.find({ stationId: loc._id });
      console.log(`   [Tanks] Processing ${tanks.length} tanks...`);

      for (const tank of tanks) {
        const { openingVolume: todayOpen, openingTime: todayOpenTime } = await getTankReadingsForDate(loc.csoCode, tank.tankNo, todayStr);
        const { closingVolume: yesterdayClose } = await getTankReadingsForDate(loc.csoCode, tank.tankNo, yesterdayStr);

        const tankDoc = await FuelStationTank.findById(tank._id);
        if (!tankDoc) continue;

        // --- Logic for Yesterday ---
        const yIdx = tankDoc.historicalVolume.findIndex(h => h.date.toISOString().split('T')[0] === yesterdayStr);
        if (yIdx > -1) {
          tankDoc.historicalVolume[yIdx].closingVolume = yesterdayClose;
          // Lookback Fallback
          if (!tankDoc.historicalVolume[yIdx].openingVolume || tankDoc.historicalVolume[yIdx].openingVolume === 0) {
            const prev = tankDoc.historicalVolume[yIdx - 1];
            if (prev) tankDoc.historicalVolume[yIdx].openingVolume = prev.closingVolume;
          }
        } else {
          const lastEntry = tankDoc.historicalVolume[tankDoc.historicalVolume.length - 1];
          tankDoc.historicalVolume.push({
            date: yesterday,
            openingVolume: lastEntry ? lastEntry.closingVolume : 0,
            closingVolume: yesterdayClose
          });
        }

        // --- Logic for Today ---
        const tIdx = tankDoc.historicalVolume.findIndex(h => h.date.toISOString().split('T')[0] === todayStr);
        if (tIdx === -1) {
          tankDoc.historicalVolume.push({ date: today, openingVolume: todayOpen, closingVolume: 0 });
        } else {
          tankDoc.historicalVolume[tIdx].openingVolume = todayOpen;
        }

        // --- Tank Historical Archive (Keep 40 days) ---
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
          console.log(`   📦 [Archive] Moved ${toArchive.length} entries for Tank ${tank.tankNo} to Archive.`);
        }

        tankDoc.currentVolume = todayOpen;
        // tankDoc.lastUpdatedVolumeReadingDateTime = new Date();
        tankDoc.lastUpdatedVolumeReadingDateTime = todayOpenTime;
        tankDoc.historicalVolume.sort((a, b) => a.date - b.date);
        await tankDoc.save();
      }

      console.log(`   ✅ Station ${loc.stationName} Complete.`);
    } catch (err) {
      console.error(`   ❌ [ERROR] Station ${loc.stationName}:`, err.message);
    }
  }
  console.log('\n--- ✅ [FINISH] Daily Fuel Sync & Archive Completed Successfully ---');
};

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('Starting Fuel sync...');
    await runDailyFuelSync();
  } catch (err) {
    hadError = true;
    console.error('Sync failed:', err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run, runDailyFuelSync };
