/**
 * One-off script: adds the `cashRecIntacctEntry` permission node to the
 * `accounting` module. It gates the cash-rec "Create Intacct Entry" button and
 * POST /api/cash-rec/other-receipt. Nobody has it until a role or user is
 * granted it in the permission settings.
 *
 * Run once from the backend directory:
 *   node manual/add-cash-rec-intacct-entry-permission.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Permission = require('../models/Permission');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const accounting = await Permission.findOne({ module_name: 'accounting' });
  if (!accounting) {
    console.error('❌ No "accounting" permission module found in DB.');
    process.exit(1);
  }

  if (accounting.structure.some((n) => n.name === 'cashRecIntacctEntry')) {
    console.log('✅ "cashRecIntacctEntry" already exists in accounting structure — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  accounting.structure.push({ name: 'cashRecIntacctEntry', children: [] });
  await accounting.save();

  // Re-fetch to confirm the assigned permId
  const updated = await Permission.findOne({ module_name: 'accounting' });
  const node = updated.structure.find((n) => n.name === 'cashRecIntacctEntry');
  console.log(`✅ Added "accounting.cashRecIntacctEntry" with permId ${node?.permId}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
