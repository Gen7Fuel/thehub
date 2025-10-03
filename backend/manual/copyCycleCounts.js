require('dotenv').config(); // If you use .env for DB connection
const mongoose = require('mongoose');
const CycleCount = require('../models/CycleCount');
const connectDB = require('../config/db'); // Adjust path if needed

async function main() {
  await connectDB(); // Connect to MongoDB

  const fromSite = 'Rankin'; // Change to your source site
  const toSite = 'Sarnia';   // Change to your target site

  // Find all entries for the source site
  const entries = await CycleCount.find({ site: fromSite }).lean();
  if (!entries.length) {
    console.log('No entries found for', fromSite);
    process.exit(0);
  }

  // Prepare new entries for the target site
  const newEntries = entries.map(({ _id, ...rest }) => ({
    ...rest,
    site: toSite,
  }));

  // Insert new entries
  const result = await CycleCount.insertMany(newEntries);
  console.log(`Copied ${result.length} entries from ${fromSite} to ${toSite}`);

  mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
});