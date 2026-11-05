const mongoose = require("mongoose");

const StationAuditChecklistSchema = new mongoose.Schema(
  {
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    item: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0, min: 0 },
    category: { type: String, trim: true, default: "" },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    auditTypes: {
      type: [{ type: String, enum: ["store", "visitor"] }],
      default: ["store", "visitor"],
      validate: {
        validator(values) {
          return values.length > 0 && values.length === new Set(values).size;
        },
        message: "Checklist audit types must be unique and cannot be empty",
      },
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
    statusOptionSet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StationAuditStatusOptionSet",
      required: true,
    },
    followUpInstructions: { type: String, trim: true, default: "" },
    commentRequired: { type: Boolean, default: false },
    requestOrderEnabled: { type: Boolean, default: false },
    suppliesVendor: { type: String, trim: true, default: "" },
    assignedSites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    legacyTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditTemplate", default: null },
    legacyItemId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

StationAuditChecklistSchema.index({ section: 1, active: 1, frequency: 1, sortOrder: 1, item: 1 });
StationAuditChecklistSchema.index({ assignedSites: 1, active: 1 });
// Keep array fields in separate indexes. MongoDB cannot create a compound
// multikey index over both assignedSites and auditTypes (parallel arrays).
StationAuditChecklistSchema.index({ auditTypes: 1, active: 1 });
StationAuditChecklistSchema.index({ department: 1, active: 1 });
StationAuditChecklistSchema.index(
  { legacyTemplateId: 1, legacyItemId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("StationAuditChecklist", StationAuditChecklistSchema);
