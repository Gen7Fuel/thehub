const mongoose = require('mongoose');

const WriteOffCartItemSchema = new mongoose.Schema({
  gtin: { type: String, trim: true },
  upc_barcode: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  image_url: { type: String, trim: true },
  qty: { type: Number, required: true, min: 1 },
  onHandAtWriteOff: { type: Number, default: 0 },
  reason: {
    type: String,
    enum: ['Breakage', 'Spoilage', 'Store Use', 'Deli', 'Stolen', 'Damaged', 'Expired', 'Donation', 'About to Expire'],
    required: true,
  },
  isManualEntry: { type: Boolean, default: false },
  expiryDate: { type: Date },
  markdownAction: {
    type: String,
    enum: ['Marked Down', 'No Markdown Needed', null],
    default: null,
  },
}, { _id: true });

const WriteOffCartSchema = new mongoose.Schema({
  // One draft cart is maintained for each station/site.
  site: { type: String, required: true, trim: true },
  items: {
    type: [WriteOffCartItemSchema],
    default: [],
    validate: {
      validator: (items) => items.length <= 100,
      message: 'A write-off cart cannot contain more than 100 items.',
    },
  },
}, { timestamps: true });

WriteOffCartSchema.index({ site: 1 }, { unique: true });

module.exports = mongoose.model('WriteOffCart', WriteOffCartSchema);
