const mongoose = require('mongoose');

const WriteOffItemSchema = new mongoose.Schema({
  gtin: { type: String },
  upc_barcode: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  onHandAtWriteOff: { type: Number, default: 0 },
  reason: { 
    type: String, 
    enum: ['Breakage', 'Spoilage', 'Store Use', 'Deli', 'Stolen', 'Damaged', 'Expired', 'Donation'], 
    required: true 
  },
  isManualEntry: { type: Boolean, default: false },
  completed: { type: Boolean, default: false }
});

const WriteOffListSchema = new mongoose.Schema({
  listNumber: { type: String, unique: true, required: true }, // generated e.g., WO-7F2A
  site: { type: String, required: true },
  submittedBy: { type: String, required: true },
  status: { type: Boolean, enum: ['Incomplete', 'Partial', 'Complete'], default: 'Incomplete' },
  items: [WriteOffItemSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WriteOff', WriteOffListSchema);