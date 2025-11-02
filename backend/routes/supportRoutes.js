const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/Support');

// POST /api/support/tickets - Create a new support ticket
router.post('/tickets', async (req, res) => {
  try {
    const { text, priority, site, images } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Ticket message is required.' });
    }
    if (!priority) {
      return res.status(400).json({ success: false, message: 'Priority is required.' });
    }
    if (!site || !site.trim()) {
      return res.status(400).json({ success: false, message: 'Site is required.' });
    }

    // First message is the ticket text
    const ticket = new SupportTicket({
      userId: req.user.id,
      text: text.trim(),
      priority,
      site: site.trim(),
      images: images || [], // Array of CDN filenames
      messages: [{
        sender: req.user.id,
        text: text.trim(),
        createdAt: new Date()
      }]
    });

    await ticket.save();

    res.status(201).json({ success: true, message: 'Ticket created successfully.', data: ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket.', error: error.message });
  }
});

// GET /api/support/tickets - Get all tickets, optionally filtered by site
router.get('/tickets', async (req, res) => {
  try {
    const { site } = req.query;

    // If site is provided, filter by site, otherwise show user's own tickets
    let filter = {};
    if (site) {
      filter.site = site;
    } else if (req.user && req.user.id) {
      filter.userId = req.user.id;
    }

    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email isSupport')
      .populate('messages.sender', 'name email isSupport')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        tickets
      }
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support tickets',
      error: error.message
    });
  }
});

// GET /api/support/tickets/:id - Get a ticket and its messages
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email isSupport')
      .populate('messages.sender', 'name email isSupport');
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch ticket.', error: error.message });
  }
});

// POST /api/support/tickets/:id/messages - Add a message to the ticket
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      return res.status(403).json({ success: false, message: 'Ticket is closed.' });
    }
    ticket.messages.push({
      sender: req.user.id,
      text: text.trim(),
      createdAt: new Date()
    });
    await ticket.save();
    await ticket.populate('messages.sender', 'name email isSupport');
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add message.', error: error.message });
  }
});

module.exports = router;