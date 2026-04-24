const express = require('express')
const Course = require('../../models/academy/Course')
const AcademyEmployee = require('../../models/academy/AcademyEmployee')
const CourseCompletion = require('../../models/academy/CourseCompletion')

const router = express.Router()

router.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .select('_id title description thumbnail sections createdAt')
      .lean()
    res.json({
      courses: courses.map((c) => ({
        ...c,
        sectionCount: c.sections?.length ?? 0,
        sections: undefined,
      })),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to list courses', error: err.message })
  }
})

router.get('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, status: 'published' })
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course', error: err.message })
  }
})

router.post('/courses/:courseId/complete', async (req, res) => {
  try {
    const { employeeCode } = req.body
    if (!employeeCode) return res.status(400).json({ message: 'employeeCode is required' })

    const employee = await AcademyEmployee.findOne({ code: employeeCode })
    if (!employee) return res.status(404).json({ message: 'Employee code not found' })

    const course = await Course.findOne({ _id: req.params.courseId, status: 'published' })
    if (!course) return res.status(404).json({ message: 'Course not found' })

    const completion = await CourseCompletion.findOneAndUpdate(
      { employeeCode, courseId: course._id },
      {
        $setOnInsert: {
          employeeCode,
          employeeName: employee.name,
          courseId: course._id,
          courseTitle: course.title,
          completedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    res.json(completion)
  } catch (err) {
    res.status(500).json({ message: 'Failed to record completion', error: err.message })
  }
})

module.exports = router
