const mongoose = require("mongoose");

const GasBuddySessionSchema = new mongoose.Schema({
  key: { type: String, default: "production_session", unique: true },
  stateData: { type: Object, required: true }, // Stores the raw Playwright storageState JSON
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GasBuddySession", GasBuddySessionSchema);