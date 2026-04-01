const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Location = require('../models/Location');
const FuelStationTank = require('../models/Fuel/FuelStationTank');
const FuelSales = require('../models/Fuel/FuelSales');
const { getTankReadingsForDate, getProcessedFuelSales } = require('../services/supaBaseService');
// Helper to format date as YYYY-MM-DD
const formatDate = (date) => date.toISOString().split('T')[0];

// Helper to add days
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Helper to check if date1 is before date2 (ignoring time)
const isBeforeOrEqual = (date1, date2) => {
  const d1 = new Date(date1).setHours(0, 0, 0, 0);
  const d2 = new Date(date2).setHours(0, 0, 0, 0);
  return d1 <= d2;
};

async function syncHistoricalDips() {
  console.log('--- Starting Historical Dip Sync ---');

  const tanks = await FuelStationTank.find().populate('stationId');

  const startDate = new Date('2026-03-23T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const tank of tanks) {
    const station = tank.stationId;
    if (!station?.csoCode) continue;

    console.log(`Processing: ${station.stationName} (Tank ${tank.tankNo})`);

    let currentDate = new Date(startDate);
    const historicalUpdates = [];

    // Loop from March 23rd to Today
    while (isBeforeOrEqual(currentDate, today)) {
      const dateStr = formatDate(currentDate);

      try {
        const { openingVolume, closingVolume } = await getTankReadingsForDate(
          station.csoCode,
          tank.tankNo,
          dateStr
        );

        if (openingVolume > 0 || closingVolume > 0) {
          historicalUpdates.push({
            date: new Date(currentDate),
            openingVolume: Number(openingVolume),
            closingVolume: Number(closingVolume)
          });
        }
      } catch (err) {
        console.error(`Error on ${dateStr}:`, err.message);
      }

      currentDate = addDays(currentDate, 1);
    }

    if (historicalUpdates.length > 0) {
      await FuelStationTank.updateOne(
        { _id: tank._id },
        { $set: { historicalVolume: historicalUpdates } }
      );
      console.log(`✅ Updated ${historicalUpdates.length} days for Tank ${tank.tankNo}`);
    }
  }
  console.log('--- Sync Completed ---');
}

async function syncFuelSales() {
  console.log('🚀 Starting Fuel Sales Sync (From March 9th)...');

  // Fetch only active fuel stations
  const locations = await Location.find({ type: 'store' });
  const startDate = new Date('2026-03-09T00:00:00');
  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const loc of locations) {
    if (!loc.csoCode) {
      console.warn(`⚠️ Skipping ${loc.stationName}: Missing CSO Code`);
      continue;
    }

    console.log(`\n📍 Processing: ${loc.stationName} [${loc.csoCode}]`);
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= today) {
      const dateStr = formatDate(currentDate);

      try {
        // CALL THE REUSABLE SERVICE
        const salesData = await getProcessedFuelSales(loc.csoCode, dateStr);

        if (salesData.length > 0) {
          await FuelSales.findOneAndUpdate(
            { 
              stationId: loc._id, 
              date: new Date(currentDate).setHours(0,0,0,0) 
            },
            { 
              salesData, 
              dayOfWeek: dayNames[currentDate.getDay()],
              isLive: dateStr === formatDate(today) 
            },
            { upsert: true }
          );
          process.stdout.write(`.`); // Small progress indicator
        }
      } catch (err) {
        console.error(`\n❌ Error on ${dateStr}:`, err.message);
      }
      currentDate = addDays(currentDate, 1);
    }
  }
  console.log('\n✅ Sales Sync Completed Successfully.');
}

async function run() {
  let hadError = false;
  try {
    // Ensure your DB connection logic is imported or defined here
    await connectDB();
    await syncHistoricalDips();
    await syncFuelSales();
  } catch (err) {
    hadError = true;
    console.error('Historical Sync failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();