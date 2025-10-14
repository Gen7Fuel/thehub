const mongoose = require('mongoose');

// Subschema for individual messages
const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } // adds createdAt & updatedAt
);

// Main conversation schema (1 per user)
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one support chat per user
    },
    messages: [messageSchema], // embedded array of messages
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);