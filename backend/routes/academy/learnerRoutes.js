const express = require('express')
const Course = require('../../models/academy/Course')
const CourseCompletion = require('../../models/academy/CourseCompletion')
const VideoProgress = require('../../models/academy/VideoProgress')
const CourseProgress = require('../../models/academy/CourseProgress')
const { lookupAcademyEmployee } = require('../../services/sqlService')

const router = express.Router()

router.get('/employee-lookup', async (req, res) => {
  try {
    const { employeeNumber } = req.query
    if (!employeeNumber || !/^\d{4}$/.test(String(employeeNumber))) {
      return res.status(400).json({ message: 'employeeNumber must be a 4-digit number' })
    }
    const employee = await lookupAcademyEmployee(employeeNumber)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })
    res.json(employee)
  } catch (err) {
    res.status(500).json({ message: 'Failed to look up employee', error: err.message })
  }
})

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

    const employee = await lookupAcademyEmployee(employeeCode)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

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

router.get('/video-progress/:courseId/:itemId', async (req, res) => {
  try {
    const { courseId, itemId } = req.params
    const { employeeCode } = req.query
    if (!employeeCode) return res.status(400).json({ message: 'employeeCode is required' })

    const record = await VideoProgress.findOne({ employeeCode, courseId, itemId }).lean()
    res.json({ progressSeconds: record?.progressSeconds ?? 0 })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch video progress', error: err.message })
  }
})

router.put('/video-progress', async (req, res) => {
  try {
    const { employeeCode, courseId, itemId, progressSeconds } = req.body
    if (!employeeCode || !courseId || !itemId || progressSeconds == null) {
      return res.status(400).json({ message: 'employeeCode, courseId, itemId, progressSeconds are required' })
    }

    const record = await VideoProgress.findOneAndUpdate(
      { employeeCode, courseId, itemId },
      { $set: { progressSeconds } },
      { upsert: true, new: true },
    )
    res.json({ progressSeconds: record.progressSeconds })
  } catch (err) {
    res.status(500).json({ message: 'Failed to save video progress', error: err.message })
  }
})

router.get('/course-progress/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params
    const { employeeCode } = req.query
    if (!employeeCode) return res.status(400).json({ message: 'employeeCode is required' })

    const record = await CourseProgress.findOne({ employeeCode, courseId }).lean()
    res.json({
      currentPageIndex: record?.currentPageIndex ?? 0,
      completedPages: record?.completedPages ?? [],
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course progress', error: err.message })
  }
})

router.put('/course-progress', async (req, res) => {
  try {
    const { employeeCode, courseId, currentPageIndex, completedPageIndex } = req.body
    if (!employeeCode || !courseId) {
      return res.status(400).json({ message: 'employeeCode and courseId are required' })
    }

    const update = {}
    if (currentPageIndex != null) {
      update.$set = { currentPageIndex }
    }
    if (completedPageIndex != null) {
      update.$addToSet = { completedPages: completedPageIndex }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' })
    }

    const record = await CourseProgress.findOneAndUpdate(
      { employeeCode, courseId },
      update,
      { upsert: true, new: true },
    )
    res.json({ currentPageIndex: record.currentPageIndex, completedPages: record.completedPages })
  } catch (err) {
    res.status(500).json({ message: 'Failed to save course progress', error: err.message })
  }
})

module.exports = router
