const mongoose = require('mongoose');

const AuditItemSchema = new mongoose.Schema({
  instance: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditInstance', required: true },

  category: { type: String },
  item: { type: String, required: true },
  status: { type: String },
  followUp: { type: String },
  assignedTo: { type: String },
  statusTemplate: {type: String},
  followUpTemplate:{type:String},
  checked: { type: Boolean, default: false },
  checkedAt: { type: Date, default: null},
  photos: [{ type: String }],
  comment: { type: String },
  commentRequired: { type: Boolean, default: false},
  frequency: { 
    type: String, 
    enum: ["daily", "weekly", "monthly"], 
    required: true 
  },
  currentIssueStatus: { type: String },
  issueRaised: { type: Boolean },
  issueStatus: [{
    status: { type: String },
    timestamp: { type: Date, default: null},
  }],
  assignee: { type: String },
  notes: { type: String },
  requestOrder: { type: Boolean },
  suppliesVendor: { type: String },
  orderCreated: { type: Boolean, default: false },
});

// Every read in auditTemplateRoutes filters by instance, or by instance+item
// (the per-item upserts in the checklist submit loop). Leftmost prefix covers
// the instance-only queries too.
AuditItemSchema.index({ instance: 1, item: 1 });

module.exports = mongoose.model('AuditItem', AuditItemSchema);