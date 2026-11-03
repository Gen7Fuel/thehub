const mongoose = require("mongoose");

const StatusOptionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
});

const StationAuditStatusOptionSetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    options: {
      type: [StatusOptionSchema],
      default: [],
      validate: {
        validator(options) {
          const keys = options.map((option) => option.key.toLowerCase());
          return keys.length === new Set(keys).size;
        },
        message: "Status option keys must be unique within an option set",
      },
    },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    legacySelectTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "SelectTemplate", default: null },
  },
  { timestamps: true }
);

StationAuditStatusOptionSetSchema.index({ name: 1 }, { unique: true });
StationAuditStatusOptionSetSchema.index({ legacySelectTemplateId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("StationAuditStatusOptionSet", StationAuditStatusOptionSetSchema);
