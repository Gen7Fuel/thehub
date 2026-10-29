const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelSales = require('../../models/fuel/FuelSales');
const { getProcessedFuelSales } = require('../../services/supaBaseService');
const { logChange } = require('../../middleware/changeLogger');

router.post('/sync/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const loc = await Location.findById(stationId);
    if (!loc || !loc.csoCode) return res.status(404).send('Station or CSO code not found');

    const todayStr = new Date().toISOString().split('T')[0];
    const { salesData, lastTransaction } = await getProcessedFuelSales(loc.csoCode, todayStr);
    const salesDate = new Date().setHours(0, 0, 0, 0);
    const before = await FuelSales.findOne({ stationId, date: salesDate }).lean();

    const updated = await FuelSales.findOneAndUpdate(
      { stationId, date: salesDate },
      {
        salesData,
        isLive: true,
        lastFetchedAt: new Date(), // Actual fetch time
        lastTransactionAt: lastTransaction ? String(lastTransaction) : null
      },
      { upsert: true, new: true }
    );

    await logChange(req, {
      action: before ? 'update' : 'create', resourceType: 'fuel-sales', resourceId: updated._id,
      resourceLabel: `${loc.stationName || loc.site} ${todayStr}`, before, after: updated.toObject(),
      success: true, statusCode: 200, source: 'fuel-management.workspace',
      message: `Live fuel sales synchronized for ${loc.stationName || loc.site} on ${todayStr}`,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
