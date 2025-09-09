const mongoose = require('mongoose');

// Item Schema - represents individual items that can be counted
const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gtin: { type: String }, // Global Trade Item Number (barcode)
  sales: { type: Number, default: 0 }, // Sales data for grading
  cumulative_sales: { type: Number, default: 0 }, // Cumulative sales for percentage calculation
  grade: { type: String, enum: ['A', 'B', 'C'], default: 'A' }, // Item grade based on sales
  categories: { type: String }, // Category the item belongs to
  site: { type: String, required: true }, // Site where this item is located
  last_counted: { type: Date, default: null }, // When this item was last counted
  pinned: { type: Boolean, default: false }, // Whether this item is pinned for quick access
  foh: { type: Number, default: 0 }, // Front on hand stock
  boh: { type: Number, default: 0 } // Back on hand stock
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Cycle Schema - represents a cycle count period/schedule
const CycleSchema = new mongoose.Schema({
  start_date: { type: Date, required: true }, // When the cycle starts
  end_date: { type: Date, required: true }, // When the cycle ends
  completed: { type: Boolean, default: false }, // Whether the cycle is completed
  site: { type: String, required: true } // Site where the cycle is happening
}, {
  timestamps: true
});

// Note Schema - for adding notes to cycles or counts
const NoteSchema = new mongoose.Schema({
  cycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true }, // Links to Cycle
  description: { type: String, required: true }, // Note content
  createdAt: { type: Date, default: Date.now } // When the note was created
});

// Add indexes for efficient querying
ItemSchema.index({ gtin: 1, site: 1 }, { unique: true }); // Compound unique index
ItemSchema.index({ grade: 1, categories: 1 });
ItemSchema.index({ site: 1 });

CycleSchema.index({ site: 1, start_date: 1 });
CycleSchema.index({ completed: 1 });

CountSchema.index({ cycle: 1, gtin: 1 });
CountSchema.index({ counted: 1, flagged: 1 });

NoteSchema.index({ cycle: 1, createdAt: -1 });

// Export models
const Item = mongoose.model('Item', ItemSchema);
const Cycle = mongoose.model('Cycle', CycleSchema);
const Count = mongoose.model('Count', CountSchema);
const Note = mongoose.model('Note', NoteSchema);

module.exports = {
  Item,
  Cycle,
  Count,
  Note
};
