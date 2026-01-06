const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payable = require('../models/Payables');
const Safesheet = require('../models/Safesheet');
const { logAction } = require('../middleware/actionLogger');

// GET all payables
router.get('/', async (req, res) => {
  try {
    const { location, from, to } = req.query;

    const filter = {};
    if (location) filter.location = location;

    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);

      // Make sure end includes the whole day
      end.setHours(23, 59, 59, 999);

      filter.createdAt = { $gte: start, $lte: end }
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
    const { vendorName, location, notes, paymentMethod, amount, images, date } = req.body;
    
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
      images: images || [],
      createdAt: date ? new Date(date) : undefined, // <--- override createdAt if date sent
    });

    const savedPayable = await payable.save();

    const populatedPayable = await Payable.findById(savedPayable._id)
      .populate('location', 'stationName csoCode');
    
    if (paymentMethod == 'safe') {
      try {
        const siteName = populatedPayable?.location?.stationName
        if (siteName) {
          // derive local YYYY-MM-DD from createdAt
          const created = new Date(populatedPayable.createdAt)
          const y = created.getFullYear()
          const m = String(created.getMonth() + 1).padStart(2, '0')
          const d = String(created.getDate()).padStart(2, '0')
          const ymd = `${y}-${m}-${d}`
          const entryDate = date // 23:59:59.999 local

          let sheet = await Safesheet.findOne({ site: siteName })
          if (!sheet) {
            sheet = await Safesheet.create({ site: siteName, initialBalance: 0, entries: [] })
          }

          sheet.entries.push({
            date: entryDate,
            description: `Payout - ${vendorName}`,
            cashExpenseOut: Number(populatedPayable.amount || 0),
          })
          console.log('Entering into safesheet');
          await sheet.save()
        } else {
          console.warn('Safesheet entry skipped: missing stationName on payable.location')
        }
      } catch (e) {
        console.warn('Safesheet payable entry failed:', e?.message || e)
      }
    }
    
    // Audit log (success)
    try {
      await logAction(req, {
        action: 'create',
        resourceType: 'payable',
        resourceId: populatedPayable._id,
        success: true,
        statusCode: 201,
        message: `Payable created: ${populatedPayable.vendorName}`,
        after: {
          vendorName: populatedPayable.vendorName,
          amount: populatedPayable.amount,
          paymentMethod: populatedPayable.paymentMethod,
          location: populatedPayable.location?._id?.toString() || populatedPayable.location?.toString(),
        },
      });
    } catch (e) {
      // do not block response
    }

    res.status(201).json(populatedPayable);
  } catch (error) {
    if (error.name === 'ValidationError') {
      try { await logAction(req, { action: 'create', resourceType: 'payable', success: false, statusCode: 400, message: error.message }); } catch (_) {}
      return res.status(400).json({ error: error.message });
    }
    try { await logAction(req, { action: 'create', resourceType: 'payable', success: false, statusCode: 500, message: error.message }); } catch (_) {}
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
    
    const before = await Payable.findById(req.params.id).lean();

    const payable = await Payable.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('location', 'stationName csoCode');
    
    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    // Audit log (success)
    try {
      await logAction(req, {
        action: 'update',
        resourceType: 'payable',
        resourceId: payable._id,
        success: true,
        statusCode: 200,
        message: `Payable updated: ${payable.vendorName}`,
        before: before ? {
          vendorName: before.vendorName,
          amount: before.amount,
          paymentMethod: before.paymentMethod,
          location: before.location?.toString(),
        } : undefined,
        after: {
          vendorName: payable.vendorName,
          amount: payable.amount,
          paymentMethod: payable.paymentMethod,
          location: payable.location?._id?.toString() || payable.location?.toString(),
        },
      });
    } catch (e) {}

    res.json(payable);
  } catch (error) {
    if (error.name === 'ValidationError') {
      try { await logAction(req, { action: 'update', resourceType: 'payable', resourceId: req.params.id, success: false, statusCode: 400, message: error.message }); } catch (_) {}
      return res.status(400).json({ error: error.message });
    }
    try { await logAction(req, { action: 'update', resourceType: 'payable', resourceId: req.params.id, success: false, statusCode: 500, message: error.message }); } catch (_) {}
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
    // Audit log (success)
    try {
      await logAction(req, {
        action: 'delete',
        resourceType: 'payable',
        resourceId: payable._id,
        success: true,
        statusCode: 200,
        message: `Payable deleted: ${payable.vendorName}`,
        before: {
          vendorName: payable.vendorName,
          amount: payable.amount,
          paymentMethod: payable.paymentMethod,
          location: payable.location?.toString(),
        },
      });
    } catch (e) {}

    res.json({ message: 'Payable deleted successfully', deletedPayable: payable });
  } catch (error) {
    try { await logAction(req, { action: 'delete', resourceType: 'payable', resourceId: req.params.id, success: false, statusCode: 500, message: error.message }); } catch (_) {}
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