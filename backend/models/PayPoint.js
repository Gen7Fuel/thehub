const mongoose = require('mongoose');

/**
 * PayPoint Schema
 * Represents a pay point (e.g., a till or cash register) at a specific location.
 * Each pay point has a label and is associated with a Location.
 */
const PayPointSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces from the label
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location', // Reference to the Location model
      required: true,
    },
  },
  { 
    timestamps: true // Automatically adds createdAt and updatedAt fields
  }
);

// Export the PayPoint model based on the schema
module.exports = mongoose.model('PayPoint', PayPointSchema);