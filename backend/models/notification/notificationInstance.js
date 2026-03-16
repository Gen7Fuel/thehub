const mongoose = require('mongoose');

const notificationInstanceSchema = new mongoose.Schema({
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    unique: true // One data instance per notification record
  },
  // Key-Value pairs matching the 'fields' defined in the Template
  // e.g., { "feature_name": "AI Assistant", "version": "2.0" }
  fieldValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  // Track read status per user since one notification can go to many people
  readReceipts: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('NotificationInstance', notificationInstanceSchema);