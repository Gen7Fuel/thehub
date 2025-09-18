const mongoose = require('mongoose');

const AuditTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the template
  description: { type: String }, // Optional description
  items: [
    {
      category: { type: String },         // Category or section of the audit
      item: { type: String, required: true }, // The audit question or checklist entry
      status: { type: String },               // Status value or reference
      followUp: { type: String },             // Follow-up text or reference
      assignedTo: { type: String },           // Assigned to department or user
    }
  ],
  sites: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: who created it
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditTemplate', AuditTemplateSchema);