const mongoose = require("mongoose");

/**
 * Location Schema
 * Represents a physical or legal location (station/site) in the system.
 * Each document stores identifying and contact information for a location.
 */
const locationSchema = new mongoose.Schema({
  type: { type: String, required: true },             // Type of location (e.g., "station", "office")
  stationName: { type: String, required: true },      // Display name of the station/location
  legalName: { type: String, required: true },        // Legal name of the entity
  INDNumber: { type: String, required: true, unique: true }, // Unique IND number for the location
  kardpollCode: { type: String, required: false },    // Kardpoll system code (optional)
  csoCode: { type: String, required: true, unique: true },   // Unique CSO code for the location
  timezone: { type: String, required: true },         // Timezone of the location
  email: { type: String, required: true },          // Contact email for the location
  managerCode: { type: Number, required: true },    // Four digit code for manager's dashboard
  // Indicates whether this site sells lottery tickets and therefore requires
  // a lottery reconciliation to be provided when submitting daily reports.
  sellsLottery: { type: Boolean, default: false },
  safeMaxBalance: { type: Number, default: 25000 }, // Maximum safe balance for the location
});

// Export the Location model based on the schema
module.exports = mongoose.model("Location", locationSchema);