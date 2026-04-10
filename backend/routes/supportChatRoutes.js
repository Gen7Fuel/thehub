const express = require('express');
const router = express.Router();
const SupportChat = require('../models/SupportChat');
const { chatTimeoutQueue } = require('../queues/supportChatQueue');

const CHAT_TIMEOUT_MS = 60_000; // 60 seconds

// Store io reference set from app.js
let _io = null;
function initSupportChatIo(io) {
  _io = io;
}

// POST /api/support/chat — create a new chat session
router.post('/', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Initial message is required.' });
    }

    const site = (req.user?.stationName || '').trim();
    if (!site) {
      return res.status(400).json({ success: false, message: 'User has no associated site.' });
    }

    const customerName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

    const chat = await SupportChat.create({
      site,
      initialMessage: String(message).trim(),
      status: 'pending',
      customer: {
        id: req.user._id,
        name: customerName,
        email: req.user.email || '',
      },
      expiresAt: new Date(Date.now() + CHAT_TIMEOUT_MS),
    });

    // Schedule timeout job
    await chatTimeoutQueue.add(
      'chat-timeout',
      { chatId: String(chat._id) },
      { delay: CHAT_TIMEOUT_MS, jobId: String(chat._id) }
    );

    // Notify all support staff via socket
    if (_io) {
      const supportNamespace = _io.of('/support');
      supportNamespace.to('support-staff').emit('support-chat:pending', {
        chatId: String(chat._id),
        customer: { name: customerName, email: req.user.email || '' },
        site,
        initialMessage: String(message).trim(),
        createdAt: chat.createdAt,
      });
    }

    res.status(201).json({ success: true, data: chat });
  } catch (error) {
    console.error('Support chat create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create support chat.' });
  }
});

// GET /api/support/chat — list active chats (for support users)
router.get('/', async (req, res) => {
  try {
    if (!req.user.isSupport && !req.user.is_admin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const chats = await SupportChat.find({
      status: { $in: ['pending', 'accepted'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: chats });
  } catch (error) {
    console.error('Support chat list error:', error);
    res.status(500).json({ success: false, message: 'Failed to list chats.' });
  }
});

// GET /api/support/chat/:id — fetch a chat session
router.get('/:id', async (req, res) => {
  try {
    const chat = await SupportChat.findById(req.params.id).lean();
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    // Only the customer or support users can view
    const userId = String(req.user._id);
    const isCustomer = userId === String(chat.customer?.id);
    const isSupportUser = !!req.user.isSupport;

    if (!isCustomer && !isSupportUser && !req.user.is_admin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: chat });
  } catch (error) {
    console.error('Support chat get error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch support chat.' });
  }
});

// PATCH /api/support/chat/:id/close — close a chat
router.patch('/:id/close', async (req, res) => {
  try {
    const chat = await SupportChat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const userId = String(req.user._id);
    const isCustomer = userId === String(chat.customer?.id);
    const isAcceptedAgent = userId === String(chat.acceptedBy?.id);

    if (!isCustomer && !isAcceptedAgent && !req.user.is_admin) {
      return res.status(403).json({ success: false, message: 'Not allowed to close this chat.' });
    }

    chat.status = 'closed';
    await chat.save();

    if (_io) {
      const supportNamespace = _io.of('/support');
      supportNamespace.to(`chat-${chat._id}`).emit('support-chat:closed', {
        chatId: String(chat._id),
      });
    }

    res.json({ success: true, data: chat });
  } catch (error) {
    console.error('Support chat close error:', error);
    res.status(500).json({ success: false, message: 'Failed to close chat.' });
  }
});

module.exports = { router, initSupportChatIo };
