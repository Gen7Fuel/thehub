const mongoose = require("mongoose");

// DELETE FILE
const permissionsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  modules: [{ type: String, required: true }], // List of accessible modules
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true }] // List of accessible locations
});

module.exports = mongoose.model("Permissions", permissionsSchema);