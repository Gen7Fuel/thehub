const mongoose = require("mongoose");
const { attachSiteAlias } = require("../utils/attachSiteAlias");

const atmRecordSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, enum: ["till", "safe"] },
    image: { type: String, default: null },
    stationName: { type: String, required: true },
    site: { type: String }, // Additive alias of stationName, auto-synced
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

atmRecordSchema.index({ stationName: 1, date: -1 });

attachSiteAlias(atmRecordSchema, "stationName");

module.exports = mongoose.model("ATMRecord", atmRecordSchema);
