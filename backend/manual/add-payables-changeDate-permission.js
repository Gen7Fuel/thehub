/**
 * One-off script: adds the `changeDate` permission node to the `payables` module.
 *
 * Run once from the backend directory:
 *   node manual/add-payables-changeDate-permission.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Permission = require('../models/Permission');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const payablesPerm = await Permission.findOne({ module_name: 'payables' });

  if (!payablesPerm) {
    console.error('❌ No "payables" permission module found in DB.');
    process.exit(1);
  }

  const alreadyExists = payablesPerm.structure.some(n => n.name === 'changeDate');
  if (alreadyExists) {
    console.log('✅ "changeDate" already exists in payables structure — nothing to do.');
    process.exit(0);
  }

  payablesPerm.structure.push({ name: 'changeDate', children: [] });
  await payablesPerm.save();

  // Re-fetch to confirm the assigned permId
  const updated = await Permission.findOne({ module_name: 'payables' });
  const node = updated.structure.find(n => n.name === 'changeDate');
  console.log(`✅ Added "payables.changeDate" with permId ${node?.permId}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
