import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

interface Page {
  item: LearningItem
  sectionTitle: string
}

function RouteComponent() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [employeeCode, setEmployeeCode] = useState<string | null>(null)

  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [pageProgressLoaded, setPageProgressLoaded] = useState(false)

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

  useEffect(() => {
    if (!employeeCode) return
    const token = localStorage.getItem('token')
    axios
      .get(`/api/academy/learner/course-progress/${courseId}`, {
        params: { employeeCode },
        headers: { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' },
      })
      .then((res) => setCurrentPageIdx(res.data.currentPageIndex ?? 0))
      .catch(() => {})
      .finally(() => setPageProgressLoaded(true))
  }, [employeeCode, courseId])

  const pages = useMemo<Page[]>(() => {
    if (!course) return []
    const result: Page[] = []
    for (const section of [...course.sections].sort((a, b) => a.order - b.order)) {
      for (const item of [...section.items].sort((a, b) => a.order - b.order)) {
        result.push({ item, sectionTitle: section.title })
      }
    }
    return result
  }, [course])

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

  function savePageProgress(pageIndex: number) {
    if (!employeeCode) return
    const token = localStorage.getItem('token')
    axios
      .put(
        '/api/academy/learner/course-progress',
        { employeeCode, courseId, currentPageIndex: pageIndex },
        { headers: { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' } },
      )
      .catch(() => {})
  }

  function goToPage(idx: number) {
    const bounded = Math.max(0, Math.min(idx, pages.length - 1))
    setCurrentPageIdx(bounded)
    savePageProgress(bounded)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartCourse()
            }}
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

  if (!pageProgressLoaded) return <div className="p-6 text-sm text-gray-500">Loading...</div>

  if (pages.length === 0) {
    return <div className="p-6 text-sm text-gray-500">This course has no content yet.</div>
  }

  const currentPage = pages[currentPageIdx]
  const isFirst = currentPageIdx === 0
  const isLast = currentPageIdx === pages.length - 1
  const prevSectionTitle = currentPageIdx > 0 ? pages[currentPageIdx - 1].sectionTitle : null
  const sectionChanged = prevSectionTitle !== null && prevSectionTitle !== currentPage.sectionTitle

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{currentPage.sectionTitle}</p>
      </div>

      {sectionChanged && (
        <div className="rounded bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          Now starting: <span className="font-medium">{currentPage.sectionTitle}</span>
        </div>
      )}

      <div className="text-xs text-gray-400">
        Page {currentPageIdx + 1} of {pages.length}
      </div>

      <LearningItemView
        key={currentPage.item._id}
        item={currentPage.item}
        employeeCode={employeeCode}
        courseId={courseId}
      />

      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={() => goToPage(currentPageIdx - 1)}
          disabled={isFirst}
          className="rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {isLast ? (
          <div className="flex flex-col items-end gap-1">
            {completeError && <p className="text-sm text-red-500">{completeError}</p>}
            {completed ? (
              <p className="text-sm font-medium text-green-600">Course completed! Well done.</p>
            ) : (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {completing ? 'Submitting…' : 'Complete Course'}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => goToPage(currentPageIdx + 1)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next
          </button>
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

function VideoItemView({
  item,
  content,
  employeeCode,
  courseId,
}: {
  item: LearningItem
  content: Record<string, any>
  employeeCode: string | null
  courseId: string
}) {
  const raw: string = content.url ?? content.src ?? ''
  if (!raw) return null
  const src = toEmbedUrl(raw)
  const isEmbed = src.includes('youtube.com/embed') || src.includes('player.vimeo')

  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' }

  const saveProgress = useCallback(
    (seconds: number) => {
      if (!employeeCode) return
      const toSave = Math.floor(seconds)
      axios.put(
        '/api/academy/learner/video-progress',
        { employeeCode, courseId, itemId: item._id, progressSeconds: toSave },
        { headers },
      ).catch(() => {})
    },
    [employeeCode, courseId, item._id],
  )

  useEffect(() => {
    if (isEmbed || !employeeCode) return
    axios
      .get(`/api/academy/learner/video-progress/${courseId}/${item._id}`, {
        params: { employeeCode },
        headers,
      })
      .then((res) => {
        const saved: number = res.data.progressSeconds ?? 0
        if (saved > 0 && videoRef.current) {
          videoRef.current.currentTime = saved
        }
      })
      .catch(() => {})
  }, [isEmbed, employeeCode, courseId, item._id])

  function handleTimeUpdate() {
    const v = videoRef.current
    if (!v) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveProgress(v.currentTime), 5000)
  }

  function handlePauseOrEnded() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (videoRef.current) saveProgress(videoRef.current.currentTime)
  }

  return (
    <div className="rounded overflow-hidden border">
      {isEmbed ? (
        <iframe
          src={src}
          className="w-full aspect-video"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="w-full cursor-pointer"
          onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePauseOrEnded}
          onEnded={handlePauseOrEnded}
        />
      )}
    </div>
  )
}

function LearningItemView({ item, employeeCode, courseId }: { item: LearningItem; employeeCode: string | null; courseId: string }) {
  const { type, content } = item
  const [flipped, setFlipped] = useState(false)

  if (type === 'video') {
    return <VideoItemView item={item} content={content} employeeCode={employeeCode} courseId={courseId} />
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
        className="w-full rounded border text-center text-sm min-h-[100px] hover:bg-gray-50 transition-colors overflow-hidden"
      >
        {sideImage && <img src={sideImage} alt="" className="w-full object-cover" />}
        <div className="p-6">
          {sideText}
          <p className="mt-2 text-xs text-gray-400">{flipped ? 'Click to flip back' : 'Click to flip'}</p>
        </div>
      </button>
    )
  }

  if (type === 'hotspot') {
    return <HotspotItemView content={content} />
  }

  if (type === 'ordering') {
    return <OrderingItemView content={content} />
  }

  if (type === 'matching') {
    return <MatchingItemView content={content} />
  }

  return null
}

