const express = require('express');
const router = express.Router();
const Notification = require('../models/notification/notification');
const User = require('../models/User');
const { emailQueue } = require("../queues/emailQueue");
const NotificationTemplate = require('../models/notification/notificationTemplate');
const { pushNotification } = require('../services/notificationService');

// get all unread notifications for user from ther last time they logged in untill now
router.get('/unread-summary', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const lookBackDate = user.unreadSummaryDate || new Date(0); // Fallback to epoch if null

    const unreadCount = await Notification.countDocuments({
      recipientIds: req.user._id,
      status: { $ne: 'archived' },
      createdAt: { $gte: lookBackDate },
      "readReceipts.userId": { $ne: req.user._id } // Not read by this user
    });
    // console.log(`User ${req.user.email} has ${unreadCount} unread notifications since last login at ${lastLogin}`);
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Backend: Get TOTAL unread for the Bell Icon
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientIds: req.user._id,
      status: { $ne: 'archived' },
      "readReceipts.userId": { $ne: req.user._id } // Just check if not read
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1. GET ALL TEMPLATES (For the List view)
router.get('/template', async (req, res) => {
  try {
    const templates = await NotificationTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: "Error fetching templates: " + err.message });
  }
});

// GET single template for editing
router.get('/template/:id', async (req, res) => {
  try {
    const template = await NotificationTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/notification/sent
router.get('/sent', async (req, res) => {
  try {
    const sentNotifications = await Notification.find({ senderId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('templateId', 'name')
      .lean();

    // Map to include total recipient count for the UI
    const result = sentNotifications.map(n => ({
      ...n,
      recipientCount: n.recipientIds ? n.recipientIds.length : 0,
      isRead: true // Sent items don't have an "unread" state for the sender
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1. GET ALL NOTIFICATIONS
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ recipientIds: userId })
      .sort({ createdAt: -1 })
      .select('subject status createdAt readReceipts notificationType senderId')
      .populate('senderId', 'firstName lastName email');
    // Transform data to include a boolean 'isRead' for the frontend
    const formattedNotifications = notifications.map(n => {
      const isRead = n.readReceipts.some(r => r.userId.toString() === userId.toString());
      return {
        ...n._doc,
        isRead,
        readReceipts: undefined // Hide full array to save bandwidth
      };
    });

    res.json(formattedNotifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // POPULATE: Added recipientIds and senderId
    const notification = await Notification.findById(id)
      .populate('templateId')
      .populate('senderId', 'firstName lastName email')
      .populate('recipientIds', 'firstName lastName email');

    if (!notification) return res.status(404).json({ message: "Not found" });

    const isSender = notification.senderId?._id?.toString() === userId.toString();
    const isRecipient = notification.recipientIds.some(r => r._id.toString() === userId.toString());

    if (!isSender && !isRecipient) {
      return res.status(403).json({ message: "Access Denied" });
    }

    if (isRecipient) {
      const alreadyRead = notification.readReceipts.some(r => r.userId.toString() === userId.toString());
      if (!alreadyRead) {
        notification.readReceipts.push({ userId, readAt: new Date() });
        await notification.save();
      }
    }

    let finalHtml = notification.templateId.contentLayout;
    const fieldValues = Object.fromEntries(notification.fieldValues || new Map());
    Object.keys(fieldValues).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      finalHtml = finalHtml.replace(regex, fieldValues[key] || '');
    });

    res.json({
      ...notification._doc,
      html: finalHtml,
      isRead: isSender ? true : notification.readReceipts.some(r => r.userId.toString() === userId.toString())
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      templateId,
      recipientIds = [],
      bccUserIds = [], // New field for BCC
      subject,
      fieldValues,
      slug: manualSlug
    } = req.body;

    // 1. Resolve Slug
    let finalSlug = manualSlug;
    if (!finalSlug && templateId) {
      const template = await NotificationTemplate.findById(templateId);
      finalSlug = template?.slug;
    }

    // 2. Resolve Emails for both lists
    const allIds = [...new Set([...recipientIds, ...bccUserIds])];
    const users = await User.find({ _id: { $in: allIds } }).select('email');

    const recipientEmails = users
      .filter(u => recipientIds.includes(u._id.toString()))
      .map(u => u.email);

    const bccEmails = users
      .filter(u => bccUserIds.includes(u._id.toString()))
      .map(u => u.email);

    // 3. Call the Core Service
    const notification = await pushNotification({
      io: req.app.get('socketio'),
      senderId: req.user._id,
      recipientEmails,
      bccEmails, // Pass separately to the service
      slug: finalSlug,
      fieldValues,
      subject,
      type: 'manual'
    });

    res.status(201).json({ message: "Notification queued", notification });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/notification/dismiss-summary
router.post('/dismiss-summary', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.unreadSummaryDate = new Date();

    // timestamps: false ensures updatedAt is not modified
    await user.save({ timestamps: false });

    res.status(200).json({ message: "Summary dismissed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE OR UPDATE TEMPLATE
router.post('/template', async (req, res) => {
  try {
    const { name, slug, description, fields, contentLayout, type, _id } = req.body;

    // Basic Validation
    if (!name || !slug || !contentLayout) {
      return res.status(400).json({ message: "Name, Slug, and Content Layout are required." });
    }

    let template;

    if (_id) {
      // Update existing
      template = await NotificationTemplate.findByIdAndUpdate(
        _id,
        { name, slug, description, fields, contentLayout, type },
        { new: true, runValidators: true }
      );
    } else {
      // Check if slug already exists before creating
      const existing = await NotificationTemplate.findOne({ slug });
      if (existing) {
        return res.status(400).json({ message: "A template with this slug already exists." });
      }

      template = new NotificationTemplate({
        name,
        slug,
        description,
        fields,
        type: type || 'system', // Default to 'system' if not provided
        contentLayout
      });
      await template.save();
    }

    res.status(201).json(template);
  } catch (err) {
    console.error("Template Save Error:", err);
    res.status(500).json({ message: "Server Error: " + err.message });
  }
});

// 3. DELETE TEMPLATE
// router.delete('/template/:id', async (req, res) => {
//   try {
//     await NotificationTemplate.findByIdAndDelete(req.params.id);
//     res.json({ message: "Template deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ message: "Error deleting template" });
//   }
// });
// routes/notificationTemplate.js

router.delete('/template/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any notification is currently using this template
    const isInUse = await Notification.findOne({ templateId: id });

    if (isInUse) {
      return res.status(400).json({
        message: "This template cannot be deleted because it is already linked to existing notifications."
      });
    }

    const deletedTemplate = await NotificationTemplate.findByIdAndDelete(id);
    if (!deletedTemplate) return res.status(404).json({ message: "Template not found" });

    res.json({ message: "Template deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;