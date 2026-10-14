/**
 * One-off script: sets `bankStmtAccess` on every existing Location.
 *
 * False for the sites listed below, true for all the others. Dry run by default;
 * nothing is written unless --apply is passed. It refuses to run if any site in
 * the list can't be found, so a typo can't silently leave a site switched on.
 *   node manual/backfill-bank-stmt-access.js            # report only
 *   node manual/backfill-bank-stmt-access.js --apply    # write changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/Location');

// Matched against each location's site name (falling back to stationName).
const NO_BANK_STMT_ACCESS = ['Test Lab', 'Oliver', 'Osoyoos', 'Wavers West', 'Wavers East', 'Sioux Valley'];

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`);

  const locations = await Location.find({}).select('stationName site bankStmtAccess').lean();
  const nameOf = (l) => l.site ?? l.stationName;

  const missing = NO_BANK_STMT_ACCESS.filter((n) => !locations.some((l) => nameOf(l) === n));
  if (missing.length) {
    console.error(`Aborting: no location named ${missing.map((n) => `"${n}"`).join(', ')}.`);
    console.error(`Known sites: ${locations.map(nameOf).sort().join(', ')}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const off = locations.filter((l) => NO_BANK_STMT_ACCESS.includes(nameOf(l)));
  const on = locations.filter((l) => !NO_BANK_STMT_ACCESS.includes(nameOf(l)));

  for (const l of locations) {
    const want = !NO_BANK_STMT_ACCESS.includes(nameOf(l));
    const now = l.bankStmtAccess === undefined ? '(unset)' : l.bankStmtAccess;
    console.log(`${want ? 'true ' : 'false'}  ${nameOf(l)}  [currently ${now}]`);
  }

  if (apply) {
    const offRes = await Location.updateMany({ _id: { $in: off.map((l) => l._id) } }, { $set: { bankStmtAccess: false } });
    const onRes = await Location.updateMany({ _id: { $in: on.map((l) => l._id) } }, { $set: { bankStmtAccess: true } });
    console.log(`\nSet false on ${offRes.modifiedCount} of ${off.length}, true on ${onRes.modifiedCount} of ${on.length} (others already had the value).`);
  } else {
    console.log(`\nWould set false on ${off.length} and true on ${on.length} sites.`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
