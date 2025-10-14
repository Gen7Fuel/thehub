const express = require('express');
const router = express.Router();
const Conversation = require('../models/Support');

// @route   GET /api/support/conversations
// @desc    Get all support conversations (for support staff)
// @access  Private
router.get('/conversations', async (req, res) => {
  try {
    // Check if user is support staff
    const supportEmail = 'mohammad@gen7fuel.com';
    if (req.user.email !== supportEmail) {
      return res.status(403).json({ message: 'Access denied. Support staff only.' });
    }

    const conversations = await Conversation.find()
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/support/my-conversation
// @desc    Get current user's support conversation
// @access  Private
router.get('/my-conversation', async (req, res) => {
  try {
    let conversation = await Conversation.findOne({ userId: req.user.id })
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email');

    // If no conversation exists, create one
    if (!conversation) {
      conversation = new Conversation({
        userId: req.user.id,
        messages: []
      });
      await conversation.save();
      
      // Populate the newly created conversation
      conversation = await Conversation.findById(conversation._id)
        .populate('userId', 'name email')
        .populate('messages.senderId', 'name email');
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching user conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/support/conversations/:id/messages
// @desc    Send a message to a conversation
// @access  Private
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { text } = req.body;
    const conversationId = req.params.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    // Find the conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('userId', 'name email');
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const supportEmail = 'mohammad@gen7fuel.com';
    const isSupport = req.user.email === supportEmail;
    const isOwner = conversation.userId._id.toString() === req.user.id;

    // Check permissions
    if (!isSupport && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add new message to the conversation
    const newMessage = {
      senderId: req.user.id,
      text: text.trim(),
      isRead: false
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    // Populate the updated conversation
    const updatedConversation = await Conversation.findById(conversationId)
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email');

    res.json(updatedConversation);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/support/conversations/:id/read
// @desc    Mark messages as read
// @access  Private
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Find the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const supportEmail = 'mohammad@gen7fuel.com';
    const isSupport = req.user.email === supportEmail;
    const isOwner = conversation.userId.toString() === req.user.id;

    // Check permissions
    if (!isSupport && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark messages as read (only messages not sent by current user)
    conversation.messages.forEach(message => {
      if (message.senderId.toString() !== req.user.id && !message.isRead) {
        message.isRead = true;
      }
    });

    await conversation.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/support/conversations/:id
// @desc    Get a specific conversation
// @access  Private
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId)
      .populate('userId', 'name email')
      .populate('messages.senderId', 'name email');
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const supportEmail = 'mohammad@gen7fuel.com';
    const isSupport = req.user.email === supportEmail;
    const isOwner = conversation.userId._id.toString() === req.user.id;

    // Check permissions
    if (!isSupport && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;