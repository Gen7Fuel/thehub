const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  initials: { type: String, required: true },
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const WriteOffItemSchema = new mongoose.Schema({
  gtin: { type: String },
  upc_barcode: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  onHandAtWriteOff: { type: Number, default: 0 },
  reason: {
    type: String,
    enum: ['Breakage', 'Spoilage', 'Store Use', 'Deli', 'Stolen', 'Damaged', 'Expired', 'Donation', 'About to Expire'],
    required: true
  },
  isManualEntry: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  expiryDate: { type: Date },
  // Inside your Schema items array
  markdownAction: {
    type: String,
    enum: ['Marked Down', 'No Markdown Needed', null],
    default: null
  },
  comments: { type: [CommentSchema], default: [] }, // Comments Schema
});

const WriteOffListSchema = new mongoose.Schema({
  listNumber: { type: String, unique: true, required: true }, // generated e.g., WO-7F2A
  site: { type: String, required: true },
  submittedBy: { type: String, required: true },
  status: { type: String, enum: ['Incomplete', 'Partial', 'Complete'], default: 'Incomplete' },
  items: [WriteOffItemSchema],
  createdAt: { type: Date, default: Date.now },
  submitted: { type: Boolean, default: false },
  listType: { type: String, enum: ['WO', 'ATE', 'BT'], default: 'WO' }
});

// module.exports = mongoose.model('WriteOff', WriteOffListSchema);
module.exports = mongoose.models.WriteOff || mongoose.model('WriteOff', WriteOffListSchema);