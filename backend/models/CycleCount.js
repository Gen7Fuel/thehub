const mongoose = require('mongoose');

/**
 * CycleCount comments defines the structure for a cycle count comments .
 * Each item represents one comments for one cyclee count product.
 */
const CommentSchema = new mongoose.Schema({
  initials: { type: String, required: true },
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

/**
 * CycleCountItemSchema defines the structure for a cycle count item document.
 * Each item represents an inventory count entry for a specific site and product.
 */
const CycleCountItemSchema = new mongoose.Schema({
  site: { type: String, required: true },         // Site/location identifier
  upc: { type: String },                          // UPC code (optional)
  name: { type: String, required: true },         // Item name
  category: { type: String },                     // Item category (optional)
  categoryNumber: { type: Number },               // Category Number 
  active: { type: Boolean, default: true },       // Active flag: true = product active (default true)
  inventoryExists: { type: Boolean, default: true }, // Inventory exists as of yesterday (default true)
  grade: { type: String },                        // Item grade (optional)
  gtin: { type: String },                         // GTIN code (optional)
  upc_barcode: { type: String },                  // UPC barcode (optional)
  foh: { type: Number, default: 0 },              // Front on hand quantity
  boh: { type: Number, default: 0 },              // Back on hand quantity
  onHandCSO: { type: Number },        // CSO On Hand quantity
  updatedAt: { type: Date, default: Date.now },   // Last update timestamp
  flagged: { type: Boolean, default: false },     // Flagged status for review
  flaggedAt: { type: Date },                      // When the item was flagged
  displayDate: { type: String },                  // Format: 'YYYY-MM-DD'
  flaggedDisplayDate: { type: String },           // Format: 'YYYY-MM-DD'
  comments: { type: [CommentSchema], default: [] }, // Comments Schema
});

// Ensure uniqueness on site + gtin combination
CycleCountItemSchema.index({ site: 1, gtin: 1 }, { unique: true });

/**
 * Static method to sort items by updatedAt (oldest first), then by category, then by name.
 * @param {Array} items - Array of cycle count items to sort.
 * @returns {Array} Sorted array of items.
 */
// CycleCountItemSchema.statics.sortItems = function(items) {
//   return items.sort((a, b) => {
//     // First, by updatedAt (oldest first)
//     const dateDiff = new Date(a.updatedAt) - new Date(b.updatedAt);
//     if (dateDiff !== 0) return dateDiff;
//     // Then by category
//     const catDiff = (a.categoryNumber || '').localeCompare(b.categoryNumber || '');
//     if (catDiff !== 0) return catDiff;
//     // Then by name
//     return (a.name || '').localeCompare(b.name || '');
//   });
// };
CycleCountItemSchema.statics.sortItems = function (items) {
  return items.sort((a, b) => {
    // 1) Sort by updatedAt (oldest first)
    const dateDiff = new Date(a.updatedAt) - new Date(b.updatedAt);
    if (dateDiff !== 0) return dateDiff;

    // 2) Sort by categoryNumber numerically
    const aNum = a.categoryNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.categoryNumber ?? Number.MAX_SAFE_INTEGER;

    const numDiff = aNum - bNum;
    if (numDiff !== 0) return numDiff;

    // 3) Sort by name alphabetically
    return (a.name || "").localeCompare(b.name || "");
  });
};

/**
 * Static method to sort flagged items by flaggedAt (oldest first).
 * Items without flaggedAt will be treated as oldest.
 * @param {Array} items - Array of flagged cycle count items to sort.
 * @returns {Array} Sorted array of flagged items.
 */
CycleCountItemSchema.statics.sortFlaggedItems = function (items) {
  return items.sort((a, b) => {
    const dateA = a.flaggedAt ? new Date(a.flaggedAt) : new Date(0);
    const dateB = b.flaggedAt ? new Date(b.flaggedAt) : new Date(0);
    return dateA - dateB;
  });
};

// Export the CycleCount model based on the schema
module.exports = mongoose.model('CycleCount', CycleCountItemSchema);