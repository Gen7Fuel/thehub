const mongoose = require('mongoose');

const AuditTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the template
  description: { type: String }, // Optional description
  items: [
    {
      text: { type: String, required: true }, // The audit question or checklist entry
    }
  ],
  sites: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: who created it
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditTemplate', AuditTemplateSchema);