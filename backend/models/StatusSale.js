const mongoose = require("mongoose");

const StatusSaleSchema = new mongoose.Schema(
  {
    statusCardNumber: {
      type: String,
      required: true,
      match: /^\d{10}$/, // Ensures exactly 10 digits
    },
    pump: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces
    },
    fuelGrade: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces
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
      trim: true, // Removes extra spaces
    },
    notes: {
      type: String,
      trim: true, // Removes extra spaces
      default: "", // Default value is an empty string
      required: false, // Not required
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

module.exports = mongoose.model("StatusSale", StatusSaleSchema);