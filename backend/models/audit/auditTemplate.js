const mongoose = require('mongoose');

const AuditTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  items: [
    {
      category: { type: String },
      item: { type: String, required: true },
      status: { type: String },
      followUp: { type: String },
      assignedTo: { type: String },
      frequency: { 
        type: String, 
        enum: ["daily", "weekly", "monthly"], 
        default: "daily" 
      }
    }
  ],
  sites: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditTemplate', AuditTemplateSchema);