const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  stationName: { type: String, required: true },
  legalName: { type: String, required: true },
  INDNumber: { type: String, required: true, unique: true },
  kardpollCode: { type: String, required: false },
  csoCode: { type: String, required: true, unique: true },
  timezone: { type: String, required: true },
  email: { type: String, required: true }
});

module.exports = mongoose.model("Location", locationSchema);
