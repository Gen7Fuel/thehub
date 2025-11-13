const mongoose = require('mongoose');

// Define the sales entry Schema
const salesEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, required: true },
  kardpollLitresSold: { type: Number, required: false },
  kardpollSales: { type: Number, required: false },
  kardpollAR: { type: Number, required: false },
  dealGroupCPLDiscounts: { type: Number, required: false },
  unsettledPrepays: { type: Number, required: false },
  itemSales: { type: Number, required: true },
  totalSales: { type: Number, required: true },
  fuelSales: { type: Number, required: true },
  afdGC: { type: Number, required: false },
  totalPOS: { type: Number, required: true },
  kioskGC: { type: Number, required: false },
  ar: { type: Number, required: false },
  payouts: { type: Number, required: false },
  missedCPL: { type: Number, required: false },
  coupons: { type: Number, required: false },
  cashBacks: { type: Number, required: false },
  cdnCash: { type: Number, required: false },
  handHeldDebit: { type: Number, required: false },
  bankSlip: { type: Number, required: false },
  dailyBankStmtBalance: { type: Number, required: false },
  cashDepositedDate: { type: Date, required: false },
  till: { type: Number, required: false },
  balanceCheck: { type: Number, required: false },
  bankStmtTrans: { type: Number, required: false },
  bankRec: { type: Number, required: false },
  notes: { type: String, required: false },
});

// Define the parent CashRec schema
const cashRecSchema = new mongoose.Schema({
  site: { type: String, required: true, unique: true }, // Make site unique
  entries: [salesEntrySchema], // Array of sales entries
});

// Create the model
module.exports = mongoose.model('CashRec', cashRecSchema);
