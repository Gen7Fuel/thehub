const mongoose = require("mongoose");

const StationAuditChecklistSchema = new mongoose.Schema(
  {
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    item: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Only active checklists participate in ordering. Inactive items use null.
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
    followUp: { type: Boolean, default: false },
    commentRequired: { type: Boolean, default: false },
    requestOrderEnabled: { type: Boolean, default: false },
    suppliesVendor: { type: String, trim: true, default: "" },
    assignedSites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Only migrated checklists carry legacy identifiers. Manual checklists must
    // leave both paths absent so their null values do not collide in MongoDB.
    legacyTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditTemplate", default: undefined },
    legacyItemId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
  },
  { timestamps: true }
);

StationAuditChecklistSchema.index({ section: 1, active: 1, frequency: 1, sortOrder: 1, item: 1 });
StationAuditChecklistSchema.index({ assignedSites: 1, active: 1 });
// Keep array fields in separate indexes. MongoDB cannot create a compound
// multikey index over both assignedSites and auditTypes (parallel arrays).
StationAuditChecklistSchema.index({ auditTypes: 1, active: 1 });
StationAuditChecklistSchema.index({ department: 1, active: 1 });
StationAuditChecklistSchema.index({ statusOptionSet: 1, active: 1 });
StationAuditChecklistSchema.index(
  { legacyTemplateId: 1, legacyItemId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      legacyTemplateId: { $type: "objectId" },
      legacyItemId: { $type: "objectId" },
    },
  }
);

module.exports = mongoose.model("StationAuditChecklist", StationAuditChecklistSchema);
