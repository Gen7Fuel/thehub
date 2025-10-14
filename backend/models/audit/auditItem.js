const mongoose = require('mongoose');

const AuditItemSchema = new mongoose.Schema({
  instance: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditInstance', required: true },

  category: { type: String },
  item: { type: String, required: true },
  status: { type: String },
  followUp: { type: String },
  assignedTo: { type: String },

  checked: { type: Boolean, default: false },
  checkedAt: { type: Date, default: null},
  photos: [{ type: String }],
  comment: { type: String },
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
  requestOrder: { type: Boolean },
  suppliesVendor: { type: String }
});

module.exports = mongoose.model('AuditItem', AuditItemSchema);