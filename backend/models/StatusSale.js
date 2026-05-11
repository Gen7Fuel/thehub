const mongoose = require("mongoose");

/**
 * StatusSale Schema
 * Represents a single status card fuel sale transaction.
 * Stores the card number, pump, fuel grade, amount, total, station, and optional notes.
 */
const StatusSaleSchema = new mongoose.Schema(
  {
    statusCardNumber: {
      type: String,
      required: true,
      match: /^\d{10}$/, // Ensures exactly 10 digits for the status card number
    },
    pump: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces from the pump identifier
    },
    fuelGrade: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces from the fuel grade
    },
    amount: {
      type: Number,
      required: true, // Amount in litres
      min: 0, // Ensures non-negative values
    },
    total: {
      type: Number,
      required: true, // Total in CAD
      min: 0, // Ensures non-negative values
    },
    stationName: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces from the station name
    },
    notes: {
      type: String,
      trim: true, // Removes extra spaces from notes
      default: "", // Default value is an empty string
      required: false, // Notes are optional
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Export the StatusSale model based on the schema
module.exports = mongoose.model("StatusSale", StatusSaleSchema);