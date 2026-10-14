const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  recipientIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  subject: { type: String, required: true },

  // MERGED: Data from Instance
  fieldValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // MERGED: Tracking read status per user
  readReceipts: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],

  status: {
    type: String,
    enum: ['draft', 'sent', 'scheduled', 'archived'],
    default: 'sent'
  },
  notificationType: {
    type: String,
    enum: ['system', 'manual'],
    default: 'system'
  },
  scheduledAt: { type: Date, default: Date.now },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    default: null
  }
}, { timestamps: true });

// Backs the unread-count and notification-list queries, which run on every
// page load. Descending createdAt matches the list's sort, so it's served from
// the index rather than sorted in memory.
notificationSchema.index({ recipientIds: 1, createdAt: -1 });

// module.exports = mongoose.model('Notification', notificationSchema);

// 2. Check if the model is already compiled in the connection
let Notification;
try {
  Notification = mongoose.model("Notification");
} catch (error) {
  Notification = mongoose.model("Notification", notificationSchema);
}

module.exports = Notification;