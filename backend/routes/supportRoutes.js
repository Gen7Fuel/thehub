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
    await ticket.populate('userId', 'name email isSupport');

    const io = req.app.get('io');
    if (io) {
      io.of('/support').to('support-staff').emit('ticket:new', ticket);
    }

    res.status(201).json({ success: true, message: 'Ticket created successfully.', data: ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket.', error: error.message });
  }
});

// GET /api/support/tickets - Get tickets (support staff sees all; users see their own)
router.get('/tickets', async (req, res) => {
  try {
    const { site } = req.query;
    const isStaff = req.user.isSupport || req.user.is_admin;

    let filter = {};
    if (site) {
      filter.site = site;
    } else if (!isStaff) {
      filter.userId = req.user.id;
    }

    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email isSupport')
      .populate('messages.sender', 'name email isSupport')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { tickets } });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch support tickets', error: error.message });
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

// PATCH /api/support/tickets/:id/status - Update ticket status (support staff only)
router.patch('/tickets/:id/status', async (req, res) => {
  try {
    if (!req.user.isSupport && !req.user.is_admin) {
      return res.status(403).json({ success: false, message: 'Only support staff can update ticket status.' });
    }
    const { status } = req.body;
    if (!['open', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'name email isSupport');
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update ticket status.', error: error.message });
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