const mongoose = require('mongoose');

// Item: Master list of items per site/category
const ItemSchema = new mongoose.Schema({
  upc: { type: String, required: true },
  site: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  sales: { type: Number, default: 0 },
  cumulativeSales: { type: Number, default: 0 },
  grade: { type: String, enum: ['A', 'B', 'C'], required: true },
  // Add other fields as needed
}, { timestamps: true });

ItemSchema.index({ upc: 1, site: 1 }, { unique: true });

const CycleDaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  completed: { type: Boolean, default: false },
}, { _id: false });

// Cycle: Represents a cycle count event for a site
const CycleSchema = new mongoose.Schema({
  site: { type: String, required: true, set: (v) => v.replace(/ Gen 7$/, '').replace(/ Gen7$/, '') },
  startDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  days: [CycleDaySchema],
}, { timestamps: true });

// CycleItem: Links an item to a cycle and stores counts
const CycleItemSchema = new mongoose.Schema({
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true },
  upc: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  grade: { type: String, enum: ['A', 'B', 'C'], required: true },
  foh: { type: Number, default: 0 }, // Front on hand
  boh: { type: Number, default: 0 }, // Back on hand
  completed: { type: Boolean, default: false },
  // You can add fields like countedBy, notes, etc. if needed
}, { timestamps: true });

CycleItemSchema.index({ cycleId: 1, upc: 1 }, { unique: true });

module.exports = {
  Item: mongoose.model('Item', ItemSchema),
  Cycle: mongoose.model('Cycle', CycleSchema),
  CycleItem: mongoose.model('CycleItem', CycleItemSchema),
};