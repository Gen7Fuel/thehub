const mongoose = require("mongoose");

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
  stationName: { 
    type: String, 
    required: true // Name of the station where the transaction occurred
  },
  fleetCardNumber: { 
    type: String, 
    required: false // optional now
  },
  driverName: { type: String, required: false },                   // Name of the driver (optional)
  customerName: { type: String, required: true },                   // Customer ID (optional)
  vehicleMakeModel: { type: String, required: false },  
  poNumber: {
    type: String,
    required: false, // optional new field for PO
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true // Quantity of product sold (e.g., litres)
  },
  amount: { 
    type: Number, 
    required: true // Total amount for the transaction
  },
  productCode: { 
    type: String, 
    required: true // Code of the product sold (e.g., fuel type)
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
});

// Ensure uniqueness of PO number scoped to station for PO-sourced docs with non-empty values
// Allows multiple docs without poNumber or with source !== 'PO'
transactionSchema.index(
  { stationName: 1, poNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: 'PO',
      stationName: { $exists: true, $ne: '' },
      poNumber: { $exists: true, $ne: '' },
    },
  }
)

// Export the Transaction model based on the schema
module.exports = mongoose.model("Transaction", transactionSchema);