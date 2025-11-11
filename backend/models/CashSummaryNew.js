const mongoose = require('mongoose')

const CashSummarySchema = new mongoose.Schema(
  {
    site: { type: String, required: true },
    shift_number: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    canadian_cash_collected: { type: Number },
    item_sales: { type: Number },
    cash_back: { type: Number },
    loyalty: { type: Number },
    cpl_bulloch: { type: Number },
    exempted_tax: { type: Number },
    // Value parsed from shift report (Canadian Cash in report) kept separate
    report_canadian_cash: { type: Number },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CashSummary', CashSummarySchema)