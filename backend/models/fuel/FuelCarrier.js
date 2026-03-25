const mongoose = require("mongoose");

const fuelCarrierSchema = new mongoose.Schema({
  carrierName: { type: String, required: true },
  carrierId: { type: String, required: true, unique: true },
  associatedRacks: [{ type: mongoose.Schema.Types.ObjectId, ref: "FuelRack" }]
});

module.exports = mongoose.model("FuelCarrier", fuelCarrierSchema);