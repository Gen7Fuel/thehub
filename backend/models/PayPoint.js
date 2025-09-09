const mongoose = require('mongoose');

const PayPointSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true, // Removes extra spaces
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location', // Reference to the Location model
      required: true,
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

module.exports = mongoose.model('PayPoint', PayPointSchema);