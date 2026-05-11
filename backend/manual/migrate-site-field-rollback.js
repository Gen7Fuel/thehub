/**
 * Rollback for migrate-site-field.js
 * Reverses the field renames applied by that script.
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

  const steps = [
    { col: 'locations',       from: 'name',  to: 'stationName' },
    { col: 'users',           from: 'site',  to: 'stationName' },
    { col: 'transactions',    from: 'site',  to: 'stationName' },
    { col: 'statussales',     from: 'site',  to: 'stationName' },
    { col: 'shiftworksheets', from: 'site',  to: 'location' },
    { col: 'vendors',         from: 'site',  to: 'location' },
    { col: 'paypoints',       from: 'site',  to: 'location' },
    { col: 'payables',        from: 'site',  to: 'location' },
    { col: 'fuelorders',      from: 'site',  to: 'station' },
  ];

  for (const { col, from, to } of steps) {
    const result = await db.collection(col).updateMany(
      { [from]: { $exists: true } },
      { $rename: { [from]: to } }
    );
    console.log(`${col}: renamed '${from}' → '${to}' on ${result.modifiedCount} documents`);
  }

  console.log('Rollback complete.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
