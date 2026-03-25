const mongoose = require("mongoose");

const fuelOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true },
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
  station: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
  items: [{
    grade: String,
    ltrs: Number
  }]
});

/**
 * PO Generation Hook
 * Format: NSP + MMDDYY + StationNumber(2 digits) + LoadCount(1 digit)
 */
fuelOrderSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    const FuelOrder = this.constructor;
    const Location = mongoose.model("Location");

    // 1. Get Station Number
    const stationDoc = await Location.findById(this.station);
    const stationNum = String(stationDoc.fuelStationNumber).padStart(2, '0');

    // 2. Format Date (MMDDYY)
    const d = this.orderDate;
    const datePart = 
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      String(d.getFullYear()).slice(-2);

    // 3. Calculate Load Count for the Original Delivery Date
    const startOfDay = new Date(this.originalDeliveryDate).setHours(0,0,0,0);
    const endOfDay = new Date(this.originalDeliveryDate).setHours(23,59,59,999);

    const loadCount = await FuelOrder.countDocuments({
      station: this.station,
      originalDeliveryDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const nextLoadDigit = loadCount + 1;

    // 4. Combine
    this.poNumber = `NSP${datePart}${stationNum}${nextLoadDigit}`;
    
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("FuelOrder", fuelOrderSchema);