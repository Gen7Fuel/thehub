const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// GET /api/events?site=... — list ALL events (upcoming & historical) for a site
router.get('/', async (req, res) => {
  try {
    const site = (req.query.site || req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'Site is required.' });
    }

    // Return ALL events (past and future) sorted by date
    const events = await Event.find({ site })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Event list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load events.' });
  }
});

// POST /api/events — create event for the user's site
router.post('/', async (req, res) => {
  try {
    const { title, description, date } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Date (YYYY-MM-DD) is required.' });
    }

    // Backend restriction: Prevent creating events in the past
    const today = new Date().toISOString().slice(0, 10);
    if (String(date) < today) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot create events for past dates.' 
      });
    }

    const site = (req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'User has no associated site.' });
    }

    const event = await Event.create({
      site,
      title: String(title).trim(),
      description: String(description || '').trim(),
      date: String(date),
      createdBy: {
        id: req.user._id,
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
        email: req.user.email || '',
      },
    });

    // =========================================================================
    // TODO: Add notification service trigger here (e.g., Push / In-App / Slack)
    // =========================================================================

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Event create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create event.' });
  }
});

// DELETE /api/events/:id — creator or admin can delete
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Get today's local date in YYYY-MM-DD format
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Prevent deletion of events scheduled for today or earlier
    if (event.date <= todayIso) {
      return res.status(400).json({ 
        success: false, 
        message: 'Events occurring today or in the past cannot be deleted.' 
      });
    }

    // Prevent deletion of Cycle Count events
    if (event.title && event.title.startsWith('Cycle Count')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cycle Count events cannot be deleted.' 
      });
    }

    // Ownership and Admin Role Checks
    const isOwner = String(event.createdBy?.id) === String(req.user._id);
    
    // Check role_name from populated role or nested role object
    const isAdmin = req.user?.role?.role_name === 'Admin' || !!req.user?.is_admin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Events can only be deleted by the owner of the event or an Admin.' 
      });
    }

    await event.deleteOne();
    res.json({ success: true, _id: req.params.id });
  } catch (error) {
    console.error('Event delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
});

module.exports = router;