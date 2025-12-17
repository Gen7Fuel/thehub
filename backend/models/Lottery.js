import mongoose from 'mongoose'

const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const LotterySchema = new mongoose.Schema(
  {
    site: { type: String, required: true, index: true, trim: true },
    // YYYY-MM-DD
    date: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: isYmd,
        message: 'date must be in YYYY-MM-DD format',
      },
    },

    // Amounts (nullable if not present in report)
    lottoPayout: { type: Number, default: null },
    dataWave: { type: Number, default: null },
    feeDataWave: { type: Number, default: null },
    onlineLottoTotal: { type: Number, default: null },
    instantLottTotal: { type: Number, default: null },
    // Number of scratch free tickets reported by the site (user-entered)
    scratchFreeTickets: { type: Number, default: null },

    // Filenames stored by CDN upload (e.g., ["bol-2025-12-10-1.jpg", ...])
    images: { type: [String], default: [] },
  },
  { timestamps: true }
)

// One record per site+date
LotterySchema.index({ site: 1, date: 1 }, { unique: true })

// Normalize image filenames: trim + de-duplicate
LotterySchema.pre('save', function (next) {
  if (Array.isArray(this.images)) {
    this.images = Array.from(
      new Set(this.images.map((s) => String(s || '').trim()).filter(Boolean))
    )
  }
  next()
})

export const Lottery =
  mongoose.models.Lottery || mongoose.model('Lottery', LotterySchema)

export default Lottery