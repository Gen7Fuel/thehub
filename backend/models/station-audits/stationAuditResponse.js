const mongoose = require("mongoose");

const StationAuditResponseSchema = new mongoose.Schema(
  {
    run: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditRun", required: true },
    checklist: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditChecklist", required: true },
    checklistSnapshot: {
      item: { type: String, required: true },
      description: { type: String, default: "" },
      category: { type: String, default: "" },
      frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
      department: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditDepartment", required: true },
      departmentName: { type: String, required: true },
    },
    checked: { type: Boolean, default: false },
    checkedAt: { type: Date, default: null },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    selectedStatus: {
      optionSet: { type: mongoose.Schema.Types.ObjectId, ref: "StationAuditStatusOptionSet", default: null },
      optionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      key: { type: String, trim: true, default: "" },
      label: { type: String, trim: true, default: "" },
    },
    comment: { type: String, trim: true, default: "" },
    photos: [{ type: String, trim: true }],
    requestOrder: { type: Boolean, default: false },
    orderCreated: { type: Boolean, default: false },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRec", default: null },
    issueRaised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

StationAuditResponseSchema.index({ run: 1, checklist: 1 }, { unique: true });
StationAuditResponseSchema.index({ checklist: 1, checkedAt: -1 });

module.exports = mongoose.model("StationAuditResponse", StationAuditResponseSchema);
