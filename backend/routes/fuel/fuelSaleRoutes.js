const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const FuelSales = require('../../models/fuel/FuelSales');
const { getProcessedFuelSales } = require('../../services/supaBaseService');

router.post('/sync/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const loc = await Location.findById(stationId);
    if (!loc || !loc.csoCode) return res.status(404).send('Station or CSO code not found');

    const todayStr = new Date().toISOString().split('T')[0];
    const { salesData, lastTransaction } = await getProcessedFuelSales(loc.csoCode, todayStr);

    const updated = await FuelSales.findOneAndUpdate(
      { stationId, date: new Date().setHours(0, 0, 0, 0) },
      {
        salesData,
        isLive: true,
        lastFetchedAt: new Date(), // Actual fetch time
        lastTransactionAt: lastTransaction ? String(lastTransaction) : null
      },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;