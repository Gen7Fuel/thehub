const express = require('express');
const router = express.Router();
const ActionLog = require('../models/ActionLog');

router.get('/', async (req, res) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      success,
      from,
      to,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (resourceId) filter.resourceId = resourceId;
    if (success !== undefined) filter.success = success === 'true';

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const [items, total] = await Promise.all([
      ActionLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ActionLog.countDocuments(filter),
    ]);

    res.json({ items, page: pageNum, limit: pageSize, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
