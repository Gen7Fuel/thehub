const mongoose = require("mongoose");

/**
 * StatusCustomer Schema
 * Represents a customer with a status card.
 * Stores the status card number, customer name, and optional phone number.
 */
const StatusCustomerSchema = new mongoose.Schema({
  statusCardNumber: {
    type: String,
    required: true,
    match: /^\d{10}$/, // Ensures exactly 10 digits
    unique: true,      // Ensures no duplicate status card numbers
  },
  name: {
    type: String,
    required: true,
    trim: true,        // Removes extra spaces
  },
  phone: {
    type: String,
    required: false,
    match: /^\d{10}$/, // Ensures exactly 10 digits for phone number
  },
}, { 
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Export the StatusCustomer model based on the schema
module.exports = mongoose.model("StatusCustomer", StatusCustomerSchema);