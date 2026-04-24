const express = require('express')
const Course = require('../../models/academy/Course')
const AcademyEmployee = require('../../models/academy/AcademyEmployee')
const CourseCompletion = require('../../models/academy/CourseCompletion')

const router = express.Router()

function requireAcademyAdminToken(req, res, next) {
  const expected = process.env.ACADEMY_ADMIN_TOKEN
  if (!expected) return res.status(500).json({ message: 'Academy admin token not configured.' })
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== expected)
    return res.status(401).json({ message: 'Unauthorized.' })
  next()
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `EMP-${suffix}`
}

router.use(requireAcademyAdminToken)

// --- Courses ---

router.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 }).lean()
    res.json({
      courses: courses.map((c) => ({
        _id: c._id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        status: c.status,
        sectionCount: c.sections?.length ?? 0,
        createdAt: c.createdAt,
      })),
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to list courses', error: err.message })
  }
})

router.post('/courses', async (req, res) => {
  try {
    const { title, description, thumbnail, sections } = req.body
    if (!title) return res.status(400).json({ message: 'title is required' })
    const course = await Course.create({ title, description, thumbnail, sections })
    res.status(201).json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to create course', error: err.message })
  }
})

router.get('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course', error: err.message })
  }
})

router.put('/courses/:id', async (req, res) => {
  try {
    const { title, description, thumbnail, sections } = req.body
    if (!title) return res.status(400).json({ message: 'title is required' })
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { title, description, thumbnail, sections },
      { new: true, runValidators: true },
    )
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update course', error: err.message })
  }
})

router.post('/courses/:id/publish', async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, { status: 'published' }, { new: true })
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish course', error: err.message })
  }
})

router.post('/courses/:id/unpublish', async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true })
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json(course)
  } catch (err) {
    res.status(500).json({ message: 'Failed to unpublish course', error: err.message })
  }
})

router.delete('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id)
    if (!course) return res.status(404).json({ message: 'Course not found' })
    res.json({ message: 'Course deleted' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete course', error: err.message })
  }
})

// --- Employees ---

router.get('/employees', async (req, res) => {
  try {
    const employees = await AcademyEmployee.find().sort({ createdAt: -1 }).lean()
    res.json({ employees })
  } catch (err) {
    res.status(500).json({ message: 'Failed to list employees', error: err.message })
  }
})

router.post('/employees', async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' })

    let employee = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      try {
        employee = await AcademyEmployee.create({ name: name.trim(), code })
        break
      } catch (err) {
        if (err.code !== 11000) throw err
      }
    }
    if (!employee) return res.status(500).json({ message: 'Failed to generate unique code, please try again.' })

    res.status(201).json(employee)
  } catch (err) {
    res.status(500).json({ message: 'Failed to create employee', error: err.message })
  }
})

router.delete('/employees/:id', async (req, res) => {
  try {
    const employee = await AcademyEmployee.findByIdAndDelete(req.params.id)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })
    res.json({ message: 'Employee deleted' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete employee', error: err.message })
  }
})

// --- Completions ---

router.get('/completions', async (req, res) => {
  try {
    const filter = {}
    if (req.query.courseId) filter.courseId = req.query.courseId
    const completions = await CourseCompletion.find(filter).sort({ completedAt: -1 }).lean()
    res.json({ completions })
  } catch (err) {
    res.status(500).json({ message: 'Failed to list completions', error: err.message })
  }
})

module.exports = router
