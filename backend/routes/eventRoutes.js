const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { emailQueue } = require('../queues/emailQueue');

const MARKETING_EMAIL = 'mohammad@gen7fuel.com';

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// GET /api/events?site=... — list upcoming events for a site
router.get('/', async (req, res) => {
  try {
    const site = (req.query.site || req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'Site is required.' });
    }

    // Today as YYYY-MM-DD in UTC (matches stored format).
    const today = new Date().toISOString().slice(0, 10);

    const events = await Event.find({ site, date: { $gte: today } })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Event list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load events.' });
  }
});

// POST /api/events — create event for the user's site and notify marketing
router.post('/', async (req, res) => {
  try {
    const { title, description, date } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Date (YYYY-MM-DD) is required.' });
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

    // Queue marketing notification (non-blocking — failure logged, not propagated).
    try {
      const creatorName =
        `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'A site manager';
      const subject = `New event at ${site}: ${event.title}`;
      const html = `
        <p>A new event has been added to The Hub.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px">
          <tr><td><strong>Site</strong></td><td>${escapeHtml(site)}</td></tr>
          <tr><td><strong>Date</strong></td><td>${escapeHtml(event.date)}</td></tr>
          <tr><td><strong>Title</strong></td><td>${escapeHtml(event.title)}</td></tr>
          <tr><td><strong>Description</strong></td><td>${escapeHtml(event.description) || '<em>(none)</em>'}</td></tr>
          <tr><td><strong>Created by</strong></td><td>${escapeHtml(creatorName)}${req.user.email ? ` &lt;${escapeHtml(req.user.email)}&gt;` : ''}</td></tr>
        </table>
      `;
      const text =
        `A new event has been added to The Hub.\n\n` +
        `Site: ${site}\n` +
        `Date: ${event.date}\n` +
        `Title: ${event.title}\n` +
        `Description: ${event.description || '(none)'}\n` +
        `Created by: ${creatorName}${req.user.email ? ` <${req.user.email}>` : ''}`;

      await emailQueue.add('sendEventEmail', {
        to: MARKETING_EMAIL,
        subject,
        text,
        html,
      });
    } catch (mailErr) {
      console.error('Failed to queue event notification email:', mailErr);
    }

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

    const isOwner = String(event.createdBy?.id) === String(req.user._id);
    const isAdmin = !!req.user?.is_admin;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete this event.' });
    }

    await event.deleteOne();
    res.json({ success: true, _id: req.params.id });
  } catch (error) {
    console.error('Event delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event.' });
  }
});

module.exports = router;
