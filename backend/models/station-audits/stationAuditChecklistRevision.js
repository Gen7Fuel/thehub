const mongoose = require("mongoose");

const ChecklistRevisionSnapshotSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: null, min: 0 },
    category: { type: String, trim: true, default: "" },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    auditTypes: [{ type: String, enum: ["store", "visitor"], required: true }],
    department: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
    statusOptionSet: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditStatusOptionSet", required: true },
    followUp: { type: Boolean, default: false },
    commentRequired: { type: Boolean, default: false },
    requestOrderEnabled: { type: Boolean, default: false },
    suppliesVendor: { type: String, trim: true, default: "" },
    assignedSites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const StationAuditChecklistRevisionSchema = new mongoose.Schema(
  {
    checklist: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditChecklist", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    version: { type: String, required: true, trim: true, match: /^v[1-9]\d*\.[0-9]$/ },
    current: { type: Boolean, default: false, required: true },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date, default: null },
    snapshot: { type: ChecklistRevisionSnapshotSchema, required: true },
    scopeKeys: [{ type: String, trim: true }],
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changeType: {
      type: String,
      enum: ["created", "updated", "deactivated", "reactivated", "migrated"],
      default: "updated",
      required: true,
    },
  },
  { timestamps: true }
);

StationAuditChecklistRevisionSchema.index({ checklist: 1, version: 1 }, { unique: true });
StationAuditChecklistRevisionSchema.index(
  { checklist: 1, current: 1 },
  { unique: true, partialFilterExpression: { current: true } }
);
StationAuditChecklistRevisionSchema.index({ section: 1, "snapshot.frequency": 1, effectiveFrom: -1 });
StationAuditChecklistRevisionSchema.index({ section: 1, scopeKeys: 1, effectiveFrom: -1 });
StationAuditChecklistRevisionSchema.index({ effectiveTo: 1 });

module.exports = mongoose.model(
  "StationAuditChecklistRevision",
  StationAuditChecklistRevisionSchema
);
