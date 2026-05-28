const mongoose = require("mongoose");

const atmRecordSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, enum: ["till", "safe"] },
    image: { type: String, default: null },
    stationName: { type: String, required: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

atmRecordSchema.index({ stationName: 1, date: -1 });

module.exports = mongoose.model("ATMRecord", atmRecordSchema);
