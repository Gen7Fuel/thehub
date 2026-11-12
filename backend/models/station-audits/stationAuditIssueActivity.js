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
        "priority_changed",
        "assignment_changed",
        "department_changed",
        "escalated",
        "resolved",
        "reopened",
      ],
      required: true,
    },
    // Historical legacy status entries did not record the user who made the
    // change. Live events still provide an actor; migrated system events use
    // null rather than attributing the change to the audit completer.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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
