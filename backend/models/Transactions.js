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
  noFleetCard: {
    type: Boolean,
    default: false // true = customer confirmed they did not have their fleet card
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
  // Set only on PO docs whose station enforces per-station PO-number uniqueness.
  // Exists purely to drive the partial unique index below: partialFilterExpression
  // cannot express "stationName not in [...]" ($nin unsupported), so the route
  // stamps this $eq-able marker at write time. See backend/constants/poSites.js.
  // Deliberately has no default — it must be genuinely absent on exempt docs so
  // the partial filter skips them.
  poUniqueEnforced: {
    type: Boolean,
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
  // Which physical register/till at the site the PO was rung through. Only
  // collected at creation time (see backend/routes/purchaseOrder.js POST /) —
  // not cross-validated against the site's configured Location.registers list.
  register: {
    type: String,
    required: false,
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
//
// `poUniqueEnforced: true` is what exempts a site: partialFilterExpression only supports
// $eq/$exists/$gt/$gte/$lt/$lte/$type/$and — no $ne/$nin — so "unique except at these
// stations" can't be written directly. Instead the route stamps this marker on writes whose
// station enforces uniqueness, and omits it for the sites listed in backend/constants/poSites.js
// (Wavers West / Wavers East, whose externally issued PO books recycle numbers); docs without
// the marker simply fall outside this index. The same $-operator limitation is why "non-empty
// string" is expressed as $gt: '' (every non-empty string sorts after '').
//
// Named explicitly: the auto-derived name (stationName_1_poNumber_1) belongs to the older
// marker-less version of this index, and recreating that name with different options throws
// IndexOptionsConflict, which Mongoose's autoIndex swallows silently. Deployments carrying the
// old index need backend/manual/backfillPoUniqueEnforced.js to backfill and swap them over.
transactionSchema.index(
  { stationName: 1, poNumber: 1 },
  {
    name: 'po_station_number_unique_enforced',
    unique: true,
    partialFilterExpression: {
      source: 'PO',
      poUniqueEnforced: true,
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