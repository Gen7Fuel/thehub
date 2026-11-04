const mongoose = require("mongoose");

const StationAuditSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0, min: 0 },
    sites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true }],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    legacyTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditTemplate", default: null },
  },
  { timestamps: true }
);

StationAuditSectionSchema.index({ active: 1, sortOrder: 1, name: 1 });
StationAuditSectionSchema.index({ sites: 1, active: 1 });
StationAuditSectionSchema.index({ legacyTemplateId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("StationAuditSection", StationAuditSectionSchema);
