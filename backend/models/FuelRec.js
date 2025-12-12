import mongoose from 'mongoose'

// Schema to store a captured BOL photo reference per site and date
const BOLPhotoSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, index: true },
    // YYYY-MM-DD
    date: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: 'date must be in YYYY-MM-DD format',
      },
    },
    // Stored filename returned by your upload API
    filename: { type: String, required: true },
  },
  { timestamps: true }
)

// Prevent duplicate records for same site+date+filename
BOLPhotoSchema.index({ site: 1, date: 1, filename: 1 }, { unique: true })

// Optional helper to normalize payloads
const pad = (n) => String(n).padStart(2, '0')
const toYmd = (d) => {
  if (!d) return undefined
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return undefined
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`
}

BOLPhotoSchema.statics.fromPayload = function (payload = {}) {
  return new this({
    site: String(payload.site || '').trim(),
    date: toYmd(payload.date),
    filename: String(payload.filename || '').trim(),
  })
}

export const BOLPhoto =
  mongoose.models.BOLPhoto || mongoose.model('BOLPhoto', BOLPhotoSchema)

export default BOLPhoto