const mongoose = require("mongoose");

const ChangeValueSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    value: { type: String, trim: true, default: "" },
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const IssueChangeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    from: { type: ChangeValueSchema, default: () => ({}) },
    to: { type: ChangeValueSchema, default: () => ({}) },
  },
  { _id: false }
);

const StationAuditIssueActivitySchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditIssue", required: true },
    eventType: {
      type: String,
      enum: [
        "issue_raised",
        "comment_added",
        "photos_added",
        "status_changed",
        "assignment_changed",
        "department_changed",
        "escalated",
        "resolved",
        "reopened",
      ],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, trim: true, default: "", maxlength: 5000 },
    photos: [{ type: String, trim: true }],
    changes: { type: [IssueChangeSchema], default: [] },
    dedupeKey: { type: String, trim: true },
  },
  { timestamps: true }
);

StationAuditIssueActivitySchema.index({ issue: 1, createdAt: 1 });
StationAuditIssueActivitySchema.index({ actor: 1, createdAt: -1 });
StationAuditIssueActivitySchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("StationAuditIssueActivity", StationAuditIssueActivitySchema);
