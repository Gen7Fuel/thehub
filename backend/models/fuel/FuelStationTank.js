const mongoose = require("mongoose");

const fuelStationTankSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
  tankNo: { type: Number, required: true },
  grade: { type: String, required: true }, // e.g., "Regular"
  tankCapacity: { type: Number, required: true },
  maxVolumeCapacity: { type: Number, required: true }, // Max empty space allowed
  minVolumeCapacity: { type: Number, required: true }, // Min empty space allowed
  currentVolume: { type: Number, default: 0 },
  lastUpdatedVolumeReadingDateTime: { type: String },
  historicalVolume: [{                      // Historical ledger for opening/closing tracking
    date: { type: Date, required: true },
    openingVolume: { type: Number, required: true },
    closingVolume: { type: Number, required: true }
  }]
});

module.exports = mongoose.model("FuelStationTank", fuelStationTankSchema);