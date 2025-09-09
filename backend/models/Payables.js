const mongoose = require('mongoose');

const payableSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['safe', 'till', 'cheque', 'on_account', 'other'],
    lowercase: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{ 
    type: String, 
    required: false 
  }]
}, {
  timestamps: true
});

// Index for efficient queries
payableSchema.index({ vendorName: 1 });
payableSchema.index({ location: 1 });

const Payable = mongoose.model('Payable', payableSchema);

module.exports = Payable;