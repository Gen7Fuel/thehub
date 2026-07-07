const mongoose = require('mongoose');

const CsoInvoiceSchema = new mongoose.Schema({
  siteMongoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true // Kept basic index just for quick filtering on the main dashboard list view
  },
  submittedByMongoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 🚀 Updated: Stored as a clean 'YYYY-MM-DD' string to avoid UTC time-zone shifts
  invoiceDate: {
    type: String,
    required: true,
    trim: true
  },
  vendorCode: {
    type: String,
    required: true,
    trim: true
  },
  vendorName: { 
    type: String,
    required: true,
    trim: true
  },
  docNumber: {
    type: String,
    required: true,
    trim: true
  },
  methodOfPayment: {
    type: String,
    required: true,
    enum: ['cash', 'credit', 'check', 'money_order', 'eft', 'credit_card']
  },
  checkNumber: {
    type: String,
    trim: true,
    default: null
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  images: {
    type: [String],
    validate: [v => v.length > 0, 'At least one invoice image is required.']
  },
  status: {
    type: String,
    enum: ['pending_api_upload', 'uploaded_to_cso', 'failed_cso_upload'],
    default: 'pending_api_upload',
    index: true
  },
  csoUploadError: {
    type: String,
    default: null
  }
}, {
  timestamps: true 
});

// 🚀 Removed all unique or compound constraints that would block double uploads 
// or failed re-attempts under the same document parameter footprint.

module.exports = mongoose.model('CsoInvoice', CsoInvoiceSchema);