const mongoose = require("mongoose");

/**
 * FleetCustomer Schema
 * Represents a customer associated with a fleet.
 * Each document stores the customer's name and email.
 */
const fleetCustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },   // Customer's name
  email: { type: String, required: true, unique: false }, // Customer's email address (not unique)
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Export the FleetCustomer model based on the schema
module.exports = mongoose.model("FleetCustomer", fleetCustomerSchema);