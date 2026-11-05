const mongoose = require("mongoose");

const glAccountSchema = new mongoose.Schema(
  {
    accName: { type: String, required: false, trim: true, default: "" },
    accNo: { type: String, required: false, trim: true, default: "" },
    mappingField: {
      type: String,
      required: true,
      enum: [
        "Fuel Sales",
        "CPL Discounts",
        "Store Sales",
        "Cash Counted",
        "GC Redemption",
        "On Account",
        "Cash Ov/Sh",
        "Payouts",
      ],
    },
  },
  { _id: false }
);

const sageAccountMapSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    depositAccName: { type: String, required: true, trim: true },
    depositAccountNumber: { type: String, required: true, trim: true },
    glaccount: {
      type: [glAccountSchema],
      default: [],
    },
  },
  { timestamps: true }
);

sageAccountMapSchema.index({ site: 1 }, { unique: true });

module.exports = mongoose.model("SageAccountMap", sageAccountMapSchema);
