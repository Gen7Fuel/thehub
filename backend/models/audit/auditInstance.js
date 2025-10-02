const mongoose = require('mongoose');

const AuditInstanceSchema = new mongoose.Schema({
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditTemplate', required: true },
  site: { type: String, required: true },

  frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  periodKey: { type: String, required: true }, // e.g. "2025-09-26", "2025-W39", "2025-09"

  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date }
});

// Ensure one instance per template+site+frequency+period
AuditInstanceSchema.index(
  { template: 1, site: 1, frequency: 1, periodKey: 1 }, 
  { unique: true }
);

module.exports = mongoose.model('AuditInstance', AuditInstanceSchema);