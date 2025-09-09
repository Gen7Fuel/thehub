const mongoose = require("mongoose");

const fleetCustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: false },
}, {
  timestamps: true // adds createdAt and updatedAt fields
});

module.exports = mongoose.model("FleetCustomer", fleetCustomerSchema);