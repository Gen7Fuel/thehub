import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import axios from 'axios'

// MCQ practice module — lets trainers jump straight to a course's questions
// (skipping videos/other content and the employee-number gate) to preview
// the feedback modal or run someone through the questions verbally.
// Nothing here is recorded: it reads the same published courses Academy
// does, but never calls any progress/completion endpoints.

interface CourseSummary {
  _id: string
  title: string
  description?: string
}

const DEMO_COURSE: CourseSummary = {
  _id: 'demo',
  title: 'Demo',
  description: 'Sample question showcasing the feedback modal.',
}

export const Route = createFileRoute('/_navbarLayout/ai-customer/mcq/')({
  component: RouteComponent,
})

function makeAuthHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' }
}

function RouteComponent() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get('/api/academy/learner/courses', { headers: makeAuthHeaders() })
      .then((res) => {
        const list = (res.data.courses ?? res.data) as CourseSummary[]
        setCourses(list)
      })
      .catch((err) => {
        if (err.response?.status === 403) navigate({ to: '/no-access' })
        else setError('Failed to load courses.')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const allCourses = [DEMO_COURSE, ...courses]

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans flex flex-col items-center pt-8 pb-16">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-900 rounded-3xl px-8 py-8 text-white text-center shadow-2xl mb-6">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-yellow-400">Gen 7 Academy</h1>
          <p className="mt-1 opacity-80 text-sm font-bold">MCQ PRACTICE</p>
          <p className="mt-3 text-sm opacity-70">
            Jump straight to a course's questions — no videos, no employee number, nothing recorded.
          </p>
        </div>

        {loading && <p className="text-sm text-gray-500 text-center">Loading…</p>}
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2">
            {allCourses.map((course) => (
              <button
                key={course._id}
                onClick={() => navigate({ to: '/ai-customer/mcq/$courseId', params: { courseId: course._id } })}
                className="text-left rounded-3xl border-2 border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-red-200 transition-all"
              >
                <h2 className="font-black text-lg text-gray-800 leading-tight">{course.title}</h2>
                {course.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{course.description}</p>
                )}
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-red-600">Start →</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
