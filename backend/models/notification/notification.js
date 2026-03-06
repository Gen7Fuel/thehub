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
    required: true 
  },
  // We store recipients here as you requested
  recipientIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  subject: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'sent', 'scheduled'], 
    default: 'sent' 
  },
  scheduledAt: { type: Date, default: Date.now },
  
  // PROVISION FOR THREADING:
  // If this is a reply, parentId will point to the original notification
  parentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Notification', 
    default: null 
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);