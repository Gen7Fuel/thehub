const mongoose = require("mongoose");

/**
 * Product Schema
 * Represents a fuel product sold by the company.
 * Each product has a code, description, and optional Kardpoll system code.
 * This collection is intended to store the six types of fuel sold.
 * The collection will be populated using a seed.js script.
 */
const productSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true // Unique product code (e.g., "DIESEL", "REGULAR")
  },
  description: { 
    type: String, 
    required: true // Human-readable description of the product
  },
  kardpollCode: { 
    type: String, 
    required: false // Optional code for integration with Kardpoll system
  },
});

// Export the Product model based on the schema
module.exports = mongoose.model("Product", productSchema);