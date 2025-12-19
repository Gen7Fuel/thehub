const OrderRec = require('../models/OrderRec');
const Vendor = require('../models/Vendor');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function calcSingleVendorLeadTime(vendorId, site) {
  // Load only orders for this vendor + site
  const orders = await OrderRec.find(
    { vendor: vendorId, site },
    { statusHistory: 1 }
  ).lean();

  const values = [];

  for (const o of orders) {
    if (!Array.isArray(o.statusHistory)) continue;

    const placedEntry = o.statusHistory.find(
      s => String(s.status).toLowerCase() === 'placed'
    );
    const deliveredEntry = o.statusHistory.find(
      s => String(s.status).toLowerCase() === 'delivered'
    );

    if (!placedEntry?.timestamp || !deliveredEntry?.timestamp) continue;

    const placedTs = new Date(placedEntry.timestamp);
    const deliveredTs = new Date(deliveredEntry.timestamp);

    if (isNaN(placedTs) || isNaN(deliveredTs)) continue;

    const diffDays = (deliveredTs - placedTs) / MS_PER_DAY;
    if (!isFinite(diffDays) || diffDays < 0) continue;

    values.push(diffDays);
  }

  if (!values.length) return null;

  const avg =
    Math.round(
      (values.reduce((a, b) => a + b, 0) / values.length) * 100
    ) / 100;

  // Update vendor lead time
  await Vendor.findOneAndUpdate(
    { _id: vendorId, location: site },
    { $set: { leadTime: avg } },
    { timestamps: false }
  );

  return {
    vendorId,
    site,
    sampleCount: values.length,
    leadTime: avg,
  };
}

module.exports = { calcSingleVendorLeadTime };