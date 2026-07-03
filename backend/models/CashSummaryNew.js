const mongoose = require('mongoose')

// Sub-schema for standard key-value pairings within tenders array
const TenderItemSchema = new mongoose.Schema({
  key: { type: String, required: true },   // e.g., 'debit', 'visa', 'mastercard', 'amex'
  value: { type: Number, default: null }   // Parsed dollar metric
}, { _id: false }) // Disable _id for sub-documents to keep records clean

// Sub-schema for mapping nested fuel metrics arrays
const FuelGradeItemSchema = new mongoose.Schema({
  grade: { type: String, required: true }, // e.g., 'regular', 'diesel', 'premium'
  volume: { type: Number, default: null },
  amount: { type: Number, default: null }
}, { _id: false });

const ArCustomerItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  incurred: { type: Number, default: null },
  paid: { type: Number, default: null }
}, { _id: false });

// Shift entry (multiple per site+day)
const CashSummarySchema = new mongoose.Schema(
  {
    site: { type: String, required: true },
    shift_number: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    // Station times parsed from SFT header (stored as raw strings "YYYY-MM-DD HH:mm")
    stationStart: { type: String },
    stationEnd: { type: String },
    canadian_cash_collected: { type: Number },
    item_sales: { type: Number },
    cash_back: { type: Number },
    loyalty: { type: Number },
    cpl_bulloch: { type: Number },
    exempted_tax: { type: Number },
    // Value parsed from shift report (Canadian Cash in report) kept separate
    report_canadian_cash: { type: Number },
    payouts: { type: Number },

    // NEW: Tenders field storing key-value pairs
    tenders: [TenderItemSchema],
    fuelGrades: [FuelGradeItemSchema],
    arCustomers: [ArCustomerItemSchema],
    tobaccoCig: { type: Number },
    tobaccoOthers: { type: Number },
    propaneSales: { type: Number },
    bingoSales: { type: Number },

    // Parsed SFT values (no defaults; leave undefined if missing)
    fuelSales: { type: Number },
    companyCoupon: { type: Number }, 
    dealGroupCplDiscounts: { type: Number },
    fuelPriceOverrides: { type: Number },
    parsedItemSales: { type: Number },
    depositTotal: { type: Number },
    gst: { type: Number },
    pst: { type: Number },
    pennyRounding: { type: Number },
    totalSales: { type: Number },
    afdCredit: { type: Number },
    afdDebit: { type: Number },
    kioskCredit: { type: Number },
    kioskDebit: { type: Number },
    // NEW: AFD Gift Card parsed value
    afdGiftCard: { type: Number },
    kioskGiftCard: { type: Number },
    totalPos: { type: Number },
    arIncurred: { type: Number },
    grandTotal: { type: Number },
    // Native cpl miss (persisted)
    missedCpl: { type: Number },
    couponsAccepted: { type: Number },
    giftCertificates: { type: Number },
    cashOffCoupons: { type: Number },
    otherCoupons: { type: Number },
    canadianCash: { type: Number },
    cashOnHand: { type: Number },
    parsedCashBack: { type: Number },
    parsedPayouts: { type: Number },
    safedropsCount: { type: Number },
    safedropsAmount: { type: Number },
    // SHIFT STATISTICS: Voided Transactions (parsed)
    voidedTransactionsAmount: { type: Number },
    voidedTransactionsCount: { type: Number },
    // Lottery / Bulloch parsed fields
    lottoPayout: { type: Number },
    onlineLottoTotal: { type: Number },
    instantLottTotal: { type: Number },
    dataWave: { type: Number },
    feeDataWave: { type: Number },
    unsettledPrepays: { type: Number },
    chequesCashedOut: { type: Number, default: 0 },
    pinpadTotal: { type: Number },
    pinpadPhoto: { type: String },
    isChickenDelight: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// Enforce one report per site+day
CashSummaryReportSchema.index({ site: 1, date: 1 }, { unique: true })

const CashSummaryReport = mongoose.model('CashSummaryReport', CashSummaryReportSchema)

module.exports = CashSummary
module.exports.CashSummary = CashSummary
module.exports.CashSummaryReport = CashSummaryReport