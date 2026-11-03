const mongoose = require("mongoose");

const StationAuditRunSchema = new mongoose.Schema(
  {
    section: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditSection", required: true },
    sectionSnapshot: {
      name: { type: String, required: true },
      description: { type: String, default: "" },
    },
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    periodKey: { type: String, required: true, trim: true },
    type: { type: String, enum: ["store", "visitor"], default: "store", required: true },
    state: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StationAuditRunSchema.index(
  { section: 1, site: 1, frequency: 1, periodKey: 1, type: 1 },
  { unique: true }
);
StationAuditRunSchema.index({ site: 1, periodKey: 1, state: 1 });

module.exports = mongoose.model("StationAuditRun", StationAuditRunSchema);
