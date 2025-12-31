const mongoose = require('mongoose')

// Shift entry (multiple per site+day)
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
    payouts: { type: Number },

    // Parsed SFT values (no defaults; leave undefined if missing)
    fuelSales: { type: Number },
    dealGroupCplDiscounts: { type: Number },
    fuelPriceOverrides: { type: Number },
    parsedItemSales: { type: Number },
    depositTotal: { type: Number },
    pennyRounding: { type: Number },
    totalSales: { type: Number },
    afdCredit: { type: Number },
    afdDebit: { type: Number },
    kioskCredit: { type: Number },
    kioskDebit: { type: Number },
    kioskGiftCard: { type: Number },
    totalPos: { type: Number },
    arIncurred: { type: Number },
    grandTotal: { type: Number },
    couponsAccepted: { type: Number },
    canadianCash: { type: Number },
    cashOnHand: { type: Number },
    parsedCashBack: { type: Number },
    parsedPayouts: { type: Number },
    safedropsCount: { type: Number },
    safedropsAmount: { type: Number },
    // Lottery / Bulloch parsed fields
    lottoPayout: { type: Number },
    onlineLottoTotal: { type: Number },
    instantLottTotal: { type: Number },
    dataWave: { type: Number },
    feeDataWave: { type: Number },
  },
  { timestamps: true }
)

CashSummarySchema.index({ site: 1, shift_number: 1, date: 1 }, { unique: true })

const CashSummary = mongoose.model('CashSummary', CashSummarySchema)

// Single report per site+day (notes + submitted state)
const CashSummaryReportSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, index: true },
    // Store normalized local start-of-day for the report date
    date: { type: Date, required: true, index: true },
    notes: { type: String, default: '' },
    // Additional daily adjustment fields (optional)
    unsettledPrepays: { type: Number },
    handheldDebit: { type: Number },
    submitted: { type: Boolean, default: false },
    submittedAt: { type: Date },
  },
  { timestamps: true }
)

// Enforce one report per site+day
CashSummaryReportSchema.index({ site: 1, date: 1 }, { unique: true })

const CashSummaryReport = mongoose.model('CashSummaryReport', CashSummaryReportSchema)

module.exports = CashSummary
module.exports.CashSummary = CashSummary
module.exports.CashSummaryReport = CashSummaryReport