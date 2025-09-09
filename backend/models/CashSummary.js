const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// Define sub-schemas for nested objects
const ARSchema = new Schema({
  name: { type: String, required: true },
  po: { type: String, required: true },
  amount: { type: Number, required: true },
});

const PayoutSchema = new Schema({
  name: { type: String, required: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
});

const APSchema = new Schema({
  name: { type: String, required: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
});

// Define the main CashSummary schema
const CashSummarySchema = new Schema({
  name: { type: String, default: '', required: true },
  hand_held_debit: { type: Number, default: 0.0 },
  managers_notes: { type: String, default: '' },
  date: { type: Date, required: true }, // Added date field
  location: { type: String, required: true }, // Added location field
  ar: { type: [ARSchema], default: [] }, // Accounts Receivable
  payout: { type: [PayoutSchema], default: [] }, // Payouts
  ap: { type: [APSchema], default: [] }, // Accounts Payable
}, { timestamps: true });

module.exports = mongoose.model('CashSummary', CashSummarySchema);