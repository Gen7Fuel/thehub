const mongoose = require("mongoose");

const fuelCarrierSchema = new mongoose.Schema({
  carrierName: { type: String, required: true, unique: true },
  carrierId: { type: String, required: true },
  contact: { type: String },
  contactName: { type: String },
  toEmails: [{ type: String }],
  ccEmails: [{ type: String }],
  associatedRacks: [{ type: mongoose.Schema.Types.ObjectId, ref: "FuelRack" }]
});

module.exports = mongoose.model("FuelCarrier", fuelCarrierSchema);