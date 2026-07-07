require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Transaction = require('../models/Transactions');
const Location = require('../models/Location');

const DRY_RUN = false; // Set to false to commit changes

async function run() {
  await connectDB();

  const orders = await Transaction.find({ source: 'PO', dateStr: { $exists: false } })
    .select('_id date stationName')
    .lean();

  const stationNames = [...new Set(orders.map(o => o.stationName).filter(Boolean))];
  const locations = await Location.find({ stationName: { $in: stationNames } })
    .select('stationName timezone')
    .lean();
  const timezoneByStation = Object.fromEntries(locations.map(l => [l.stationName, l.timezone]));

  console.log(`--- 🚀 Starting PO backfill [Dry Run: ${DRY_RUN}] ---`);
  console.log(`Found ${orders.length} PO transactions without a dateStr field`);

  let updated = 0;
  for (const o of orders) {
    const tz = timezoneByStation[o.stationName] || 'America/Toronto';
    // en-CA locale produces "yyyy-mm-dd" format natively
    const dateStr = new Date(o.date).toLocaleDateString('en-CA', { timeZone: tz });

    if (DRY_RUN) {
      console.log(`[DRY RUN] ${o._id} date=${o.date.toISOString()} station=${o.stationName} tz=${tz} → dateStr: ${dateStr}`);
    } else {
      await Transaction.updateOne({ _id: o._id }, { $set: { dateStr } });
      updated++;
    }
  }

  if (DRY_RUN) {
    console.log('--- DRY RUN complete — set DRY_RUN=false to commit ---');
  } else {
    console.log(`--- ✅ Updated ${updated} documents ---`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
