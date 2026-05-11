/**
 * Migrate field names across collections:
 *   locations:      stationName → name
 *   users:          stationName → site
 *   transactions:   stationName → site
 *   statussales:    stationName → site
 *   shiftworksheets: location  → site
 *   vendors:        location   → site
 *   paypoints:      location   → site
 *   payables:       location   → site  (date field is intentionally left alone)
 *   fuelorders:     station    → site
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  // Already completed in previous run — skip:
  // locations, users, transactions, statussales, shiftworksheets

  // vendors: drop stale index before renaming so the unique constraint doesn't block $rename
  try {
    await db.collection('vendors').dropIndex('name_1_location_1');
    console.log('vendors: dropped stale index name_1_location_1');
  } catch (e) {
    console.log('vendors: stale index not found (already dropped or never existed), continuing');
  }

  const steps = [
    { col: 'vendors',   from: 'location', to: 'site' },
    { col: 'paypoints', from: 'location', to: 'site' },
    { col: 'payables',  from: 'location', to: 'site' },
    { col: 'fuelorders', from: 'station', to: 'site' },
  ];

  for (const { col, from, to } of steps) {
    const result = await db.collection(col).updateMany(
      { [from]: { $exists: true } },
      { $rename: { [from]: to } }
    );
    console.log(`${col}: renamed '${from}' → '${to}' on ${result.modifiedCount} documents`);
  }

  console.log('Migration complete.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
