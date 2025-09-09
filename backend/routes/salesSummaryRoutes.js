const express = require('express');
const router = express.Router();
const SalesSummary = require('../models/SalesSummary');

router.post('/', async (req, res) => {
  try {
    // Convert the date string to a Date object
    const { date, stationNumber, ...rest } = req.body;
    const dateObject = new Date(date);

    // Check if a document with the same date and station number already exists
    const existingSummary = await SalesSummary.findOne({ date: dateObject, stationNumber: stationNumber });
    if (existingSummary) {
      return res.status(400).json({ error: "A sales summary for this date and station number already exists." });
    }

    const newSalesSummary = new SalesSummary({
      date: dateObject,
      stationNumber: stationNumber,
      ...rest
    });

    const savedSummary = await newSalesSummary.save();
    res.status(201).json(savedSummary);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:date/:csoCode', async (req, res) => {
  try {
    const { date, csoCode } = req.params;
    const dateObject = new Date(date);

    const salesSummary = await SalesSummary.findOne({ date: dateObject, stationNumber: csoCode });
    if (!salesSummary) {
      return res.status(404).json({ error: "Sales summary not found." });
    }

    res.status(200).json(salesSummary);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;