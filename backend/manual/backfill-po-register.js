/**
 * One-off script: backfills `register` on existing POs saved with an empty value.
 *
 * Matches the rule now applied at creation time in routes/purchaseOrder.js: for
 * sites with 0 or 1 configured registers, the PO gets that register's number
 * (or "1" when none are configured). Sites with 2+ registers are skipped — the
 * right register can't be inferred for those.
 *
 * Dry run by default; nothing is written unless --apply is passed.
 *   node manual/backfill-po-register.js            # report only
 *   node manual/backfill-po-register.js --apply    # write changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('../models/Transactions');
const Location = require('../models/Location');

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`);

  const emptyRegister = { $or: [{ register: '' }, { register: null }, { register: { $exists: false } }] };
  const filter = { source: 'PO', ...emptyRegister };

  const bySite = await Transaction.aggregate([
    { $match: filter },
    { $group: { _id: '$stationName', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { _id: stationName, count } of bySite) {
    const loc = await Location.findOne({ stationName }).select('registers').lean();
    const registers = loc?.registers ?? [];

    if (registers.length > 1) {
      console.log(`SKIP   ${stationName}: ${count} POs, site has ${registers.length} registers`);
      totalSkipped += count;
      continue;
    }

    const value = registers[0]?.number || '1';
    if (apply) {
      const res = await Transaction.updateMany({ ...filter, stationName }, { $set: { register: value } });
      console.log(`UPDATE ${stationName}: ${res.modifiedCount} POs -> register "${value}"`);
      totalUpdated += res.modifiedCount;
    } else {
      console.log(`WOULD  ${stationName}: ${count} POs -> register "${value}"`);
      totalUpdated += count;
    }
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${totalUpdated} POs; skipped ${totalSkipped} (multi-register sites).`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
