const mongoose = require('mongoose');

/**
 * Payable Schema
 * Represents a payable entry for a vendor at a specific location.
 * Stores payment details, notes, and optional supporting images.
 */
const payableSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: true,
    trim: true // Removes leading/trailing whitespace
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true // References the Location model
  },
  notes: {
    type: String,
    trim: true,
    default: '' // Optional notes about the payable
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['safe', 'till', 'cheque', 'on_account', 'other'], // Allowed payment methods
    lowercase: true // Store as lowercase
  },
  amount: {
    type: Number,
    required: true,
    min: 0 // Amount must be non-negative
  },
  images: [{ 
    type: String, 
    required: false // Optional array of image URLs or paths
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Indexes for efficient queries by vendorName and location
payableSchema.index({ vendorName: 1 });
payableSchema.index({ location: 1 });

// Create and export the Payable model
const Payable = mongoose.model('Payable', payableSchema);

module.exports = Payable;