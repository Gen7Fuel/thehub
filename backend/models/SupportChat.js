const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: { type: String, default: '' },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const supportChatSchema = new mongoose.Schema(
  {
    site: {
      type: String,
      required: true,
      trim: true,
    },
    initialMessage: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'closed'],
      default: 'pending',
    },
    customer: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    acceptedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: { type: String, default: '' },
    },
    messages: [chatMessageSchema],
    convertedTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportChat', supportChatSchema);
