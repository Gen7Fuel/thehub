const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  itemCode: { type: String }, // optional, for GTIN/SKU/etc
  sales: { type: Number, required: true, default: 0 }, // Kept for grading calculation, hidden from UI
  grade: { type: String, enum: ['A', 'B', 'C'], default: 'A' },
  counted: { type: Boolean, default: false } // Whether this item has been counted
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  items: [ItemSchema]
});

const CycleCountSchema = new mongoose.Schema({
  filename: { type: String }, // Auto-generated in pre-save hook, not required on input
  site: { type: String, required: true },
  categories: [CategorySchema],
  date: { type: Date, default: Date.now }, // Original creation date
  assignedDate: { type: Date, required: true }, // When the cycle count was assigned
  submissionDate: { type: Date, default: null }, // When it was submitted (null if not submitted)
  submittedBy: { type: String, default: null }, // Email/name of person who submitted
  // integerId: { type: Number, unique: true },
  completed: { type: Boolean, default: false },
  
  // Day-specific fields
  week: { type: Number, required: true }, // Week number (1, 2, 3, etc.)
  dayOfWeek: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], required: true },
  dayNumber: { type: Number, required: true }, // Overall day number (1, 2, 3, etc.)
  itemCount: { type: Number, required: true } // Number of items in this day (up to 30)
});

// Update the pre-save hook for filename generation
CycleCountSchema.pre('save', async function (next) {
  // if (!this.integerId) {
  //   const last = await mongoose.model('CycleCount').findOne({}, {}, { sort: { integerId: -1 } });
  //   this.integerId = last ? last.integerId + 1 : 1;
  // }
  if (!this.filename) {
    const d = this.assignedDate || this.date || new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    this.filename = `${this.site} - Week ${this.week} - ${this.dayOfWeek} - ${dd}-${mm}-${yyyy}`;
  }
  
  // Auto-set submission date when marked as completed
  if (this.completed && !this.submissionDate) {
    this.submissionDate = new Date();
  }

  next();
});

// Add indexes for efficient querying
CycleCountSchema.index({ site: 1, week: 1, dayOfWeek: 1 });
CycleCountSchema.index({ assignedDate: 1, completed: 1 });

module.exports = mongoose.model('CycleCount', CycleCountSchema);