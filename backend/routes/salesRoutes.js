const express = require('express');
const router = express.Router();
const { getCategorizedSalesData, getGradeVolumeFuelData, getTransTimePeriodData, getAllSQLData } = require('../services/sqlService');

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

router.get('/transactions-data', async (req, res) => {
  // const limit = parseInt(req.query.limit, 10) || 10;
  const { csoCode, startDate, endDate } = req.query;
  const data = await getTransTimePeriodData(csoCode, startDate, endDate);
  console.log('time period data:',data);
  res.json(data);
});

router.get('/all-data', async (req, res) => {
  const {
    csoCode,

    salesStart,
    salesEnd,

    fuelStart,
    fuelEnd,

    transStart,
    transEnd
  } = req.query;

  try {
    const response = await getAllSQLData(csoCode, {
      salesStart,
      salesEnd,
      fuelStart,
      fuelEnd,
      transStart,
      transEnd
    });
    console.log('transstart:',transStart,'transend:',transEnd);
    console.log('salesstart:',salesStart,'salesend:',salesEnd);
    console.log('fuelsalesstart:',fuelStart,'fuelsalesend:',fuelEnd);

    res.json(response);
  } catch (err) {
    console.error("❌ Failed to fetch combined SQL data:", err);
    res.status(500).json({ error: "SQL fetch failed" });
  }
});

module.exports = router;