const mongoose = require('mongoose');

const AuditItemResponseSchema = new mongoose.Schema({
  text: { type: String, required: true }, // copied from template
  checked: { type: Boolean, default: false }, // user response
  photos: [{ type: String }], // URLs to uploaded photos (if any)
  comment: { type: String }, // optional comment/notes
}, { _id: false });

const AuditInstanceSchema = new mongoose.Schema({
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditTemplate', required: true },
  site: { type: String, required: true }, // or ref to Location if you prefer
  date: { type: Date, default: Date.now },
  items: [AuditItemResponseSchema], // denormalized checklist with responses
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date }
});

AuditInstanceSchema.index({ template: 1, site: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AuditInstance', AuditInstanceSchema);