const mongoose = require("mongoose");

/**
 * Fleet Schema
 * Represents a fleet card and its associated driver and customer information.
 * Each document corresponds to a unique fleet card.
 */
const fleetSchema = new mongoose.Schema({
  fleetCardNumber: { type: String, required: true, unique: true }, // Unique fleet card number
  driverName: { type: String, required: false },                   // Name of the driver (optional)
  customerName: { type: String, required: true },                  // Name of the customer
  customerId: { type: String, required: false },                   // Customer ID (optional)
  vehicleMakeModel: { type: String, required: false },             // Vehicle make and model (optional)
  customerEmail: { type: String, required: false },                // Customer email (optional)
  signature: { type: String, required: false },                    // Base64-encoded signature (optional)
});

// Export the Fleet model based on the schema
module.exports = mongoose.model("Fleet", fleetSchema);