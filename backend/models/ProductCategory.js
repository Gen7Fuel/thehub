const mongoose = require('mongoose');

const ProductCategorySchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Number: { type: Number, required: true },
  CycleCountVariance: { type: Number, default: 0 },
  OrderRecVariance: { type: Number, default: 0 }
});

// Compound index
ProductCategorySchema.index({ Name: 1, Number: 1 }, { unique: true });

module.exports = mongoose.model('ProductCategory', ProductCategorySchema);