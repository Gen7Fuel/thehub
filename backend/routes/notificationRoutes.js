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
      "readReceipts.userId": { $ne: req.user._id } // Just check if not read
    });
    res.json({ count });
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

    res.json({
      ...notification._doc,
      html: finalHtml,
      isRead: true
    });
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

// routes/notification.js

router.post('/introduction', async (req, res) => {
  try {
    // 1. Fetch all active users
    const users = await User.find({ is_active: true }).select('email');
    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No active users found" });
    }

    // 2. Prepare recipient lists
    const primaryRecipients = ['daksh@gen7fuel.com', 'mohammad@gen7fuel.com', 'kellie@gen7fuel.com'];
    const bccList = users
      .map(u => u.email)
      .filter(email => !primaryRecipients.includes(email.toLowerCase().trim()));

    // 3. SECURE THE POPUP: Update all users' unreadSummaryDate to "now" 
    // This ensures the summary query (which uses $gte: unreadSummaryDate) catches the intro
    const syncTime = new Date();
    await User.updateMany(
      { is_active: true },
      { $set: { unreadSummaryDate: new Date(syncTime.getTime() - 60000) } }, // 1 minute ago to be safe
      { timestamps: false }
    );

    // 5. Send the DIRECT "Rich HTML" Email to everyone
    // We reuse your layout here so the email matches the announcement
    const introHtml = `
      <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f0f2f5;'>
        <div style='max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e4e8; box-shadow: 0 4px 15px rgba(0,0,0,0.05);'>
          
          <div style='background-color: #283593; color: #ffffff; text-align: center; padding: 30px;'>
            <h1 style='margin: 0; font-size: 24px;'>Welcome to the Hub Notification Center!</h1>
          </div>

          <div style='padding: 30px; color: #333; line-height: 1.6;'>
            <p>Hi Team,</p>
            <p>We are excited to introduce the <strong>Gen7Fuel Notification Center</strong>. Moving forward, you will receive real-time updates directly within the Hub for:</p>
            
            <ul style='margin-bottom: 25px;'>
              <li>Inventory Write-Off Lists</li>
              <li>System Maintenance Alerts</li>
              <li>Station Updates</li>
              <li>Order Management Updates</li>
              <li>Downtime Maintenance, any many more upcoming features</li>
            </ul>

            <div style='background-color: #f8f9fa; border: 1px dashed #cbd5e0; border-radius: 8px; padding: 20px; margin: 20px 0;'>
              <p style='margin-top: 0; font-weight: bold; color: #4a5568; font-size: 14px;'>Example: New Email Alert Format</p>
              <p style='font-size: 14px; color: #718096; margin-bottom: 15px;'>When an update occurs, you will receive a lightweight email alert like this:</p>
              
              <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border-top: 4px solid #1976d2; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="padding: 20px; text-align: center;">
                  <div style="font-size: 24px; margin-bottom: 10px;">🔔</div>
                  <h3 style="color: #333; margin: 0 0 5px 0; font-size: 16px;">New Hub Notification</h3>
                  <p style="color: #666; font-size: 13px; line-height: 1.4; margin: 0;">
                    A new update is available: <br>
                    <strong style="color: #1976d2;">[Sample Update Title]</strong>
                  </p>
                  <div style="margin-top: 15px;">
                    <span style="background-color: #1976d2; color: #ffffff; padding: 8px 16px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block;">View Details</span>
                  </div>
                </div>
              </div>
            </div>

            <p style='font-size: 14px; color: #4a5568;'>
              <strong>Why the change?</strong> By moving from detailed emails to in-app notifications, we ensure that all sensitive data and operational information is <strong>secured and stored in our own system directly.</strong> This keeps our business data private while providing you with a centralized inbox.
            </p>

            <p>Simply click the <strong>Bell Icon</strong> in the top navbar to view your notification history at any time.</p>

            <div style='text-align: center; margin-top: 35px;'>
              <a href='https://app.gen7fuel.com/notification' style='background-color: #283593; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Access Notification Center</a>
            </div>
          </div>
          
          <div style='background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #eee;'>
            <p style='margin: 0; color: #999; font-size: 11px;'>Gen7 Fuel Hub Security Update</p>
          </div>
        </div>
      </div>
    `;

    await emailQueue.add("sendUpdateEmail", {
      to: primaryRecipients[0],
      cc: primaryRecipients.slice(1),
      bcc: bccList,
      subject: 'Action Required: New Gen7Fuel Hub Notification System',
      html: introHtml,
      text: `Welcome to the new Hub Notification Center. Login at https://app.gen7fuel.com/notification to see your updates.`
    });

    // 4. Trigger the Hub Notification (Database + Sockets)
    const broadcast = await pushNotification({
      io: req.app.get('socketio'),
      recipientEmails: primaryRecipients,
      bccEmails: bccList,
      slug: 'system-introduction',
      subject: 'Introducing: The Gen7Fuel Hub Notification Center',
      type: 'system',
      fieldValues: {
        firstName: 'Team'
      }
    });

    res.status(200).json({
      message: `Introduction broadcasted. To/CC: ${primaryRecipients.length}, BCC: ${bccList.length}`,
      success: true
    });

  } catch (err) {
    console.error("Broadcast Route Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;