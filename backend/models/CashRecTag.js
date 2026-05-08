const mongoose = require('mongoose')

const CashRecTagSchema = new mongoose.Schema(
  {
    site: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
  },
  { timestamps: true }
)

CashRecTagSchema.index({ site: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('CashRecTag', CashRecTagSchema)
