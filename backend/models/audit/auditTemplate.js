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
      suppliesVendor: { type: String },
      frequency: { 
        type: String, 
        enum: ["daily", "weekly", "monthly"], 
        default: "daily" 
      },
      assignedSites:[{
        site: { type: String, required: true },
        assigned: { type: Boolean, default: false },
        issueRaised: { type: Boolean, default: false },
        lastChecked: { type: Date, default: null }  // moved here
      }]
    }
  ],
  sites: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditTemplate', AuditTemplateSchema);
