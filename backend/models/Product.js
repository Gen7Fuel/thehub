const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String, required: true },
  kardpollCode: { type: String, required: false },
});

module.exports = mongoose.model("Product", productSchema);

// This is for storing the six types of fuel that we sell. There will be a seed.js file that will populate this collection.
