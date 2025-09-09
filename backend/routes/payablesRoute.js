const express = require('express');
const router = express.Router();
const Payable = require('../models/Payables');

// GET all payables
router.get('/', async (req, res) => {
  try {
    const { location, date } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (location) filter.location = location;
    
    // Single date filter
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      filter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    const payables = await Payable.find(filter)
      .populate('location', 'stationName csoCode')
      .sort({ createdAt: -1 });
    
    res.json(payables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single payable by ID
router.get('/:id', async (req, res) => {
  try {
    const payable = await Payable.findById(req.params.id)
      .populate('location', 'stationName csoCode timezone');
    
    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    
    res.json(payable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new payable
router.post('/', async (req, res) => {
  try {
    const { vendorName, location, notes, paymentMethod, amount, images } = req.body;
    
    // Validation
    if (!vendorName || !location || !paymentMethod || amount === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: vendorName, location, paymentMethod, amount' 
      });
    }
    
    if (amount < 0) {
      return res.status(400).json({ error: 'Amount must be non-negative' });
    }
    
    const payable = new Payable({
      vendorName,
      location,
      notes,
      paymentMethod,
      amount,
      images: images || []
    });
    
    const savedPayable = await payable.save();
    const populatedPayable = await Payable.findById(savedPayable._id)
      .populate('location', 'stationName csoCode');
    
    res.status(201).json(populatedPayable);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update payable
router.put('/:id', async (req, res) => {
  try {
    const { vendorName, location, notes, paymentMethod, amount, images } = req.body;
    
    // Validation
    if (amount !== undefined && amount < 0) {
      return res.status(400).json({ error: 'Amount must be non-negative' });
    }
    
    const updateData = {};
    if (vendorName !== undefined) updateData.vendorName = vendorName;
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (amount !== undefined) updateData.amount = amount;
    if (images !== undefined) updateData.images = images;
    
    const payable = await Payable.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('location', 'stationName csoCode');
    
    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    
    res.json(payable);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE payable
router.delete('/:id', async (req, res) => {
  try {
    const payable = await Payable.findByIdAndDelete(req.params.id);
    
    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    
    res.json({ message: 'Payable deleted successfully', deletedPayable: payable });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET summary statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { location, date } = req.query;
    
    const matchFilter = {};
    if (location) matchFilter.location = new mongoose.Types.ObjectId(location);
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      matchFilter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    const stats = await Payable.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          paymentMethods: { $addToSet: '$paymentMethod' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalAmount: 0,
      totalCount: 0,
      avgAmount: 0,
      paymentMethods: []
    };
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;