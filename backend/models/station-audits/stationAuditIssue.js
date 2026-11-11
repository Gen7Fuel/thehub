const mongoose = require("mongoose");

const IssueAssigneeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "collaborator"], default: "collaborator" },
    // null means the assignment was produced automatically when the issue was raised.
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const StationAuditIssueSchema = new mongoose.Schema(
  {
    response: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditResponse", required: true },
    run: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditRun", required: true },
    checklist: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditChecklist", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    originDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
    currentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
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
    assignees: {
      type: [IssueAssigneeSchema],
      default: [],
      validate: {
        validator(entries) {
          const users = entries.map((entry) => entry.user.toString());
          return users.length === new Set(users).size;
        },
        message: "A user can only be assigned to an issue once",
      },
    },
    escalation: {
      level: {
        type: String,
        enum: ["none", "department", "head_office"],
        default: "none",
      },
      escalatedAt: { type: Date, default: null },
      escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, trim: true, default: "" },
    },
    previousIssue: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditIssue", default: null },
    occurrenceNumber: { type: Number, min: 1, default: 1 },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raisedAt: { type: Date, default: Date.now },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StationAuditIssueSchema.index({ "assignees.user": 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ currentDepartment: 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ site: 1, status: 1, updatedAt: -1 });
StationAuditIssueSchema.index({ checklist: 1, site: 1, raisedAt: -1 });
StationAuditIssueSchema.index({ response: 1 }, { unique: true });

module.exports = mongoose.model("StationAuditIssue", StationAuditIssueSchema);
