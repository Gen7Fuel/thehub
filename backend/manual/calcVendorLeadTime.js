// backend/manual/calcVendorLeadTime.js
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const OrderRec = require('../models/OrderRec');
const Vendor = require('../models/Vendor');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function calcVendorLeadTimes() {
  await connectDB();
  try {
    console.log('Loading orders...');
    // Load orders that may have placed/delivered history
    const orders = await OrderRec.find({}, { vendor: 1, site: 1, statusHistory: 1 }).lean();

    const buckets = new Map(); // key => { vendor, site, values: [] }

    for (const o of orders) {
      if (!o.vendor || !o.site || !Array.isArray(o.statusHistory)) continue;

      // find placed and delivered timestamps (case-insensitive)
      const placedEntry = o.statusHistory.find(s => s?.status && String(s.status).toLowerCase() === 'placed');
      const deliveredEntry = o.statusHistory.find(s => s?.status && String(s.status).toLowerCase() === 'delivered');

      if (!placedEntry || !deliveredEntry || !placedEntry.timestamp || !deliveredEntry.timestamp) continue;

      const placedTs = new Date(placedEntry.timestamp);
      const deliveredTs = new Date(deliveredEntry.timestamp);
      if (isNaN(placedTs) || isNaN(deliveredTs)) continue;

      const diffDays = (deliveredTs - placedTs) / MS_PER_DAY;
      if (!isFinite(diffDays) || diffDays < 0) continue; // ignore bad values

      const key = `${o.vendor}||${o.site}`;
      if (!buckets.has(key)) buckets.set(key, { vendor: o.vendor, site: o.site, values: [] });
      buckets.get(key).values.push(diffDays);
    }

    console.log(`Computed lead-time samples for ${buckets.size} vendor/site pairs.`);

    const report = [];
    for (const [key, { vendor, site, values }] of buckets.entries()) {
      if (!values.length) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const avgRounded = Math.round(avg * 100) / 100; // two decimals

      // Update Vendor doc for this vendor+site (location field)
      const res = await Vendor.findOneAndUpdate(
        { _id: vendor, location: site },
        { $set: { leadTime: avgRounded } },
        { new: true, timestamps: false }
      ).lean();

      report.push({
        vendor,
        site,
        sampleCount: values.length,
        avgDays: avgRounded,
        vendorDocFound: !!res,
      });
      console.log(`Updated vendor=${vendor} site=${site} => leadTime=${avgRounded} days (samples=${values.length})`);
    }

    console.log('Lead time update complete. Summary:');
    console.table(report);
    await mongoose.disconnect();
    return report;
  } catch (err) {
    console.error('Failed calculating lead times:', err);
    try { await mongoose.disconnect(); } catch {}
    throw err;
  }
}

// Run as CLI
if (require.main === module) {
  calcVendorLeadTimes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { calcVendorLeadTimes };