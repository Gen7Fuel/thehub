import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import axios from 'axios'

interface CourseSummary {
  _id: string
  title: string
  description: string
  thumbnail: string
  sectionCount: number
  createdAt: string
}

export const Route = createFileRoute('/_navbarLayout/academy/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios
      .get('/api/academy/learner/courses', {
        headers: { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' },
      })
      .then((res) => setCourses(res.data.courses ?? res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          navigate({ to: '/no-access' })
        } else {
          setError('Failed to load courses.')
        }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Academy</h1>
      {courses.length === 0 ? (
        <p className="text-gray-500">No courses available.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <button
              key={course._id}
              onClick={() => navigate({ to: '/academy/$courseId', params: { courseId: course._id } })}
              className="text-left rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {course.thumbnail && (
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-36 object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="font-semibold text-base leading-snug">{course.title}</h2>
                {course.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{course.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {course.sectionCount} section{course.sectionCount !== 1 ? 's' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
