const express = require('express');
const StatusCustomer = require('../models/StatusCustomer');
const StatusSale = require('../models/StatusSale');
const router = express.Router();

// Create a status sale
router.post('/', async (req, res) => {
  try {
    const { statusCardNumber, name, phone, pump, fuelGrade, amount, total, stationName, notes } = req.body;

    // Validate required fields
    if (!statusCardNumber || !name || !pump || !fuelGrade || !amount || !total || !stationName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save or update the customer in the StatusCustomer model
    const customer = await StatusCustomer.findOneAndUpdate(
      { statusCardNumber },
      { name, phone },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Save the sale in the StatusSale model
    const statusSale = new StatusSale({
      statusCardNumber,
      pump,
      fuelGrade,
      amount,
      total,
      stationName,
      notes,
    });

    await statusSale.save();

    // Send Email for testing
    try {
      // Get logged in user name (assumes req.user is set by auth middleware)
      const userName = req.user?.name || req.user?.email || 'Unknown User';

      // Build email content
      const emailSubject = 'Status Sales Entry';
      const emailTo = 'mohammad@gen7fuel.com';
      const emailHtml = `
        <h2>Status Sales Entry</h2>
        <ul>
          <li><b>User:</b> ${userName}</li>
          <li><b>Status Card Number:</b> ${statusCardNumber}</li>
          <li><b>Name:</b> ${name}</li>
          <li><b>Phone:</b> ${phone || ''}</li>
          <li><b>Pump:</b> ${pump}</li>
          <li><b>Fuel Grade:</b> ${fuelGrade}</li>
          <li><b>Amount:</b> ${amount}</li>
          <li><b>Total:</b> ${total}</li>
          <li><b>Station Name:</b> ${stationName}</li>
          <li><b>Notes:</b> ${notes || ''}</li>
        </ul>
        <p>Submitted at: ${new Date().toLocaleString()}</p>
      `;

      // Send the email (using your email utility)
      const { sendEmail } = require('../utils/emailService');
      await sendEmail({
        to: emailTo,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending status sales email:', emailError);
    }
    //End email testing

    res.status(201).json({ customer, statusSale });
  } catch (error) {
    console.error('Error creating status sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { stationName, startDate, endDate } = req.query;

    // Build the query object
    const query = {};
    if (stationName) query.stationName = stationName;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate + "T00:00:00Z"),
        $lte: new Date(endDate + "T23:59:59"),
      };
    }

    // Fetch status sales based on the query
    const statusSales = await StatusSale.find(query);

    // Fetch customer details for each statusCardNumber
    const statusCardNumbers = statusSales.map((sale) => sale.statusCardNumber);
    const customers = await StatusCustomer.find({
      statusCardNumber: { $in: statusCardNumbers },
    });

    // Map customers by statusCardNumber for quick lookup
    const customerMap = customers.reduce((map, customer) => {
      map[customer.statusCardNumber] = { name: customer.name, phone: customer.phone };
      return map;
    }, {});

    // Merge customer details into status sales
    const enrichedStatusSales = statusSales.map((sale) => ({
      ...sale.toObject(),
      customerDetails: customerMap[sale.statusCardNumber] || null, // Add customer details if available
    }));

    res.status(200).json(enrichedStatusSales);
  } catch (error) {
    console.error('Error fetching status sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:statusCardNumber', async (req, res) => {
  try {
    const { statusCardNumber } = req.params;

    // Find the customer by statusCardNumber
    const customer = await StatusCustomer.findOne({ statusCardNumber });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;