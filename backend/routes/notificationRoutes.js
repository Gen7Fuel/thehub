const express = require('express');
const router = express.Router();
const Notification = require('../models/notification/notification');
const User = require('../models/User');
// const NotificationInstance = require('../models/notification/notificationInstance');
const NotificationTemplate = require('../models/notification/notificationTemplate');

// get all unread notifications for user from ther last time they logged in untill now
router.get('/unread-summary', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const lastLogin = user.lastLoginDate || new Date(0); // Fallback to epoch if null

    const unreadCount = await Notification.countDocuments({
      recipientIds: req.user._id,
      createdAt: { $gte: lastLogin },
      "readReceipts.userId": { $ne: req.user._id } // Not read by this user
    });
    console.log(`User ${req.user.email} has ${unreadCount} unread notifications since last login at ${lastLogin}`);
    res.json({ unreadCount });
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
      .select('subject status createdAt readReceipts notificationType');

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

// 2. GET SINGLE NOTIFICATION
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(id).populate('templateId');

    if (!notification) return res.status(404).json({ message: "Not found" });

    // Mark as read if not already present
    const alreadyRead = notification.readReceipts.some(r => r.userId.toString() === userId.toString());
    if (!alreadyRead) {
      notification.readReceipts.push({ userId, readAt: new Date() });
      await notification.save();
    }

    // Process Template
    let finalHtml = notification.templateId.contentLayout;
    const fieldValues = Object.fromEntries(notification.fieldValues || new Map());

    Object.keys(fieldValues).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      finalHtml = finalHtml.replace(regex, fieldValues[key] || '');
    });
    const io = req.app.get("io");

    notification.recipientIds.forEach(id => {
      // Emit specifically to that user's room
      io.to(id.toString()).emit("new-notification");
    });

    res.json({
      ...notification._doc,
      html: finalHtml,
      isRead: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;