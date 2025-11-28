const mongoose = require('mongoose')

const cashRecSchema = new mongoose.Schema({
  site: { type: String, required: true },
  date: { type: Date, required: true },

  kardpollLitresSold: { type: Number },
  kardpollSales: { type: Number },
  kardpollAR: { type: Number },
  dealGroupCPLDiscounts: { type: Number },
  unsettledPrepays: { type: Number },
  itemSales: { type: Number },
  totalSales: { type: Number },
  fuelSales: { type: Number },
  afdGC: { type: Number },
  totalPOS: { type: Number },
  kioskGC: { type: Number },
  ar: { type: Number },
  payouts: { type: Number },
  missedCPL: { type: Number },
  coupons: { type: Number },
  cashBacks: { type: Number },
  cdnCash: { type: Number },
  handHeldDebit: { type: Number },
  bankSlip: { type: Number },
  dailyBankStmtBalance: { type: Number },
  cashDepositedDate: { type: Date },
  till: { type: Number },
  balanceCheck: { type: Number },
  bankStmtTrans: { type: Number },
  bankRec: { type: Number },
  notes: { type: String },
}, {
  timestamps: true
})

cashRecSchema.index({ site: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('CashRec', cashRecSchema)