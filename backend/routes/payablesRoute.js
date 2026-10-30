const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payable = require('../models/Payables');
const Location = require('../models/Location');
const Safesheet = require('../models/Safesheet');
const PayableVendorTag = require('../models/PayableVendorTag');
const { logChange } = require('../middleware/changeLogger');
const { getPermissionMap } = require('../utils/permissionStore');
const { pushNotification } = require('../services/notificationService');

const requestSource = (req) => req.headers['x-action-source'] || 'payables';

// Helper: check if a user has effective access to a permId
function hasEffectiveAccess(user, role, permId) {
  const userOverride = user.customPermissionsArray?.find(p => p.permId === permId);
  if (userOverride !== undefined) return userOverride.value;
  if (role && role.permissionsArray) {
    const roleSetting = role.permissionsArray.find(p => p.permId === permId);
    return roleSetting ? roleSetting.value : false;
  }
  return false;
}

// GET all payables
router.get('/', async (req, res) => {
  try {
    const { location, from, to } = req.query;

    const filter = {};
    if (location) filter.location = location;

    if (from && to) {
      filter.date = {
        $gte: String(from).slice(0, 10),
        $lte: String(to).slice(0, 10),
      }
    }

    
    const payables = await Payable.find(filter)
      .populate('location', 'stationName csoCode')
      .sort({ createdAt: -1 });
    
    res.json(payables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all vendor tags (payable vendor name -> Sage Intacct vendor).
// Registered before '/:id' so "vendor-tags" isn't read as an id.
router.get('/vendor-tags', async (req, res) => {
  try {
    const tags = await PayableVendorTag.find({})
      .select('nameKey vendorName sageVendorId sageVendorName')
      .lean();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET vendor autocomplete options for a site: global Sage tags plus every
// historical vendor used by payables at that site.
router.get('/vendor-options', async (req, res) => {
  try {
    const requestedLocation = String(req.query.location || '').trim();
    if (!requestedLocation) return res.status(400).json({ error: 'location is required' });
    const location = mongoose.isValidObjectId(requestedLocation)
      ? await Location.findById(requestedLocation).select('_id').lean()
      : await Location.findOne({ $or: [{ stationName: new RegExp(`^${requestedLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, { site: requestedLocation }] }).select('_id').lean();
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const [tags, historicalNames] = await Promise.all([
      PayableVendorTag.find({}).select('nameKey vendorName sageVendorId sageVendorName').lean(),
      Payable.distinct('vendorName', { location: location._id, vendorName: { $type: 'string', $ne: '' } }),
    ]);
    const options = new Map();
    tags.forEach((tag) => options.set(tag.nameKey, tag));
    historicalNames.forEach((name) => {
      const displayName = String(name).trim().replace(/\s+/g, ' ');
      const nameKey = displayName.toLowerCase();
      if (!options.has(nameKey)) options.set(nameKey, { nameKey, vendorName: displayName, sageVendorId: '', sageVendorName: '' });
    });
    res.json([...options.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT a vendor tag: set or change the Intacct vendor for a payable vendor name.
router.put('/vendor-tags', async (req, res) => {
  try {
    const { vendorName, sageVendorId, sageVendorName } = req.body || {};
    const name = typeof vendorName === 'string' ? vendorName.trim() : '';
    const id = typeof sageVendorId === 'string' ? sageVendorId.trim() : '';
    const sageName = typeof sageVendorName === 'string' ? sageVendorName.trim() : '';
    if (!name || !id || !sageName) {
      return res.status(400).json({ error: 'vendorName, sageVendorId and sageVendorName are required' });
    }
    const nameKey = PayableVendorTag.normalizeName(name);
    const before = await PayableVendorTag.findOne({ nameKey }).lean();
    const tag = await PayableVendorTag.findOneAndUpdate(
      { nameKey },
      {
        $set: { sageVendorId: id, sageVendorName: sageName, taggedBy: req.user?.email || '' },
        $setOnInsert: { vendorName: name },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    await logChange(req, {
      action: before ? 'update' : 'create', resourceType: 'payable-vendor-tag',
      resourceId: tag._id, resourceStore: 'mongodb', success: true, statusCode: 200,
      source: requestSource(req),
      message: `Payable vendor ${tag.vendorName} tagged as Sage vendor ${tag.sageVendorName}`,
      before, after: tag,
    });
    res.json({ nameKey: tag.nameKey, vendorName: tag.vendorName, sageVendorId: tag.sageVendorId, sageVendorName: tag.sageVendorName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT the Intacct bill key created for a payable. Only the first call wins, so
// a payable can't be linked to two Intacct entries.
router.put('/:id/sage-bill', async (req, res) => {
  try {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    if (!key) return res.status(400).json({ error: 'key is required' });
    const before = await Payable.findById(req.params.id).lean();
    const payable = await Payable.findOneAndUpdate(
      { _id: req.params.id, 'sageBill.key': { $exists: false } },
      { $set: { sageBill: { key, createdAt: new Date() } } },
      { new: true }
    ).lean();
    if (!payable) {
      const exists = await Payable.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ error: exists ? 'An Intacct entry is already linked to this payable' : 'Payable not found' });
    }
    await logChange(req, {
      action: 'update', resourceType: 'payable', resourceId: payable._id,
      resourceStore: 'mongodb', success: true, statusCode: 200,
      source: requestSource(req),
      message: `Sage bill ${key} linked to payable for ${payable.vendorName}`,
      before, after: payable,
    });
    res.json({ sageBill: payable.sageBill });
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
    
    const dateStr = date
      ? String(date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const payable = new Payable({
      vendorName,
      location,
      notes,
      paymentMethod,
      amount,
      images: images || [],
      date: dateStr,
    });

    const savedPayable = await payable.save();

    const populatedPayable = await Payable.findById(savedPayable._id)
      .populate('location', 'stationName csoCode');
    
    if (paymentMethod == 'safe') {
      try {
        const siteName = populatedPayable?.location?.stationName
        if (siteName) {
          const entryDate = populatedPayable.date

          let sheet = await Safesheet.findOne({ site: siteName })
          if (!sheet) {
            sheet = await Safesheet.create({ site: siteName, initialBalance: 0, entries: [] })
          }

          sheet.entries.push({
            date: entryDate,
            description: `Payout - ${vendorName}`,
            cashExpenseOut: Number(populatedPayable.amount || 0),
            payableId: savedPayable._id,
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
      await logChange(req, {
        action: 'create',
        resourceType: 'payable',
        resourceId: populatedPayable._id,
        success: true,
        statusCode: 201,
        resourceStore: 'mongodb',
        source: requestSource(req),
        message: `Payable created for ${populatedPayable.vendorName} — $${Number(populatedPayable.amount || 0).toFixed(2)} on ${populatedPayable.date}`,
        before: null,
        after: populatedPayable,
      });
    } catch (e) {
      // do not block response
    }

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
    const { vendorName, location, notes, paymentMethod, amount, images, date: dateField, requestInvoice } = req.body;

    // Validation
    if (amount !== undefined && amount < 0) {
      return res.status(400).json({ error: 'Amount must be non-negative' });
    }

    // Extra permission check: changing the business date requires payables.changeDate
    if (dateField !== undefined) {
      const permissionMap = getPermissionMap();
      const permId = permissionMap.get('payables.changeDate');
      if (!permId || !hasEffectiveAccess(req.user, req.user.role, permId)) {
        return res.status(403).json({ message: 'Access denied for payables.changeDate' });
      }
    }

    const updateData = {};
    if (vendorName !== undefined) updateData.vendorName = vendorName;
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (amount !== undefined) updateData.amount = amount;
    if (images !== undefined) updateData.images = images;
    if (requestInvoice !== undefined) updateData.requestInvoice = requestInvoice;
    if (dateField !== undefined) updateData.date = String(dateField).slice(0, 10);

    const before = await Payable.findById(req.params.id).lean();

    const updateOptions = { new: true, runValidators: true };

    const payable = await Payable.findByIdAndUpdate(
      req.params.id,
      updateData,
      updateOptions
    ).populate('location', 'stationName csoCode email');

    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }
    // Audit log (success)
    try {
      await logChange(req, {
        action: 'update',
        resourceType: 'payable',
        resourceId: payable._id,
        success: true,
        statusCode: 200,
        resourceStore: 'mongodb',
        source: requestSource(req),
        message: `Payable updated for ${payable.vendorName} — $${Number(payable.amount || 0).toFixed(2)} on ${payable.date}`,
        before,
        after: payable,
      });
    } catch (e) {}

    if (requestInvoice === true) {
      const loc = payable.location
      const locationEmail = loc?.email
      if (locationEmail) {
        const redirectUrl = `https://app.gen7fuel.com/payables/list`
        pushNotification({
          io: null,
          recipientEmails: [locationEmail],
          bccEmails: ['mohammad@gen7fuel.com'],
          slug: 'payable-invoice-requested',
          subject: `📄 Invoice Required – ${loc.stationName} – ${payable.vendorName}`,
          fieldValues: {
            site: loc.stationName,
            vendorName: payable.vendorName,
            paymentMethod: payable.paymentMethod,
            amount: (payable.amount || 0).toFixed(2),
            date: payable.date || new Date(payable.createdAt).toLocaleDateString('en-CA', { timeZone: 'UTC' }),
            redirectUrl,
          },
          type: 'system',
        }).catch(e => console.error('Payable invoice notification error:', e))
      }
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
    const payable = await Payable.findById(req.params.id);

    if (!payable) {
      return res.status(404).json({ error: 'Payable not found' });
    }

    // Cascade step first (strict): remove any linked Safesheet entry before deleting the
    // payable itself. If this fails, abort without deleting the payable so nothing orphans.
    let cascadeSheet;
    try {
      cascadeSheet = await Safesheet.findOneAndUpdate(
        { 'entries.payableId': payable._id },
        { $pull: { entries: { payableId: payable._id } } }
      );
    } catch (cascadeErr) {
      // AccessLog captures this failed request; no durable change occurred.
      return res.status(500).json({ error: 'Failed to remove linked safesheet entry; payable was not deleted.' });
    }
    // cascadeSheet === null just means no linked entry exists (paymentMethod wasn't 'safe',
    // or the best-effort write at creation time failed) — not an error, proceed normally.

    await Payable.findByIdAndDelete(payable._id);

    // Audit log (success)
    try {
      await logChange(req, {
        action: 'delete',
        resourceType: 'payable',
        resourceId: payable._id,
        success: true,
        statusCode: 200,
        resourceStore: 'mongodb',
        source: requestSource(req),
        message: `Payable deleted for ${payable.vendorName} — $${Number(payable.amount || 0).toFixed(2)} on ${payable.date}`,
        before: payable,
        after: null,
      });
    } catch (e) {}

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
      matchFilter.date = String(date).slice(0, 10);
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
