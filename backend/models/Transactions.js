const mongoose = require("mongoose");
const { attachSiteAlias } = require("../utils/attachSiteAlias");

/**
 * Transaction Schema
 * Represents a fuel or purchase order transaction.
 * Stores details about the transaction source, date, station, fleet card, product, and payment.
 *
 * Note: Object references were not used for stationName, fleetCardNumber, and productCode
 * because refreshing the data was breaking the link.
 */
const transactionSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    enum: ["PO", "Kardpoll"] // Source of the transaction: Purchase Order or Kardpoll system
  },
  date: {
    type: Date,
    required: true // Date and time of the transaction
  },
  // Business date for PO entries only, "YYYY-MM-DD", timezone-safe.
  // `date` above is still kept in sync (derived at noon UTC) for PO docs because
  // other consumers (e.g. AR-check aggregation) read across both PO and Kardpoll
  // via `date` without a dateStr equivalent for Kardpoll. Not used for Kardpoll docs.
  dateStr: {
    type: String,
  },
  stationName: {
    type: String,
    required: true // Name of the station where the transaction occurred
  },
  site: { type: String }, // Additive alias of stationName, auto-synced
  fleetCardNumber: {
    type: String,
    required: false // optional now
  },
  driverName: { type: String, required: false },                   // Name of the driver (optional)
  customerName: { type: String, required: true },                   // Customer ID (optional)
  vehicleMakeModel: { type: String, required: false },
  licensePlate: { type: String, default: '' },
  poNumber: {
    type: String,
    required: false, // optional new field for PO
    trim: true
  },
  purchaseType: {
    type: String,
    enum: ['fuel', 'non-fuel'],
    default: 'fuel',
  },
  itemsDescription: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    required: false,
    default: 0,
  },
  amount: {
    type: Number,
    required: true // Total amount for the transaction
  },
  productCode: {
    type: String,
    required: false,
    default: '',
  },
  // customerID: { type: String, required: false }, // Optional: Customer ID (commented out)
  trx: {
    type: String,
    required: false // Optional: Transaction reference number
  },
  signature: {
    type: String,
    required: false // Optional: Base64-encoded signature image
  },
  receipt: {
    type: String,
    required: false // Optional: Base64-encoded receipt image
  },
  requestReceipt: {
    type: Boolean,
    required: false,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

// Ensure uniqueness of PO number scoped to station for PO-sourced docs with non-empty values.
// Allows multiple docs without poNumber or with source !== 'PO', and frees up the PO number
// again once the doc is soft-deleted (deletedAt set) so a corrected re-entry isn't blocked.
// Note: partialFilterExpression only supports $eq/$exists/$gt/$gte/$lt/$lte/$type/$and — no
// $ne — so "non-empty string" is expressed as $gt: '' (every non-empty string sorts after '').
transactionSchema.index(
  { stationName: 1, poNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: 'PO',
      stationName: { $exists: true, $gt: '' },
      poNumber: { $exists: true, $gt: '' },
      deletedAt: null,
    },
  }
)

// Supports PO date-range queries/filters without affecting Kardpoll docs
transactionSchema.index({ source: 1, dateStr: 1 })

attachSiteAlias(transactionSchema, "stationName");

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;