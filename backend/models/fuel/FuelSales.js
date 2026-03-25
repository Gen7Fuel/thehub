const mongoose = require("mongoose");

const fuelSalesSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
  date: { type: Date, required: true },
  dayOfWeek: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  // Array to support multiple grades per day
  salesData: [{
    grade: { type: String, required: true },
    volume: { type: Number, default: 0 }
  }],
  isLive: { type: Boolean, default: true }
});

// Indexing for faster lookups when calculating averages
fuelSalesSchema.index({ stationId: 1, date: -1 });

module.exports = mongoose.model("FuelSales", fuelSalesSchema);