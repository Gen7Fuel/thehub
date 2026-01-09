const mongoose = require('mongoose')

const ArRowSchema = new mongoose.Schema(
  {
    customer: { type: String, required: true },
    card: { type: String, required: true },
    amount: { type: Number, required: true },
    quantity: { type: Number, required: true },
    price_per_litre: { type: Number, required: true },
  },
  { _id: false }
)

const KardpollReportSchema = new mongoose.Schema(
  {
    litresSold: { type: Number, required: true },
    sales: { type: Number, required: true },
    ar: { type: Number, required: true },
    date: { type: String, required: true }, // store "YYYY-MM-DD" as string
    site: { type: String, required: true },
    ar_rows: { type: [ArRowSchema], default: [] },
  },
  { timestamps: true }
)

KardpollReportSchema.index({ site: 1, date: -1 })

KardpollReportSchema.statics.fromParsed = function (payload = {}) {
  const { litresSold, sales, ar, date, site, ar_rows = [] } = payload
  const toYmd = (d) => {
    if (!d) return undefined
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return undefined
    const pad = (n) => String(n).padStart(2, '0')
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`
  }

  return new this({
    litresSold,
    sales,
    ar,
    date: toYmd(date),
    site,
    ar_rows,
  })
}

const KardpollReport = mongoose.model('KardpollReport', KardpollReportSchema)

// Bank Statement (one document per statement/day/site)
const MiscDebitSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    description: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
)

const BankStatementSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (identifier)
    balanceForward: { type: Number },
    nightDeposit: { type: Number },
    transferTo: { type: Number },
    endingBalance: { type: Number },
    miscDebits: { type: [MiscDebitSchema], default: [] },
    // NEW: store miscellaneous credits
    miscCredits: { type: [MiscDebitSchema], default: [] },
    // NEW: store GBL debits/credits
    gblDebits: { type: [MiscDebitSchema], default: [] },
    gblCredits: { type: [MiscDebitSchema], default: [] },
    // NEW: merchant fees (required on frontend)
    merchantFees: { type: Number },
  },
  { timestamps: true }
)
BankStatementSchema.index({ site: 1, date: 1 }, { unique: true }) // one per site+day

// Factory to build from parsed JSON
BankStatementSchema.statics.fromParsed = function (payload = {}) {
  const pad = (n) => String(n).padStart(2, '0')
  const toYmd = (d) => {
    if (!d) return undefined
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return undefined
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`
  }

  const {
    site,
    date,
    balanceForward,
    nightDeposit,
    transferTo,
    endingBalance,
    miscDebits = [],
    // NEW: accept miscCredits
    miscCredits = [],
    // NEW: accept GBL buckets
    gblDebits = [],
    gblCredits = [],
    // NEW: accept merchantFees
    merchantFees,
  } = payload

  return new this({
    site,
    date: toYmd(date),
    balanceForward,
    nightDeposit,
    transferTo,
    endingBalance,
    miscDebits: Array.isArray(miscDebits)
      ? miscDebits.map((m) => ({
          date: toYmd(m?.date),
          description: String(m?.description || ''),
          amount: Number(m?.amount) || 0,
        }))
      : [],
    miscCredits: Array.isArray(miscCredits)
      ? miscCredits.map((m) => ({
          date: toYmd(m?.date),
          description: String(m?.description || ''),
          amount: Number(m?.amount) || 0,
        }))
      : [],
    gblDebits: Array.isArray(gblDebits)
      ? gblDebits.map((m) => ({
          date: toYmd(m?.date),
          description: String(m?.description || ''),
          amount: Number(m?.amount) || 0,
        }))
      : [],
    gblCredits: Array.isArray(gblCredits)
      ? gblCredits.map((m) => ({
          date: toYmd(m?.date),
          description: String(m?.description || ''),
          amount: Number(m?.amount) || 0,
        }))
      : [],
    merchantFees: typeof merchantFees === 'number' ? merchantFees : undefined,
  })
}

const BankStatement = mongoose.model('BankStatement', BankStatementSchema)

module.exports = KardpollReport
module.exports.KardpollReport = KardpollReport
module.exports.ArRowSchema = ArRowSchema
module.exports.BankStatement = BankStatement
