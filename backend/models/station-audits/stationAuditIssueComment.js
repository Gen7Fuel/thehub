const mongoose = require("mongoose");

const StationAuditIssueCommentSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditIssue", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
    attachments: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

StationAuditIssueCommentSchema.index({ issue: 1, createdAt: 1 });

module.exports = mongoose.model("StationAuditIssueComment", StationAuditIssueCommentSchema);
