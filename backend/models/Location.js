const mongoose = require("mongoose");
const { attachSiteAlias } = require("../utils/attachSiteAlias");

// Define a clean sub-schema for granular device control
const pushoverDeviceSchema = new mongoose.Schema({
  deviceName: { type: String, required: true },
  notificationEnabled: { type: Boolean, default: true }
});

const locationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  stationName: { type: String, required: true },
  site: { type: String },
  legalName: { type: String, required: true },
  INDNumber: { type: String, required: true, unique: true },
  kardpollCode: { type: String, required: false },
  csoCode: { type: String, required: true, unique: true },
  timezone: { type: String, required: true },
  email: { type: String, required: true },
  managerEmails: [{ type: String }],
  managerCode: { type: Number, required: true },
  sellsLottery: { type: Boolean, default: false },
  chickenDelightSection: { type: Boolean, default: false },
  safeMaxBalance: { type: Number, default: 25000 },
  fuelStationNumber: { type: String, unique: true },
  fuelCustomerName: { type: String },
  address: { type: String },
  province: { type: String, required: true},
  defaultFuelRack: { type: mongoose.Schema.Types.ObjectId, ref: "FuelRack" },
  defaultFuelCarrier: { type: mongoose.Schema.Types.ObjectId, ref: "FuelCarrier" },
  availableGrades: [{ type: String, default: [] }],
  gasBuddyStationId: { type: String, required: false },

  // --- Pushover Core Extensions ---
  pushOverUserKey: { type: String, default: null }, 
  devices: [pushoverDeviceSchema]
});

attachSiteAlias(locationSchema, "stationName");

module.exports = mongoose.model("Location", locationSchema);