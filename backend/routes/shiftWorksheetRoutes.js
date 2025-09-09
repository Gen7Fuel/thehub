const express = require('express');
const ShiftWorksheet = require('../models/ShiftWorksheet');
const User = require('../models/User');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { report_number, shift, till_location, location } = req.body;

    // Validate required fields
    if (!report_number || !shift || !till_location || !location) {
      return res.status(400).json({ error: 'Report number, shift, and till location are required.' });
    }

    // Get the email from localStorage (sent from the frontend)
    const email = req.headers['x-user-email'];
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Create a new ShiftWorksheet entry with the user's firstName and lastName as shift_lead
    const newShiftWorksheet = new ShiftWorksheet({
      report_number,
      shift,
      till_location,
      location,
      shift_lead: `${user.firstName} ${user.lastName}`, // Set shift_lead from user's firstName and lastName
    });

    // Save the entry to the database
    await newShiftWorksheet.save();

    res.status(201).json(newShiftWorksheet);
  } catch (error) {
    console.error('Error creating Shift Worksheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, location } = req.query;

    // Validate required query parameters
    if (!startDate || !endDate || !location) {
      return res.status(400).json({ error: 'Date and location are required.' });
    }

    // Find worksheets matching the date and location
    const worksheets = await ShiftWorksheet.find({
      date : {
        $gte: new Date(startDate),
        $lt: new Date(endDate),
      },
      location,
    });

    res.status(200).json(worksheets);
  } catch (error) {
    console.error('Error fetching Shift Worksheets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;

    // Find the worksheet by ID
    const worksheet = await ShiftWorksheet.findById(worksheetId);

    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    res.status(200).json(worksheet);
  } catch (error) {
    console.error('Error fetching Shift Worksheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:worksheetId', async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const updateData = req.body;

    // Find the worksheet by ID and update it with the provided data
    const updatedWorksheet = await ShiftWorksheet.findByIdAndUpdate(
      worksheetId,
      updateData,
      { new: true, runValidators: true } // Return the updated document and validate the data
    );

    if (!updatedWorksheet) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }

    res.status(200).json(updatedWorksheet);
  } catch (error) {
    console.error('Error updating Shift Worksheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;