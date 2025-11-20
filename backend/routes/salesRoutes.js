const express = require('express');
const router = express.Router();
const { getCategorizedSalesData, getGradeVolumeFuelData, getTransTimePeriodData } = require('../services/sqlService');

router.get('/sales', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getCategorizedSalesData(csoCode, startDate, endDate);
  res.json(data);
});

router.get('/fuelsales', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getGradeVolumeFuelData(csoCode, startDate, endDate);
  res.json(data);
});

router.get('/trans-time-period', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getTransTimePeriodData(csoCode, startDate, endDate);
  console.log('time period data:',data);
  res.json(data);
});

module.exports = router;