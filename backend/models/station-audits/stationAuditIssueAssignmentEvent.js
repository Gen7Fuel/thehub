const mongoose = require("mongoose");

const StationAuditIssueAssignmentEventSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditIssue", required: true },
    previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

StationAuditIssueAssignmentEventSchema.index({ issue: 1, createdAt: 1 });
StationAuditIssueAssignmentEventSchema.index({ assignee: 1, createdAt: -1 });

module.exports = mongoose.model(
  "StationAuditIssueAssignmentEvent",
  StationAuditIssueAssignmentEventSchema
);
