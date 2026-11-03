const mongoose = require("mongoose");

const SiteNotificationSchema = new mongoose.Schema(
  {
    site: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    emails: [{ type: String, trim: true, lowercase: true }],
  },
  { _id: false }
);

const StationAuditDepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    departmentHead: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notificationEmails: [{ type: String, trim: true, lowercase: true }],
    siteNotifications: {
      type: [SiteNotificationSchema],
      default: [],
      validate: {
        validator(entries) {
          const sites = entries.map((entry) => entry.site.toString());
          return sites.length === new Set(sites).size;
        },
        message: "A department can only have one notification rule per site",
      },
    },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    legacySelectOptionText: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

StationAuditDepartmentSchema.index({ name: 1 }, { unique: true });
StationAuditDepartmentSchema.index({ departmentHead: 1, active: 1 });
StationAuditDepartmentSchema.index({ legacySelectOptionText: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("StationAuditDepartment", StationAuditDepartmentSchema);
