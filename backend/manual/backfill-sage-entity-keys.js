/**
 * One-off script: fills in `sageEntityKey` on Locations that don't have one.
 *
 * Keys are the Intacct entity keys (company-config/entity, the `key` field,
 * not the G170-style id). A location that already has a key is never changed.
 * Dry run by default; nothing is written unless --apply is passed. It refuses
 * to run if a site in the list can't be found, so a typo can't skip a site.
 *   node manual/backfill-sage-entity-keys.js            # report only
 *   node manual/backfill-sage-entity-keys.js --apply    # write changes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/Location');

// Hub site name (falling back to stationName) -> Intacct entity key.
const ENTITY_KEYS = {
  Oliver: '128', //            G170 Oliver Gen7 LP
  Osoyoos: '123', //           G180 Osoyoos Gen7 LP
  'Wavers West': '125', //     G200 Wavers of Brokenhead
  'Wavers East': '135', //     G210 BON Community Store
  'Sioux Valley': '136', //    G220 Sioux Valley Gen7
  'Test Lab': '132', //        T010 Test Site
};
// Little Shuswap has no Intacct entity yet.

const apply = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`);

  const locations = await Location.find({}).select('stationName site sageEntityKey').lean();
  const nameOf = (l) => l.site ?? l.stationName;

  const missing = Object.keys(ENTITY_KEYS).filter((n) => !locations.some((l) => nameOf(l) === n));
  if (missing.length) {
    console.error(`Aborting: no location named ${missing.map((n) => `"${n}"`).join(', ')}.`);
    console.error(`Known sites: ${locations.map(nameOf).sort().join(', ')}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  let toSet = 0;
  for (const l of locations) {
    const want = ENTITY_KEYS[nameOf(l)];
    if (l.sageEntityKey) {
      console.log(`keep  ${nameOf(l)}  [already ${l.sageEntityKey}${want && want !== l.sageEntityKey ? `, list says ${want}` : ''}]`);
    } else if (want) {
      console.log(`set   ${nameOf(l)}  -> ${want}`);
      toSet++;
      if (apply) await Location.updateOne({ _id: l._id, sageEntityKey: { $in: [null, ''] } }, { $set: { sageEntityKey: want } });
    } else {
      console.log(`none  ${nameOf(l)}  [no key and none in the list]`);
    }
  }

  console.log(`\n${apply ? 'Set' : 'Would set'} ${toSet} site${toSet === 1 ? '' : 's'}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
