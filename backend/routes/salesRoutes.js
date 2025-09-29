const express = require('express');
const router = express.Router();
const { getSalesData } = require('../services/sqlService');

router.get('/sales', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getSalesData(csoCode, startDate, endDate);
  res.json(data);
});

module.exports = router;