/**
 * Backfills the additive `site` field onto existing documents that predate
 * the attachSiteAlias() hooks (see backend/utils/attachSiteAlias.js and the
 * corresponding model files). Non-destructive: only ever $sets `site` where
 * it doesn't already exist, never touches the legacy field, never renames.
 * Safe to re-run any number of times — a repeat run finds 0 candidates for
 * anything already backfilled or written after the hooks went live.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Location = require('../models/Location');
const Transaction = require('../models/Transactions');
const User = require('../models/User');
const StatusSale = require('../models/StatusSale');
const ATMRecord = require('../models/ATMRecord');
const Vendor = require('../models/Vendor');
const ActionLog = require('../models/ActionLog');
const ArCustomer = require('../models/ArCustomer');

const DRY_RUN = true; // Set to false to commit changes

const TOP_LEVEL_TARGETS = [
  { label: 'Location.stationName', Model: Location, legacyField: 'stationName' },
  { label: 'Transaction.stationName', Model: Transaction, legacyField: 'stationName' },
  { label: 'User.stationName', Model: User, legacyField: 'stationName' },
  { label: 'StatusSale.stationName', Model: StatusSale, legacyField: 'stationName' },
  { label: 'ATMRecord.stationName', Model: ATMRecord, legacyField: 'stationName' },
  { label: 'Vendor.location', Model: Vendor, legacyField: 'location' },
  { label: 'ActionLog.locationName', Model: ActionLog, legacyField: 'locationName' },
];

async function backfillTopLevel({ label, Model, legacyField }) {
  const filter = { [legacyField]: { $exists: true, $ne: null }, site: { $exists: false } };
  const count = await Model.countDocuments(filter);
  console.log(`\n--- ${label} -> site [${count} candidate doc(s)] ---`);
  if (count === 0) return { label, matched: 0, modified: 0 };

  if (DRY_RUN) {
    const sample = await Model.find(filter).limit(5).select(`_id ${legacyField}`).lean();
    sample.forEach(d => console.log(`  [DRY RUN] _id=${d._id} would set site="${d[legacyField]}"`));
    if (count > sample.length) console.log(`  ...and ${count - sample.length} more`);
    return { label, matched: count, modified: 0 };
  }

  const result = await Model.updateMany(filter, [{ $set: { site: `$${legacyField}` } }]);
  console.log(`  Updated ${result.modifiedCount} of ${result.matchedCount} matched`);
  return { label, matched: result.matchedCount, modified: result.modifiedCount };
}

async function backfillArCustomer() {
  const filter = { quickSelectSites: { $elemMatch: { site: { $exists: false } } } };
  const count = await ArCustomer.countDocuments(filter);
  console.log(`\n--- ArCustomer.quickSelectSites[].stationName -> site [${count} candidate doc(s)] ---`);
  if (count === 0) return { label: 'ArCustomer.quickSelectSites', matched: 0, modified: 0 };

  if (DRY_RUN) {
    const sample = await ArCustomer.find(filter).limit(5).select('_id name quickSelectSites').lean();
    sample.forEach(d => {
      const missing = d.quickSelectSites.filter(q => q.site === undefined).map(q => q.stationName);
      console.log(`  [DRY RUN] _id=${d._id} (${d.name}) would set site for: ${missing.join(', ')}`);
    });
    if (count > sample.length) console.log(`  ...and ${count - sample.length} more`);
    return { label: 'ArCustomer.quickSelectSites', matched: count, modified: 0 };
  }

  const result = await ArCustomer.updateMany(filter, [{
    $set: {
      quickSelectSites: {
        $map: {
          input: '$quickSelectSites',
          as: 'q',
          in: { $mergeObjects: ['$$q', { site: { $ifNull: ['$$q.site', '$$q.stationName'] } }] },
        },
      },
    },
  }]);
  console.log(`  Updated ${result.modifiedCount} of ${result.matchedCount} matched`);
  return { label: 'ArCustomer.quickSelectSites', matched: result.matchedCount, modified: result.modifiedCount };
}

async function run() {
  await connectDB();
  console.log(`=== Site field backfill (Phase 1) [DRY_RUN=${DRY_RUN}] ===`);

  const results = [];
  for (const target of TOP_LEVEL_TARGETS) {
    results.push(await backfillTopLevel(target));
  }
  results.push(await backfillArCustomer());

  console.log('\n=== Summary ===');
  results.forEach(r => console.log(`${r.label}: matched=${r.matched} modified=${r.modified}`));
  console.log(DRY_RUN
    ? '\n--- DRY RUN complete — set DRY_RUN=false to commit ---'
    : '\n--- Backfill committed ---');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('backfillSiteField failed:', err);
  process.exit(1);
});
