const mongoose = require('mongoose')

const CourseCompletionSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    courseTitle: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

CourseCompletionSchema.index({ employeeCode: 1, courseId: 1 }, { unique: true })

module.exports = mongoose.model('CourseCompletion', CourseCompletionSchema)
