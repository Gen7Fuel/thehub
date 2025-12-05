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

module.exports = KardpollReport
module.exports.KardpollReport = KardpollReport
module.exports.ArRowSchema = ArRowSchema