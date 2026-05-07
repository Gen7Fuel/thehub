require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Payable = require('../models/Payables');

const DRY_RUN = true; // Set to false to commit changes

async function run() {
  await connectDB();

  const payables = await Payable.find({ date: { $exists: false } })
    .populate('location', 'timezone')
    .lean();

  console.log(`--- 🚀 Starting backfill [Dry Run: ${DRY_RUN}] ---`);
  console.log(`Found ${payables.length} payables without a date field`);

  let updated = 0;
  for (const p of payables) {
    const tz = p.location?.timezone || 'America/Toronto';
    // en-CA locale produces "yyyy-mm-dd" format natively
    const localDate = new Date(p.createdAt).toLocaleDateString('en-CA', { timeZone: tz });

    if (DRY_RUN) {
      console.log(`[DRY RUN] ${p._id} createdAt=${p.createdAt.toISOString()} tz=${tz} → date: ${localDate}`);
    } else {
      await Payable.updateOne({ _id: p._id }, { $set: { date: localDate } });
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
