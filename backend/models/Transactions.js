const mongoose = require("mongoose");

// Didn't use object reference for stationName, fleetCardNumber and productCode
// because refreshing the data was breaking the link
const transactionSchema = new mongoose.Schema({
  source: { 
    type: String, 
    required: true, 
    enum: ["PO", "Kardpoll"] // New field with validation
  },
  date: { type: Date, required: true },
  stationName: { type: String, required: true }, // New field

  fleetCardNumber: { type: String, required: true }, // New field
  quantity: { type: Number, required: true },
  amount: { type: Number, required: true },
  productCode: { type: String, required: true }, // New field

  // customerID: { type: String, required: false }, // New field
  trx: { type: String, required: false }, // New field
  signature: { type: String, required: false }, // Base64-encoded signature
  receipt: { type: String, required: false }, // Base64-encoded receipt
});

module.exports = mongoose.model("Transaction", transactionSchema);
