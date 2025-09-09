const express = require('express');
const router = express.Router();
const ShiftWorksheet = require('../models/ShiftWorksheet');
const CashSummary = require('../models/CashSummary');
const Transaction = require('../models/Transactions'); // Add Transaction model
const Payable = require('../models/Payables'); // Add Payable model
const Fleet = require('../models/Fleet'); // Add Fleet model

// GET route to fetch all shift worksheets for a particular day and station
router.get('/', async (req, res) => {
  const { startDate, endDate, location} = req.query;

  if (!startDate || !endDate || !location) {
    return res.status(400).json({ error: 'Date and location are required' });
  }

  try {
    // Fetch worksheets and cash summary
    const worksheets = await ShiftWorksheet.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      location
    });
    const cashsummary = await CashSummary.findOne({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      location
    });

    // Create date range for the entire day
    // const startDate = new Date(date + 'T00:00:00.000Z');
    // const endDate = new Date(date + 'T23:59:59.999Z');

    // Fetch purchase orders (transactions with source 'PO')
    const purchase_orders_raw = await Transaction.find({
      source: 'PO',
      date: {
        $gte: startDate,
        $lte: endDate
      },
      stationName: location
    }).select('fleetCardNumber amount productCode quantity date stationName _id');

    // Populate customer names from Fleet model
    const purchase_orders = await Promise.all(
      purchase_orders_raw.map(async (po) => {
        const fleetData = await Fleet.findOne({ fleetCardNumber: po.fleetCardNumber });
        return {
          _id: po._id,
          fleetCardNumber: po.fleetCardNumber,
          customerName: fleetData?.customerName || 'Unknown Customer',
          amount: po.amount,
          productCode: po.productCode,
          quantity: po.quantity,
          date: po.date,
          stationName: po.stationName
        };
      })
    );

    // Fetch payables from Payables model
    const payables = await Payable.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate('location', 'stationName').select('vendorName amount paymentMethod notes createdAt _id location');

    // Filter payables by location name and format the response
    const filteredPayables = payables
      .filter(payable => payable.location && payable.location.stationName === location)
      .map(payable => ({
        _id: payable._id,
        vendorName: payable.vendorName,
        amount: payable.amount,
        paymentMethod: payable.paymentMethod,
        notes: payable.notes || '',
        date: payable.createdAt,
        stationName: payable.location.stationName
      }));

    const output = {
      cash_summary: cashsummary,
      worksheets,
      purchase_orders,
      payables: filteredPayables
    }

    res.status(200).json(output);
  } catch (error) {
    console.error('Error fetching cash summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST route to create a new cash summary
router.post('/', async (req, res) => {
  const { name, location, date } = req.body; // Accept name, location, and date from the request body

  if (!name || !location || !date) {
    return res.status(400).json({ error: 'Name, location, and date are required' });
  }

  try {
    // Check if a cash summary already exists for the given date and location
    const existingSummary = await CashSummary.findOne({
      date: {
        $gte: new Date(date.split('T')[0] + 'T00:00:00.000Z'),
        $lte: new Date(date.split('T')[0] + 'T23:59:59.999Z')
      },
      location });
    if (existingSummary) {
      return res.status(400).json({ error: 'Cash summary already exists for this date and location' });
    }

    // Create a new cash summary
    const newCashSummary = new CashSummary({
      date,
      location,
      name,
      hand_held_debit: 0.0, // Default value
      ar: [], // Default empty array
      payout: [], // Default empty array
      ap: [], // Default empty array
      managers_notes: '', // Default empty string
    });

    // Save the cash summary to the database
    const savedSummary = await newCashSummary.save();
    res.status(201).json(savedSummary);
  } catch (error) {
    console.error('Error creating cash summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT route to update specific fields in an existing cash summary
router.put('/', async (req, res) => {
  const { startDate, endDate, location, hand_held_debit, managers_notes } = req.body;

  if (!startDate || !endDate || !location) {
    return res.status(400).json({ error: 'Date and location are required' });
  }

  try {
    // Prepare update object
    const updateFields = {};
    if (hand_held_debit !== undefined) updateFields.hand_held_debit = hand_held_debit;
    if (managers_notes !== undefined) updateFields.managers_notes = managers_notes;

    // Find and update the cash summary
    const updatedSummary = await CashSummary.findOneAndUpdate(
      { date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        location }, // Find by date and location
      { $set: updateFields }, // Apply updates
      { new: true } // Return the updated document
    );

    if (!updatedSummary) {
      return res.status(404).json({ error: 'Cash summary not found' });
    }

    res.status(200).json(updatedSummary);
  } catch (error) {
    console.error('Error updating cash summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;