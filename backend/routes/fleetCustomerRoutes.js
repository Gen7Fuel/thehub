const express = require('express');
const router = express.Router();
const FleetCustomer = require('../models/FleetCustomer');

// GET all fleet customers
router.get('/', async (req, res) => {
  try {
    const customers = await FleetCustomer.find({}).sort({ name: 1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single fleet customer by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await FleetCustomer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new fleet customer
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const customer = new FleetCustomer({
      name: name.trim(),
      email: email.trim().toLowerCase()
    });
    
    await customer.save();
    
    res.status(201).json(customer);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// PUT - Update fleet customer
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const customer = await FleetCustomer.findByIdAndUpdate(
      req.params.id,
      { 
        name: name.trim(),
        email: email.trim().toLowerCase()
      },
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// DELETE - Delete fleet customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await FleetCustomer.findByIdAndDelete(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ 
      message: 'Customer deleted successfully',
      deletedCustomer: customer
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Search fleet customers
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    
    const customers = await FleetCustomer.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).sort({ name: 1 });
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;