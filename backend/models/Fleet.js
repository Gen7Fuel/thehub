const mongoose = require("mongoose");

const fleetSchema = new mongoose.Schema({
  fleetCardNumber: { type: String, required: true, unique: true },
  driverName: { type: String, required: false },
  customerName: { type: String, required: true },
  customerId: { type: String, required: false }, // may not be required
  vehicleMakeModel: { type: String, required: false },
  customerEmail: { type: String, required: false },
  signature: { type: String, required: false }, // Base64-encoded signature
});

module.exports = mongoose.model("Fleet", fleetSchema);