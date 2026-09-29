require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Transaction = require('../models/Transactions');
const { DUPLICATE_PO_ALLOWED_SITES } = require('../constants/poSites');

// Backfills the `poUniqueEnforced` marker and swaps the old per-station PO-number
// unique index (stationName_1_poNumber_1) for the marker-aware one
// (po_station_number_unique_enforced), which exempts DUPLICATE_PO_ALLOWED_SITES.
//
// The index is created before the old one is dropped, so there is no window in
// which duplicate PO numbers go unguarded.

const DRY_RUN = true; // Set to false to commit changes

const OLD_INDEX_NAME = 'stationName_1_poNumber_1';
const NEW_INDEX_NAME = 'po_station_number_unique_enforced';

// Must match backend/models/Transactions.js exactly
const NEW_INDEX_FILTER = {
  source: 'PO',
  poUniqueEnforced: true,
  stationName: { $exists: true, $gt: '' },
  poNumber: { $exists: true, $gt: '' },
  deletedAt: null,
};

// Docs the new index will cover once the marker is stamped
const ENFORCED_SCOPE = {
  source: 'PO',
  poNumber: { $gt: '' },
  stationName: { $nin: DUPLICATE_PO_ALLOWED_SITES },
};

async function run() {
  await connectDB();

  console.log(`--- 🚀 PO uniqueness marker backfill [Dry Run: ${DRY_RUN}] ---`);
  console.log(`Exempt sites: ${DUPLICATE_PO_ALLOWED_SITES.join(', ')}`);

  // 1. Abort if live duplicates already exist — the unique index build would fail,
  //    and Mongoose's autoIndex would swallow that failure silently.
  const duplicates = await Transaction.aggregate([
    { $match: { ...ENFORCED_SCOPE, deletedAt: null } },
    { $group: { _id: { stationName: '$stationName', poNumber: '$poNumber' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  if (duplicates.length > 0) {
    console.error(`💥 Found ${duplicates.length} duplicate (stationName, poNumber) pairs among live POs at non-exempt sites.`);
    console.error('   The unique index cannot be built until these are resolved (soft-delete or renumber):');
    for (const d of duplicates) {
      console.error(`   - ${d._id.stationName} / ${d._id.poNumber} × ${d.count}: ${d.ids.join(', ')}`);
    }
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('✅ No duplicates among live POs at non-exempt sites');

  // 2. Stamp the marker on every non-exempt PO with a number. Soft-deleted docs are
  //    included too: harmless (the partial filter still excludes them while deleted)
  //    and it keeps them protected if one is ever restored.
  const toStamp = await Transaction.countDocuments({ ...ENFORCED_SCOPE, poUniqueEnforced: { $ne: true } });

  // 3. Clear the marker from exempt sites, so re-running after the list changes
  //    releases any site newly added to it.
  const toClear = await Transaction.countDocuments({
    stationName: { $in: DUPLICATE_PO_ALLOWED_SITES },
    poUniqueEnforced: { $exists: true },
  });

  console.log(`Docs to stamp with poUniqueEnforced: ${toStamp}`);
  console.log(`Docs to clear poUniqueEnforced from: ${toClear}`);

  if (DRY_RUN) {
    console.log(`[DRY RUN] would create index ${NEW_INDEX_NAME} and drop ${OLD_INDEX_NAME}`);
    console.log('--- DRY RUN complete — set DRY_RUN=false to commit ---');
    await mongoose.disconnect();
    return;
  }

  const stamped = await Transaction.updateMany(
    { ...ENFORCED_SCOPE, poUniqueEnforced: { $ne: true } },
    { $set: { poUniqueEnforced: true } }
  );
  console.log(`✅ Stamped ${stamped.modifiedCount} documents`);

  const cleared = await Transaction.updateMany(
    { stationName: { $in: DUPLICATE_PO_ALLOWED_SITES }, poUniqueEnforced: { $exists: true } },
    { $unset: { poUniqueEnforced: '' } }
  );
  console.log(`✅ Cleared ${cleared.modifiedCount} documents`);

  // 4. Create the marker-aware index first...
  await Transaction.collection.createIndex(
    { stationName: 1, poNumber: 1 },
    { name: NEW_INDEX_NAME, unique: true, partialFilterExpression: NEW_INDEX_FILTER }
  );
  console.log(`✅ Created index ${NEW_INDEX_NAME}`);

  // 5. ...then retire the old one.
  try {
    await Transaction.collection.dropIndex(OLD_INDEX_NAME);
    console.log(`✅ Dropped index ${OLD_INDEX_NAME}`);
  } catch (err) {
    if (err.code === 27 || err.codeName === 'IndexNotFound') {
      console.log(`ℹ️  Index ${OLD_INDEX_NAME} not present — nothing to drop`);
    } else {
      throw err;
    }
  }

  // 6. Show the result.
  const indexes = await Transaction.collection.listIndexes().toArray();
  console.log('--- Indexes on transactions ---');
  for (const ix of indexes) {
    console.log(`   ${ix.name}${ix.unique ? ' (unique)' : ''} ${JSON.stringify(ix.key)}`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
