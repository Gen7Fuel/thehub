const mongoose = require("mongoose");

const StatusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },         // Status name
  timestamp: { type: Date }                         // When the status was set
});

const fuelOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true, required: true },
  orderDate: { type: Date, default: Date.now },
  originalDeliveryDate: { type: Date, required: true },
  originalDeliveryWindow: {
    start: String, // e.g., "08:00"
    end: String    // e.g., "12:00"
  },
  estimatedDeliveryDate: { type: Date },
  estimatedDeliveryWindow: {
    start: String,
    end: String
  },
  rack: { type: mongoose.Schema.Types.ObjectId, ref: "FuelRack" },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "FuelSupplier" },
  badgeNo: { type: String },
  carrier: { type: mongoose.Schema.Types.ObjectId, ref: "FuelCarrier" },
  site: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
  items: [{
    grade: String,
    ltrs: Number
  }],
  currentStatus: { type: String, default: "Created" }, // Current status of the order rec
  statusHistory: {
    type: [StatusHistorySchema],
    default: [{ status: "Created", timestamp: new Date() }]
  },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model("FuelOrder", fuelOrderSchema);