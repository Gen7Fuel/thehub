const mongoose = require("mongoose");

const StatusCustomerSchema = new mongoose.Schema({
  statusCardNumber: {
    type: String,
    required: true,
    match: /^\d{10}$/, // Ensures exactly 10 digits
    unique: true, // Ensures no duplicate status card numbers
  },
  name: {
    type: String,
    required: true,
    trim: true, // Removes extra spaces
  },
  phone: {
    type: String,
    required: false,
    match: /^\d{10}$/, // Ensures exactly 10 digits for phone number
  },
}, { timestamps: true }); // Adds createdAt and updatedAt fields

module.exports = mongoose.model("StatusCustomer", StatusCustomerSchema);