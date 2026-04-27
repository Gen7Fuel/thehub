const mongoose = require("mongoose");

const fuelSupplierSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  associatedRack: { type: mongoose.Schema.Types.ObjectId, ref: "FuelRack", required: true },
  supplierBadges: [{
    badgeName: String,
    badgeNumber: String,
    accountingId: String,
    isDefault: { type: Boolean, default: false }
  }]
});

// Compound unique index to ensure a supplier name is unique per rack
fuelSupplierSchema.index({ supplierName: 1, associatedRack: 1 }, { unique: true });

module.exports = mongoose.model("FuelSupplier", fuelSupplierSchema);