import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

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

function toEmbedUrl(url: string): string {
  // youtu.be/ID
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  // youtube.com/watch?v=ID
  const watch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  // vimeo.com/ID
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

function LearningItemView({ item }: { item: LearningItem }) {
  const { type, content } = item
  const [flipped, setFlipped] = useState(false)

  if (type === 'video') {
    const raw: string = content.url ?? content.src ?? ''
    if (!raw) return null
    const src = toEmbedUrl(raw)
    return (
      <div className="rounded overflow-hidden border">
        {src.includes('youtube.com/embed') || src.includes('player.vimeo') ? (
          <iframe src={src} className="w-full aspect-video" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        ) : (
          <video src={src} controls className="w-full" />
        )}
      </div>
    )
  }

  if (type === 'mcq') {
    return <MCQItemView content={content} />
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
        <img src={content.imageUrl ?? content.image} alt="Hotspot" className="max-w-full" />
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
    return <OrderingItemView content={content} />
  }

  if (type === 'matching') {
    return <MatchingItemView content={content} />
  }

  return null
}

type OrderingRow = { id: string; text: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function SortableRow({ row }: { row: OrderingRow }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm shadow-sm"
    >
      <button type="button" className="cursor-grab text-gray-400 touch-none" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span>{row.text}</span>
    </div>
  )
}

function OrderingItemView({ content }: { content: Record<string, any> }) {
  const correctOrder = useMemo<OrderingRow[]>(() => {
    const raw = content.items as Array<{ id?: string; text: string } | string>
    return raw.map((item, i) => ({
      id: (typeof item === 'object' ? item.id : undefined) ?? String(i),
      text: typeof item === 'object' ? item.text : item,
    }))
  }, [content.items])

  const [rows, setRows] = useState<OrderingRow[]>(() => shuffle(correctOrder))
  const [checked, setChecked] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id)
      const newIndex = prev.findIndex((r) => r.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setChecked(false)
  }

  const isCorrect = checked && rows.every((r, i) => r.id === correctOrder[i].id)

  return (
    <div className="rounded border p-4 space-y-3">
      <p className="text-sm font-medium">{content.prompt ?? content.question ?? 'Put in order:'}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((row) => <SortableRow key={row.id} row={row} />)}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setChecked(true)}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Check order
        </button>
        {checked && (
          <span className={isCorrect ? 'text-xs text-green-600 font-medium' : 'text-xs text-red-500 font-medium'}>
            {isCorrect ? 'Correct!' : 'Not quite — try again'}
          </span>
        )}
      </div>
    </div>
  )
}

type MCQOption = { id: string; text: string; isCorrect: boolean }

function MCQItemView({ content }: { content: Record<string, any> }) {
  const options = useMemo<MCQOption[]>(() => {
    const raw = content.options as Array<{ id?: string; text: string; isCorrect?: boolean } | string>
    return raw.map((o, i) =>
      typeof o === 'object'
        ? { id: o.id ?? String(i), text: o.text, isCorrect: o.isCorrect ?? false }
        : { id: String(i), text: o, isCorrect: false },
    )
  }, [content.options])

  const multipleCorrect = options.filter((o) => o.isCorrect).length > 1
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)

  const toggle = (id: string) => {
    if (checked) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (multipleCorrect) {
        next.has(id) ? next.delete(id) : next.add(id)
      } else {
        next.clear()
        next.add(id)
      }
      return next
    })
  }

  const isCorrect = checked && options.every((o) => o.isCorrect === selected.has(o.id))

  const optionStyle = (o: MCQOption) => {
    if (!checked) {
      return selected.has(o.id)
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white border-gray-300 hover:bg-gray-50'
    }
    if (o.isCorrect) return 'bg-green-100 border-green-500 text-green-800'
    if (selected.has(o.id)) return 'bg-red-100 border-red-400 text-red-800'
    return 'bg-white border-gray-200 text-gray-400'
  }

  return (
    <div className="rounded border p-4 space-y-3">
      <p className="font-medium text-sm">{content.question as string}</p>
      {multipleCorrect && <p className="text-xs text-gray-500">Select all that apply</p>}
      <div className="space-y-2">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => toggle(o.id)}
            className={['w-full flex items-center gap-3 rounded border px-3 py-2 text-sm text-left transition-colors', optionStyle(o)].join(' ')}
          >
            <span className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-xs font-medium">
              {String.fromCharCode(65 + i)}
            </span>
            {o.text}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setChecked(true)}
          disabled={selected.size === 0 || checked}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Check answer
        </button>
        {checked && (
          <>
            <button
              onClick={() => { setSelected(new Set()); setChecked(false) }}
              className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Try again
            </button>
            <span className={isCorrect ? 'text-xs text-green-600 font-medium' : 'text-xs text-red-500 font-medium'}>
              {isCorrect ? 'Correct!' : 'Not quite — try again'}
            </span>
          </>
        )}
      </div>
      {checked && content.explanation && (
        <p className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600 border">{content.explanation as string}</p>
      )}
    </div>
  )
}

