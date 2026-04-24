const mongoose = require('mongoose')

const AcademyEmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('AcademyEmployee', AcademyEmployeeSchema)
