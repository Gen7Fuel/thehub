const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Location = require('../models/Location');
const { pushNotification } = require('../services/notificationService');

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
// router.post('/', async (req, res) => {
//   try {
//     const { title, description, date } = req.body || {};

//     if (!title || !String(title).trim()) {
//       return res.status(400).json({ success: false, message: 'Title is required.' });
//     }
//     if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
//       return res.status(400).json({ success: false, message: 'Date (YYYY-MM-DD) is required.' });
//     }

//     // Backend restriction: Prevent creating events in the past
//     const today = new Date().toISOString().slice(0, 10);
//     if (String(date) < today) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Cannot create events for past dates.' 
//       });
//     }

//     const site = (req.user?.stationName || '').trim();
//     if (!site) {
//       return res.status(400).json({ success: false, message: 'User has no associated site.' });
//     }

//     const event = await Event.create({
//       site,
//       title: String(title).trim(),
//       description: String(description || '').trim(),
//       date: String(date),
//       createdBy: {
//         id: req.user._id,
//         firstName: req.user.firstName || '',
//         lastName: req.user.lastName || '',
//         email: req.user.email || '',
//       },
//     });

//     // =========================================================================
//     // TODO: Add notification service trigger here (e.g., Push / In-App / Slack)
//     // =========================================================================

//     res.status(201).json({ success: true, data: event });
//   } catch (error) {
//     console.error('Event create error:', error);
//     res.status(500).json({ success: false, message: 'Failed to create event.' });
//   }
// });
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
      type: 'manual',
      createdBy: {
        id: req.user._id,
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
        email: req.user.email || '',
      },
    });

    // Send HTTP response immediately
    res.status(201).json({ success: true, data: event });

    // =========================================================================
    // Asynchronous Background Notification Dispatch
    // =========================================================================
    try {
      const io = req.app.get('io');
      const senderEmail = (req.user?.email || '').trim().toLowerCase();

      // Look up location using stationName or site field
      const locationDoc = await Location.findOne({
        $or: [{ stationName: site }, { site: site }]
      }).lean();

      if (locationDoc && io) {
        // Collect manager emails and store email
        const managerEmails = (locationDoc.managerEmails || [])
          .filter(e => Boolean(e) && typeof e === 'string')
          .map(e => e.trim().toLowerCase());
          
        const storeEmail = locationDoc.email ? locationDoc.email.trim().toLowerCase() : null;

        // Combine all store leadership emails to check if the sender is part of management
        const allManagementEmails = [...managerEmails, ...(storeEmail ? [storeEmail] : [])];

        // CHECK: If sender is NOT a manager or store email, proceed with notification
        if (!allManagementEmails.includes(senderEmail)) {
          let recipientEmails = [];

          // Target managers first
          if (managerEmails.length > 0) {
            recipientEmails = managerEmails;
          } else if (storeEmail) {
            // Fallback: If no manager emails exist, notify store email
            recipientEmails = [storeEmail];
          }

          // Exclude sender's own email and deduplicate
          recipientEmails = [...new Set(recipientEmails)].filter(
            email => email && email !== senderEmail
          );

          if (recipientEmails.length > 0) {
            const senderName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'A user';

            // Extract month string (YYYY-MM) for calendar URL navigation
            const monthStr = date.substring(0, 7);
            const baseUrl = process.env.CLIENT_URL || 'http://app.gen7fuel.com';
            const calendarUrl = `${baseUrl}/events?site=${encodeURIComponent(site)}&month=${monthStr}`;

            await pushNotification({
              io,
              senderId: req.user._id,
              recipientEmails,
              slug: 'new-event-created',
              fieldValues: {
                senderName,
                site,
                eventTitle: event.title,
                eventDate: event.date,
                calendarUrl
              },
              subject: `New Event Created for ${site}: ${event.title}`,
              type: 'system'
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('Event creation notification background dispatch error:', notifErr);
    }

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

    // Prevent deletion of system-generated events
    if (event.type === 'system') {
      return res.status(400).json({ 
        success: false, 
        message: 'System-generated events cannot be deleted.' 
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