type MatchingPair = { id: string; left: string; right: string }

function MatchingItemView({ content }: { content: Record<string, any> }) {
  const pairs = useMemo<MatchingPair[]>(() => {
    const raw = content.pairs as Array<{ id?: string; left: string; right: string }>
    return raw.map((p, i) => ({ id: p.id ?? String(i), left: p.left, right: p.right }))
  }, [content.pairs])

  const [rightOptions] = useState<MatchingPair[]>(() => shuffle(pairs))
  const [selected, setSelected] = useState<string | null>(null) // left pair id
  const [matches, setMatches] = useState<Record<string, string>>({}) // leftId -> rightId
  const [checked, setChecked] = useState(false)

  const handleLeftClick = (id: string) => {
    setSelected((prev) => (prev === id ? null : id))
    setChecked(false)
  }

  const handleRightClick = (rightId: string) => {
    if (!selected) return
    setMatches((prev) => ({ ...prev, [selected]: rightId }))
    setSelected(null)
    setChecked(false)
  }

  const allMatched = pairs.every((p) => matches[p.id] !== undefined)
  const isCorrect = checked && pairs.every((p) => matches[p.id] === p.id)

  return (
    <div className="rounded border p-4 space-y-3">
      <p className="text-sm font-medium">{content.prompt ?? content.question ?? 'Match the following:'}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          {pairs.map((p) => {
            const isSelected = selected === p.id
            const isMatched = matches[p.id] !== undefined
            return (
              <button
                key={p.id}
                onClick={() => handleLeftClick(p.id)}
                className={[
                  'w-full rounded px-3 py-2 text-left transition-colors border',
                  isSelected ? 'bg-blue-600 text-white border-blue-600' :
                  isMatched ? 'bg-blue-50 border-blue-300' :
                  'bg-gray-100 border-transparent hover:bg-gray-200',
                ].join(' ')}
              >
                {p.left}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rightOptions.map((p) => {
            const isMatchedBySelected = selected !== null && matches[selected] === p.id
            const isMatchedByAny = Object.values(matches).includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => handleRightClick(p.id)}
                className={[
                  'w-full rounded px-3 py-2 text-left transition-colors border',
                  isMatchedBySelected ? 'bg-blue-600 text-white border-blue-600' :
                  isMatchedByAny ? 'bg-blue-50 border-blue-300' :
                  selected ? 'bg-white border-gray-300 hover:bg-blue-50 cursor-pointer' :
                  'bg-white border-gray-200',
                ].join(' ')}
              >
                {p.right}
              </button>
            )
          })}
        </div>
      </div>
      {selected && (
        <p className="text-xs text-blue-600">Now click an item on the right to match it</p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setChecked(true)}
          disabled={!allMatched}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Check matches
        </button>
        <button
          onClick={() => { setMatches({}); setSelected(null); setChecked(false) }}
          className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
        >
          Reset
        </button>
        {checked && (
          <span className={isCorrect ? 'text-xs text-green-600 font-medium' : 'text-xs text-red-500 font-medium'}>
            {isCorrect ? 'Correct!' : 'Not quite — try again'}
          </span>
        )}
      </div>
    </div>
  )
}
