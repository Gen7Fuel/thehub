const mongoose = require('mongoose');

/**
 * CycleCountItemSchema defines the structure for a cycle count item document.
 * Each item represents an inventory count entry for a specific site and product.
 */
const CycleCountItemSchema = new mongoose.Schema({
  site: { type: String, required: true },         // Site/location identifier
  upc: { type: String },                          // UPC code (optional)
  name: { type: String, required: true },         // Item name
  category: { type: String },                     // Item category (optional)
  grade: { type: String },                        // Item grade (optional)
  gtin: { type: String },                         // GTIN code (optional)
  upc_barcode: { type: String },                  // UPC barcode (optional)
  foh: { type: Number, default: 0 },              // Front on hand quantity
  boh: { type: Number, default: 0 },              // Back on hand quantity
  updatedAt: { type: Date, default: Date.now },   // Last update timestamp
  flagged: { type: Boolean, default: false },     // Flagged status for review
  flaggedAt: { type: Date },                      // When the item was flagged
  displayDate: { type: String },                  // Format: 'YYYY-MM-DD'
  flaggedDisplayDate: { type: String },           // Format: 'YYYY-MM-DD'
});

/**
 * Static method to sort items by updatedAt (oldest first), then by category, then by name.
 * @param {Array} items - Array of cycle count items to sort.
 * @returns {Array} Sorted array of items.
 */
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

/**
 * Static method to sort flagged items by flaggedAt (oldest first).
 * Items without flaggedAt will be treated as oldest.
 * @param {Array} items - Array of flagged cycle count items to sort.
 * @returns {Array} Sorted array of flagged items.
 */
CycleCountItemSchema.statics.sortFlaggedItems = function(items) {
  return items.sort((a, b) => {
    const dateA = a.flaggedAt ? new Date(a.flaggedAt) : new Date(0);
    const dateB = b.flaggedAt ? new Date(b.flaggedAt) : new Date(0);
    return dateA - dateB;
  });
};

// Export the CycleCount model based on the schema
module.exports = mongoose.model('CycleCount', CycleCountItemSchema);