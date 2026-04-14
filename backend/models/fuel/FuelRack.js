const mongoose = require("mongoose");

const fuelRackSchema = new mongoose.Schema({
  rackName: { type: String, required: true },
  rackLocation: { type: String, required: true },
  availableGrades: [{ type: String }], // e.g., ["Regular", "Premium", "Diesel"]
  defaultSupplier: { type: mongoose.Schema.Types.ObjectId, ref: "FuelSupplier" },
  associatedCarriers: [{ type: mongoose.Schema.Types.ObjectId, ref: "FuelCarrier" }]
});

module.exports = mongoose.model("FuelRack", fuelRackSchema);