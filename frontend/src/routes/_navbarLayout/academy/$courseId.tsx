import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import axios from 'axios'

interface LearningItem {
  _id: string
  type: 'video' | 'mcq' | 'flip-card' | 'hotspot' | 'ordering' | 'matching'
  order: number
  content: Record<string, any>
}

interface Section {
  _id: string
  title: string
  order: number
  type: 'lesson' | 'test'
  items: LearningItem[]
}

interface Course {
  _id: string
  title: string
  description: string
  sections: Section[]
}

export const Route = createFileRoute('/_navbarLayout/academy/$courseId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [employeeCode, setEmployeeCode] = useState<string | null>(null)

  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios
      .get(`/api/academy/learner/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' },
      })
      .then((res) => setCourse(res.data))
      .catch((err) => {
        if (err.response?.status === 403) navigate({ to: '/no-access' })
        else navigate({ to: '/academy' })
      })
      .finally(() => setLoading(false))
  }, [courseId, navigate])

  function handleStartCourse() {
    if (!codeInput.trim()) {
      setCodeError('Please enter your employee code.')
      return
    }
    if (!codeInput.trim().startsWith('EMP-')) {
      setCodeError('Invalid code format. Codes start with EMP-')
      return
    }
    setCodeError(null)
    setEmployeeCode(codeInput.trim())
  }

  async function handleComplete() {
    if (!employeeCode) return
    setCompleting(true)
    setCompleteError(null)
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `/api/academy/learner/courses/${courseId}/complete`,
        { employeeCode },
        { headers: { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' } },
      )
      setCompleted(true)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setCompleteError('Code not found — check with your manager.')
      } else {
        setCompleteError('Failed to record completion. Please try again.')
      }
    } finally {
      setCompleting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!course) return null

  // Employee code entry screen
  if (!employeeCode) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{course.title}</h2>
          <p className="text-sm text-gray-500">Enter your employee code to begin.</p>
          <input
            type="text"
            placeholder="EMP-XXXXXX"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStartCourse() }}
            className="w-full rounded border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {codeError && <p className="text-sm text-red-500">{codeError}</p>}
          <button
            onClick={handleStartCourse}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Start Course
          </button>
        </div>
      </div>
    )
  }

  // Course content
  const sortedSections = [...course.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && <p className="mt-1 text-sm text-gray-500">{course.description}</p>}
      </div>

      {sortedSections.map((section) => (
        <div key={section._id} className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-1">{section.title}</h2>
          {[...section.items]
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <LearningItemView key={item._id} item={item} />
            ))}
        </div>
      ))}

      <div className="pt-4 border-t">
        {completed ? (
          <p className="text-green-600 font-medium">Course completed! Well done.</p>
        ) : (
          <>
            {completeError && <p className="mb-2 text-sm text-red-500">{completeError}</p>}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {completing ? 'Submitting…' : 'Complete Course'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function LearningItemView({ item }: { item: LearningItem }) {
  const { type, content } = item
  const [flipped, setFlipped] = useState(false)

  if (type === 'video') {
    const src: string = content.url ?? content.src ?? ''
    return src ? (
      <div className="rounded overflow-hidden border">
        {src.includes('youtube') || src.includes('youtu.be') || src.includes('vimeo') ? (
          <iframe src={src} className="w-full aspect-video" allowFullScreen />
        ) : (
          <video src={src} controls className="w-full" />
        )}
      </div>
    ) : null
  }

  if (type === 'mcq') {
    type MCQOption = { id?: string; text: string; isCorrect?: boolean }
    const options = content.options as Array<MCQOption | string>
    return (
      <div className="space-y-2 rounded border p-4">
        <p className="font-medium text-sm">{content.question as string}</p>
        <ul className="space-y-1">
          {options.map((opt, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">{String.fromCharCode(65 + i)}</span>
              {typeof opt === 'object' ? opt.text : opt}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (type === 'flip-card') {
    const side = flipped ? content.back : content.front
    const sideText = typeof side === 'object' && side !== null ? (side as any).text : side
    const sideImage = typeof side === 'object' && side !== null ? (side as any).imageUrl : null
    return (
      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full rounded border p-6 text-center text-sm min-h-[100px] hover:bg-gray-50 transition-colors"
      >
        {sideImage && <img src={sideImage} alt="" className="mx-auto mb-2 max-h-40 object-contain" />}
        {sideText}
        <p className="mt-2 text-xs text-gray-400">{flipped ? 'Click to flip back' : 'Click to flip'}</p>
      </button>
    )
  }

  if (type === 'hotspot') {
    return (
      <div className="relative inline-block rounded border overflow-hidden">
        <img src={content.image} alt="Hotspot" className="max-w-full" />
        {(content.hotspots as Array<{ x: number; y: number; label: string }> ?? []).map((h, i) => (
          <div
            key={i}
            className="absolute w-5 h-5 rounded-full bg-blue-500 opacity-80 flex items-center justify-center text-white text-xs cursor-pointer"
            style={{ left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%,-50%)' }}
            title={h.label}
          >
            {i + 1}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'ordering') {
    type OrderingItem = { id?: string; text: string }
    const items = content.items as Array<OrderingItem | string>
    return (
      <div className="rounded border p-4 space-y-2">
        <p className="text-sm font-medium">{(content.prompt ?? content.question ?? 'Put in order:') as string}</p>
        <ol className="list-decimal list-inside text-sm space-y-1">
          {items.map((item, i) => (
            <li key={i}>{typeof item === 'object' ? item.text : item}</li>
          ))}
        </ol>
      </div>
    )
  }

  if (type === 'matching') {
    return (
      <div className="rounded border p-4 space-y-2">
        <p className="text-sm font-medium">{content.question ?? 'Match the following:'}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(content.pairs as Array<{ left: string; right: string }> ?? []).map((pair, i) => (
            <div key={i} className="contents">
              <div className="rounded bg-gray-100 px-2 py-1">{pair.left}</div>
              <div className="rounded bg-blue-50 px-2 py-1">{pair.right}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
