const mongoose = require("mongoose");

const StationAuditIssueSchema = new mongoose.Schema(
  {
    response: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditResponse", required: true },
    run: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditRun", required: true },
    checklist: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditChecklist", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    snapshot: {
      sectionName: { type: String, required: true },
      checklistItem: { type: String, required: true },
      category: { type: String, default: "" },
      departmentName: { type: String, required: true },
      statusKey: { type: String, default: "" },
      statusLabel: { type: String, default: "" },
      originalComment: { type: String, default: "" },
      originalPhotos: [{ type: String }],
    },
    status: {
      type: String,
      enum: ["created", "in_progress", "on_hold", "resolved"],
      default: "created",
      required: true,
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    previousIssue: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditIssue", default: null },
    occurrenceNumber: { type: Number, min: 1, default: 1 },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raisedAt: { type: Date, default: Date.now },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StationAuditIssueSchema.index({ assignee: 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ department: 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ site: 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ checklist: 1, site: 1, raisedAt: -1 });
StationAuditIssueSchema.index({ response: 1 }, { unique: true });

module.exports = mongoose.model("StationAuditIssue", StationAuditIssueSchema);
