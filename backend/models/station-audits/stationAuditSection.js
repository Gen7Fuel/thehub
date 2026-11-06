const mongoose = require("mongoose");

const StationAuditSectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Only active sections participate in ordering. Archived sections use null.
    sortOrder: { type: Number, default: 0, min: 0 },
    sectionType: {
      type: String,
      enum: ["checklist", "order"],
      default: "checklist",
      required: true,
    },
    sites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true }],
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment" }],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Manual sections must omit this field. An explicit null participates in
    // MongoDB's sparse unique index and would allow only one manual section.
    legacyTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditTemplate" },
  },
  { timestamps: true }
);

StationAuditSectionSchema.index({ active: 1, sectionType: 1, sortOrder: 1, name: 1 });
StationAuditSectionSchema.index({ sites: 1, active: 1 });
StationAuditSectionSchema.index({ departments: 1, active: 1 });
StationAuditSectionSchema.index({ legacyTemplateId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("StationAuditSection", StationAuditSectionSchema);
