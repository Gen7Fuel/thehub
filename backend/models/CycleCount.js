const mongoose = require('mongoose');

const CycleCountItemSchema = new mongoose.Schema({
  site: { type: String, required: true },
  upc: { type: String },
  name: { type: String, required: true },
  category: { type: String },
  grade: { type: String },
  gtin: { type: String},
  upc_barcode: { type: String},
  foh: { type: Number, default: 0 }, // Front on hand
  boh: { type: Number, default: 0 }, // Back on hand
  updatedAt: { type: Date, default: Date.now },
  flagged: { type: Boolean, default: false }
});

// Static method to sort by category, name, updatedAt
CycleCountItemSchema.statics.sortItems = function(items) {
  return items.sort((a, b) => {
    // First, by updatedAt (oldest first)
    const dateDiff = new Date(a.updatedAt) - new Date(b.updatedAt);
    if (dateDiff !== 0) return dateDiff;
    // Then by category
    const catDiff = (a.category || '').localeCompare(b.category || '');
    if (catDiff !== 0) return catDiff;
    // Then by name
    return (a.name || '').localeCompare(b.name || '');
  });
};

module.exports = mongoose.model('CycleCount', CycleCountItemSchema);