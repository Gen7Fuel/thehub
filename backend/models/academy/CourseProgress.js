const mongoose = require('mongoose')

const CourseProgressSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Course' },
    currentPageIndex: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
)

CourseProgressSchema.index({ employeeCode: 1, courseId: 1 }, { unique: true })

module.exports = mongoose.model('CourseProgress', CourseProgressSchema)
