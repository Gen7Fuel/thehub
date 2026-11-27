const mongoose = require("mongoose");

const StationAuditVisitorReportDispatchSchema = new mongoose.Schema(
  {
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    reportDate: { type: String, required: true, trim: true },
    visitorRuns: [{ type: mongoose.Schema.Types.ObjectId, ref: "StationAuditRun" }],
    status: {
      type: String,
      enum: ["generating", "queued", "sent", "failed"],
      default: "generating",
      required: true,
    },
    attempts: { type: Number, default: 1, min: 1 },
    queuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    emailJobId: { type: String, trim: true, default: "" },
    lastError: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

StationAuditVisitorReportDispatchSchema.index({ site: 1, reportDate: 1 }, { unique: true });
StationAuditVisitorReportDispatchSchema.index({ status: 1, updatedAt: 1 });

module.exports = mongoose.model(
  "StationAuditVisitorReportDispatch",
  StationAuditVisitorReportDispatchSchema
);
