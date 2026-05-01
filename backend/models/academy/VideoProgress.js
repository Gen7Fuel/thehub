const mongoose = require('mongoose')

const VideoProgressSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Course' },
    itemId: { type: String, required: true }, // LearningItem _id
    progressSeconds: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
)

VideoProgressSchema.index({ employeeCode: 1, courseId: 1, itemId: 1 }, { unique: true })

module.exports = mongoose.model('VideoProgress', VideoProgressSchema)