type Hotspot = { id?: string; x: number; y: number; label: string; description?: string }

function HotspotItemView({ content }: { content: Record<string, any> }) {
  const hotspots = (content.hotspots ?? []) as Hotspot[]
  const [activeId, setActiveId] = useState<string | null>(null)

  const getId = (h: Hotspot, i: number) => h.id ?? String(i)

  const toggle = (id: string) => setActiveId((prev) => (prev === id ? null : id))

  return (
    <div className="space-y-2">
      <div className="relative inline-block w-full rounded border overflow-hidden">
        <img src={content.imageUrl ?? content.image} alt="Hotspot" className="w-full" draggable={false} />
        {hotspots.map((h, i) => {
          const id = getId(h, i)
          const isActive = activeId === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={[
                'absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white text-xs font-bold shadow-md transition-transform hover:scale-110',
                isActive ? 'bg-orange-500 scale-110' : 'bg-blue-600',
              ].join(' ')}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      {activeId && (() => {
        const idx = hotspots.findIndex((h, i) => getId(h, i) === activeId)
        const h = hotspots[idx]
        if (!h) return null
        return (
          <div className="rounded border bg-white p-4 shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{idx + 1}. {h.label}</p>
              <button onClick={() => setActiveId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            {h.description && <p className="text-sm text-gray-600">{h.description}</p>}
          </div>
        )
      })()}
    </div>
  )
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
type MatchLine = { leftId: string; x1: number; y1: number; x2: number; y2: number; correct: boolean | null }

function MatchingItemView({ content }: { content: Record<string, any> }) {
  const pairs = useMemo<MatchingPair[]>(() => {
    const raw = content.pairs as Array<{ id?: string; left: string; right: string }>
    return raw.map((p, i) => ({ id: p.id ?? String(i), left: p.left, right: p.right }))
  }, [content.pairs])

  const [rightOptions] = useState<MatchingPair[]>(() => shuffle(pairs))
  const [selected, setSelected] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [lines, setLines] = useState<MatchLine[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const cr = containerRef.current.getBoundingClientRect()
    const next: MatchLine[] = []
    for (const [leftId, rightId] of Object.entries(matches)) {
      const lEl = leftRefs.current[leftId]
      const rEl = rightRefs.current[rightId]
      if (!lEl || !rEl) continue
      const lr = lEl.getBoundingClientRect()
      const rr = rEl.getBoundingClientRect()
      const correctPair = pairs.find((p) => p.id === leftId)
      next.push({
        leftId,
        x1: lr.right - cr.left,
        y1: lr.top + lr.height / 2 - cr.top,
        x2: rr.left - cr.left,
        y2: rr.top + rr.height / 2 - cr.top,
        correct: checked ? correctPair?.id === rightId : null,
      })
    }
    setLines(next)
  }, [matches, checked, pairs])

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

  const lineColor = (l: MatchLine) =>
    l.correct === null ? '#3b82f6' : l.correct ? '#16a34a' : '#ef4444'

  return (
    <div className="rounded border p-4 space-y-3">
      <p className="text-sm font-medium">{content.prompt ?? content.question ?? 'Match the following:'}</p>
      <div ref={containerRef} className="relative grid grid-cols-2 gap-16 text-sm">
        {/* SVG lines overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {lines.map((l) => (
            <line
              key={l.leftId}
              x1={l.x1} y1={l.y1}
              x2={l.x2} y2={l.y2}
              stroke={lineColor(l)}
              strokeWidth={2}
              strokeDasharray={l.correct === null ? '5 3' : undefined}
            />
          ))}
        </svg>

        <div className="space-y-2">
          {pairs.map((p) => {
            const isSelected = selected === p.id
            const isMatched = matches[p.id] !== undefined
            return (
              <button
                key={p.id}
                ref={(el) => { leftRefs.current[p.id] = el }}
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
                ref={(el) => { rightRefs.current[p.id] = el }}
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
