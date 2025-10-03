const mongoose = require('mongoose');

const AuditItemSchema = new mongoose.Schema({
  instance: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditInstance', required: true },

  category: { type: String },
  item: { type: String, required: true },
  status: { type: String },
  followUp: { type: String },
  assignedTo: { type: String },

  checked: { type: Boolean, default: false },
  photos: [{ type: String }],
  comment: { type: String },
  frequency: { 
    type: String, 
    enum: ["daily", "weekly", "monthly"], 
    required: true 
  },
  issueRaised: { type: String },
  issueStatus: [{
    status: { type: String },
    timestamp: { type: Date, default: null},
  }]
});

module.exports = mongoose.model('AuditItem', AuditItemSchema);