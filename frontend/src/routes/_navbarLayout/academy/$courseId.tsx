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

// ─── Types ────────────────────────────────────────────────

type FeedbackType = 'correct' | 'close' | 'wrong'

interface MCQOption {
  id: string
  text: string
  isCorrect: boolean
  feedback?: string
  feedbackType?: FeedbackType
}

interface LearningItem {
  _id: string
  title?: string
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

interface Page {
  item: LearningItem
  sectionTitle: string
}

interface ItemProps {
  item: LearningItem
  employeeCode: string
  courseId: string
  onComplete: () => void
  isCompleted: boolean
}

// ─── Route ────────────────────────────────────────────────

export const Route = createFileRoute('/_navbarLayout/academy/$courseId')({
  component: RouteComponent,
})

// ─── Helpers ──────────────────────────────────────────────

function makeAuthHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' }
}

function toEmbedUrl(url: string): string {
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  const watch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Route Component ──────────────────────────────────────

function RouteComponent() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [employeeCode, setEmployeeCode] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [isReturning, setIsReturning] = useState(false)
  const [courseStarted, setCourseStarted] = useState(false)

  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [completedPages, setCompletedPages] = useState<Set<number>>(new Set())

  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get(`/api/academy/learner/courses/${courseId}`, { headers: makeAuthHeaders() })
      .then((res) => setCourse(res.data))
      .catch((err) => {
        if (err.response?.status === 403) navigate({ to: '/no-access' })
        else navigate({ to: '/academy' })
      })
      .finally(() => setLoading(false))
  }, [courseId, navigate])

  async function handleLookup() {
    const num = codeInput.trim()
    if (!/^\d{4}$/.test(num)) {
      setCodeError('Please enter your 4-digit employee number.')
      return
    }
    setCodeError(null)
    setLookingUp(true)
    try {
      const [empRes, progressRes] = await Promise.all([
        axios.get('/api/academy/learner/employee-lookup', {
          params: { employeeNumber: num },
          headers: makeAuthHeaders(),
        }),
        axios
          .get(`/api/academy/learner/course-progress/${courseId}`, {
            params: { employeeCode: num },
            headers: makeAuthHeaders(),
          })
          .catch(() => ({ data: { currentPageIndex: 0, completedPages: [] } })),
      ])
      const progress = progressRes.data
      const hasProgress =
        (progress.currentPageIndex ?? 0) > 0 ||
        (progress.completedPages ?? []).length > 0
      setEmployeeCode(num)
      setEmployeeName(empRes.data.name)
      setCurrentPageIdx(progress.currentPageIndex ?? 0)
      setCompletedPages(new Set(progress.completedPages ?? []))
      setIsReturning(hasProgress)
    } catch (err: any) {
      setCodeError(
        err.response?.status === 404
          ? 'Employee number not found. Please try again.'
          : 'Unable to verify your employee number. Please try again.',
      )
    } finally {
      setLookingUp(false)
    }
  }

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

  function saveProgressToBackend(update: { currentPageIndex?: number; completedPageIndex?: number }) {
    if (!employeeCode) return
    axios
      .put('/api/academy/learner/course-progress', { employeeCode, courseId, ...update }, { headers: makeAuthHeaders() })
      .catch(() => {})
  }

  function markPageComplete(pageIdx: number) {
    if (completedPages.has(pageIdx)) return
    setCompletedPages((prev) => new Set([...prev, pageIdx]))
    saveProgressToBackend({ completedPageIndex: pageIdx })
  }

  function goToPage(idx: number) {
    const bounded = Math.max(0, Math.min(idx, pages.length - 1))
    setCurrentPageIdx(bounded)
    saveProgressToBackend({ currentPageIndex: bounded })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleComplete() {
    if (!employeeCode) return
    setCompleting(true)
    setCompleteError(null)
    try {
      await axios.post(
        `/api/academy/learner/courses/${courseId}/complete`,
        { employeeCode },
        { headers: makeAuthHeaders() },
      )
      setCompleted(true)
    } catch (err: any) {
      setCompleteError(
        err.response?.status === 404
          ? 'Code not found — check with your manager.'
          : 'Failed to record completion. Please try again.',
      )
    } finally {
      setCompleting(false)
    }
  }

  // ─── Screens ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!course) return null

  // Step 1 — employee number entry
  if (!employeeCode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gray-900 px-8 py-8 text-white text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-yellow-400">Gen 7 Academy</h1>
            <p className="mt-1 opacity-80 text-sm font-bold">{course.title.toUpperCase()}</p>
          </div>
          <div className="p-8 space-y-4">
            <p className="text-sm text-gray-500 text-center">Enter your 4-digit employee number.</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup() }}
              className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-red-500 transition-colors"
            />
            {codeError && <p className="text-sm text-red-500 text-center">{codeError}</p>}
            <button
              onClick={handleLookup}
              disabled={lookingUp || codeInput.length !== 4}
              className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-200"
            >
              {lookingUp ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2 — greeting (employee found, not yet started)
  if (!courseStarted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gray-900 px-8 py-8 text-white text-center">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-yellow-400">Gen 7 Academy</h1>
            <p className="mt-1 opacity-80 text-sm font-bold">{course.title.toUpperCase()}</p>
          </div>
          <div className="p-8 text-center space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                {isReturning ? 'Welcome back,' : 'Welcome,'}
              </p>
              <p className="text-2xl font-black text-gray-800 mt-1">{employeeName}</p>
            </div>
            <button
              onClick={() => setCourseStarted(true)}
              className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              {isReturning ? 'Resume Course →' : 'Start Course →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-sm text-gray-500">This course has no content yet.</p>
      </div>
    )
  }

  const currentPage = pages[currentPageIdx]
  const isFirst = currentPageIdx === 0
  const isLast = currentPageIdx === pages.length - 1
  const isPageCompleted = completedPages.has(currentPageIdx)

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans flex flex-col items-center pt-8 pb-16">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Dark header */}
        <div className="bg-gray-900 px-8 py-6 text-white">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Gen 7 Academy</p>
          <h1 className="text-xl font-black uppercase italic tracking-tight mt-1">
            {currentPage.item.title || currentPage.sectionTitle}
          </h1>
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm opacity-80 font-semibold">{currentPage.sectionTitle}</p>
            <p className="text-xs opacity-60 font-mono tabular-nums">{currentPageIdx + 1} / {pages.length}</p>
          </div>
          <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentPageIdx + 1) / pages.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Item content */}
        <div className="p-8">
          {isPageCompleted && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-semibold text-green-700">
              <span>✓</span> Completed
            </div>
          )}
          <LearningItemView
            key={currentPage.item._id}
            item={currentPage.item}
            employeeCode={employeeCode}
            courseId={courseId}
            onComplete={() => markPageComplete(currentPageIdx)}
            isCompleted={isPageCompleted}
          />
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8 flex items-center justify-between border-t border-gray-100 pt-6">
          <button
            onClick={() => goToPage(currentPageIdx - 1)}
            disabled={isFirst}
            className="rounded-2xl border-2 border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>

          {isLast ? (
            completed ? (
              <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-2.5 text-sm font-bold text-green-700">
                ✓ Course Completed!
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                {completeError && <p className="text-xs text-red-500">{completeError}</p>}
                <button
                  onClick={handleComplete}
                  disabled={completing || !isPageCompleted}
                  className="rounded-2xl bg-green-600 px-6 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-200"
                >
                  {completing ? 'Submitting…' : 'Complete Course ✓'}
                </button>
              </div>
            )
          ) : (
            <button
              onClick={() => goToPage(currentPageIdx + 1)}
              disabled={!isPageCompleted}
              className="rounded-2xl bg-red-600 px-6 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-200"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Learning Item Router ──────────────────────────────────

function LearningItemView({ item, employeeCode, courseId, onComplete, isCompleted }: ItemProps) {
  const { type, content } = item
  if (type === 'video') return <VideoItemView item={item} content={content} employeeCode={employeeCode} courseId={courseId} onComplete={onComplete} isCompleted={isCompleted} />
  if (type === 'mcq') return <MCQItemView content={content} onComplete={onComplete} isCompleted={isCompleted} />
  if (type === 'flip-card') return <FlipCardView content={content} onComplete={onComplete} isCompleted={isCompleted} />
  if (type === 'hotspot') return <HotspotItemView content={content} onComplete={onComplete} isCompleted={isCompleted} />
  if (type === 'ordering') return <OrderingItemView content={content} onComplete={onComplete} isCompleted={isCompleted} />
  if (type === 'matching') return <MatchingItemView content={content} onComplete={onComplete} isCompleted={isCompleted} />
  return null
}

// ─── Video ────────────────────────────────────────────────

function VideoItemView({
  item,
  content,
  employeeCode,
  courseId,
  onComplete,
  isCompleted,
}: {
  item: LearningItem
  content: Record<string, any>
  employeeCode: string
  courseId: string
  onComplete: () => void
  isCompleted: boolean
}) {
  const raw: string = content.url ?? content.src ?? ''
  if (!raw) return null
  const src = toEmbedUrl(raw)
  const isEmbed = src.includes('youtube.com/embed') || src.includes('player.vimeo')

  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCompletedRef = useRef(isCompleted)
  const [markedWatched, setMarkedWatched] = useState(isCompleted)

  const saveProgress = useCallback(
    (seconds: number) => {
      axios.put(
        '/api/academy/learner/video-progress',
        { employeeCode, courseId, itemId: item._id, progressSeconds: Math.floor(seconds) },
        { headers: makeAuthHeaders() },
      ).catch(() => {})
    },
    [employeeCode, courseId, item._id],
  )

  useEffect(() => {
    if (isEmbed || !employeeCode) return
    axios
      .get(`/api/academy/learner/video-progress/${courseId}/${item._id}`, {
        params: { employeeCode },
        headers: makeAuthHeaders(),
      })
      .then((res) => {
        const saved: number = res.data.progressSeconds ?? 0
        if (saved > 0 && videoRef.current) videoRef.current.currentTime = saved
      })
      .catch(() => {})
  }, [isEmbed, employeeCode, courseId, item._id])

  function handleTimeUpdate() {
    const v = videoRef.current
    if (!v) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveProgress(v.currentTime), 5000)
  }

  function handlePause() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (videoRef.current) saveProgress(videoRef.current.currentTime)
  }

  function handleEnded() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (videoRef.current) saveProgress(videoRef.current.currentTime)
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete()
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-gray-100">
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
            onPause={handlePause}
            onEnded={handleEnded}
          />
        )}
      </div>
      {isEmbed && !markedWatched && (
        <button
          onClick={() => {
            hasCompletedRef.current = true
            setMarkedWatched(true)
            onComplete()
          }}
          className="w-full rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition-colors"
        >
          Mark as Watched ✓
        </button>
      )}
    </div>
  )
}

// ─── MCQ ──────────────────────────────────────────────────

function MCQItemView({
  content,
  onComplete,
  isCompleted,
}: {
  content: Record<string, any>
  onComplete: () => void
  isCompleted: boolean
}) {
  const options = useMemo<MCQOption[]>(() => {
    const raw = content.options as Array<{
      id?: string
      text: string
      isCorrect?: boolean
      feedback?: string
      feedbackType?: FeedbackType
    } | string>
    return raw.map((o, i) =>
      typeof o === 'object'
        ? { id: o.id ?? String(i), text: o.text, isCorrect: o.isCorrect ?? false, feedback: o.feedback, feedbackType: o.feedbackType }
        : { id: String(i), text: o, isCorrect: false },
    )
  }, [content.options])

  const multipleCorrect = options.filter((o) => o.isCorrect).length > 1

  // Single-correct state
  const [selectedOpt, setSelectedOpt] = useState<MCQOption | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [answeredCorrectly, setAnsweredCorrectly] = useState(isCompleted)

  // Multi-correct state
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [multiChecked, setMultiChecked] = useState(false)
  const [multiCorrect, setMultiCorrect] = useState(isCompleted)

  function resolvedFeedbackType(opt: MCQOption): FeedbackType {
    return opt.feedbackType ?? (opt.isCorrect ? 'correct' : 'wrong')
  }

  function handleSingleSelect(opt: MCQOption) {
    setSelectedOpt(opt)
    setModalOpen(true)
  }

  function handleModalClose() {
    const ft = selectedOpt ? resolvedFeedbackType(selectedOpt) : 'wrong'
    if (ft === 'correct') {
      onComplete()
      setAnsweredCorrectly(true)
    } else {
      setSelectedOpt(null)
    }
    setModalOpen(false)
  }

  function toggleMulti(id: string) {
    if (multiCorrect) return
    setMultiSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setMultiChecked(false)
  }

  function handleMultiCheck() {
    setMultiChecked(true)
    const isCorrect = options.every((o) => o.isCorrect === multiSelected.has(o.id))
    if (isCorrect) {
      setMultiCorrect(true)
      onComplete()
    }
  }

  const theme = selectedOpt ? resolvedFeedbackType(selectedOpt) : 'wrong'

  // ── Multi-correct render ──
  if (multipleCorrect) {
    return (
      <div className="space-y-4">
        <p className="font-bold text-gray-800 text-lg leading-tight">{content.question as string}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Select all that apply</p>
        <div className="space-y-3">
          {options.map((o, i) => {
            const isSelected = multiSelected.has(o.id)
            const showResult = multiChecked || multiCorrect
            return (
              <button
                key={o.id}
                onClick={() => toggleMulti(o.id)}
                className={[
                  'w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex gap-4 items-center group',
                  showResult
                    ? o.isCorrect ? 'border-green-500 bg-green-50' : isSelected ? 'border-red-400 bg-red-50' : 'border-gray-100 opacity-50'
                    : isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30',
                ].join(' ')}
              >
                <span className={[
                  'w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-colors',
                  showResult
                    ? o.isCorrect ? 'bg-green-500 text-white' : isSelected ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-400'
                    : isSelected
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600',
                ].join(' ')}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-gray-700 font-semibold">{o.text}</span>
              </button>
            )
          })}
        </div>
        {multiCorrect ? (
          <p className="text-sm font-semibold text-green-600">✓ All correct!</p>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleMultiCheck}
              disabled={multiSelected.size === 0}
              className="rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Check Answer
            </button>
            {multiChecked && (
              <span className="text-sm font-semibold text-red-500">Not quite — try again</span>
            )}
          </div>
        )}
        {content.explanation && multiChecked && (
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 border border-gray-100">
            {content.explanation as string}
          </p>
        )}
      </div>
    )
  }

  // ── Single-correct render ──
  return (
    <div className="space-y-4">
      <p className="font-bold text-gray-800 text-lg leading-tight">{content.question as string}</p>
      <div className="space-y-3">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => handleSingleSelect(o)}
            className={[
              'w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex gap-4 items-center group',
              answeredCorrectly && o.isCorrect
                ? 'border-green-500 bg-green-50'
                : selectedOpt?.id === o.id && !modalOpen
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30',
            ].join(' ')}
          >
            <span className={[
              'w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-colors',
              answeredCorrectly && o.isCorrect
                ? 'bg-green-500 text-white'
                : selectedOpt?.id === o.id && !modalOpen
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600',
            ].join(' ')}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-gray-700 font-semibold">{o.text}</span>
          </button>
        ))}
      </div>

      {/* Feedback modal */}
      {modalOpen && selectedOpt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`h-3 w-full ${theme === 'correct' ? 'bg-green-500' : theme === 'close' ? 'bg-orange-500' : 'bg-red-500'}`} />
            <div className="p-10 text-center">
              <div className="text-6xl mb-6">
                {theme === 'correct' ? '✅' : theme === 'close' ? '📝' : '🚫'}
              </div>
              <h3 className={`text-3xl font-black mb-4 uppercase tracking-tighter ${
                theme === 'correct' ? 'text-green-600' : theme === 'close' ? 'text-orange-600' : 'text-red-600'
              }`}>
                {theme === 'correct' ? 'Awesome!' : theme === 'close' ? 'Nice Try!' : 'Not Quite!'}
              </h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                {selectedOpt.feedback || (
                  theme === 'correct'
                    ? "That's the right answer! Well done."
                    : "That's not the right answer. Give it another try!"
                )}
              </p>
              <button
                onClick={handleModalClose}
                className={`mt-8 w-full py-4 rounded-2xl font-black text-white shadow-lg transition-transform active:scale-95 uppercase tracking-widest ${
                  theme === 'correct'
                    ? 'bg-green-500 shadow-green-200'
                    : theme === 'close'
                      ? 'bg-orange-500 shadow-orange-200'
                      : 'bg-red-500 shadow-red-200'
                }`}
              >
                {theme === 'correct' ? 'Got it!' : 'Try Again'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Flip Card ────────────────────────────────────────────

function FlipCardView({
  content,
  onComplete,
  isCompleted,
}: {
  content: Record<string, any>
  onComplete: () => void
  isCompleted: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const hasCompletedRef = useRef(isCompleted)

  const handleFlip = () => {
    const next = !flipped
    setFlipped(next)
    if (next && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete()
    }
  }

  const front = content.front
  const back = content.back
  const frontText = typeof front === 'object' && front !== null ? (front as any).text : front
  const frontImage = typeof front === 'object' && front !== null ? (front as any).imageUrl : null
  const backText = typeof back === 'object' && back !== null ? (back as any).text : back
  const backImage = typeof back === 'object' && back !== null ? (back as any).imageUrl : null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {flipped ? 'Back' : 'Front'} — click the card to flip
      </p>
      {/* Perspective wrapper */}
      <div style={{ perspective: '1200px' }} className="w-full cursor-pointer" onClick={handleFlip}>
        {/* Rotating card — grid so container sizes to taller face */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'grid',
          }}
          className="w-full"
        >
          {/* Front face */}
          <div
            style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
            className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden text-center"
          >
            {frontImage && <img src={frontImage} alt="" className="w-full object-cover" />}
            <div className="p-8 text-gray-700 font-semibold text-base">
              {frontText}
              <p className="mt-3 text-xs text-gray-400 font-normal">Click to reveal answer</p>
            </div>
          </div>
          {/* Back face */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
            className="rounded-2xl border-2 border-red-200 bg-red-50/20 overflow-hidden text-center"
          >
            {backImage && <img src={backImage} alt="" className="w-full object-cover" />}
            <div className="p-8 text-gray-700 font-semibold text-base">
              {backText}
              <p className="mt-3 text-xs text-gray-400 font-normal">Click to flip back</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hotspot ──────────────────────────────────────────────

type Hotspot = { id?: string; x: number; y: number; label: string; description?: string }

function HotspotItemView({
  content,
  onComplete,
  isCompleted,
}: {
  content: Record<string, any>
  onComplete: () => void
  isCompleted: boolean
}) {
  const hotspots = (content.hotspots ?? []) as Hotspot[]
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const hasCompletedRef = useRef(isCompleted)

  const getId = (h: Hotspot, i: number) => h.id ?? String(i)

  const handleToggle = (id: string) => {
    setActiveId((prev) => (prev === id ? null : id))
    setClickedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      if (next.size === hotspots.length && !hasCompletedRef.current) {
        hasCompletedRef.current = true
        onComplete()
      }
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Click all hotspots to explore</p>
        <span className="text-xs font-bold text-yellow-500 tabular-nums">
          {clickedIds.size}/{hotspots.length} discovered
        </span>
      </div>
      <div className="relative inline-block w-full rounded-2xl border border-gray-100 overflow-hidden">
        <img src={content.imageUrl ?? content.image} alt="Hotspot" className="w-full" draggable={false} />
        {hotspots.map((h, i) => {
          const id = getId(h, i)
          const isActive = activeId === id
          const isClicked = clickedIds.has(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleToggle(id)}
              className={[
                'absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white text-xs font-black shadow-lg transition-all hover:scale-110',
                isActive ? 'bg-red-600 scale-110' : isClicked ? 'bg-green-500' : 'bg-blue-600',
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
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-gray-800">{idx + 1}. {h.label}</p>
              <button onClick={() => setActiveId(null)} className="text-gray-300 hover:text-gray-500 text-sm">✕</button>
            </div>
            {h.description && <p className="text-sm text-gray-600">{h.description}</p>}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Ordering ─────────────────────────────────────────────

type OrderingRow = { id: string; text: string }

function SortableRow({ row }: { row: OrderingRow }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-white px-4 py-3 text-sm font-semibold shadow-sm"
    >
      <button type="button" className="cursor-grab text-gray-300 touch-none hover:text-gray-500" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-gray-700">{row.text}</span>
    </div>
  )
}

function OrderingItemView({
  content,
  onComplete,
  isCompleted,
}: {
  content: Record<string, any>
  onComplete: () => void
  isCompleted: boolean
}) {
  const correctOrder = useMemo<OrderingRow[]>(() => {
    const raw = content.items as Array<{ id?: string; text: string } | string>
    return raw.map((item, i) => ({
      id: (typeof item === 'object' ? item.id : undefined) ?? String(i),
      text: typeof item === 'object' ? item.text : item,
    }))
  }, [content.items])

  const [rows, setRows] = useState<OrderingRow[]>(() => shuffle(correctOrder))
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(isCompleted)

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

  function handleCheck() {
    setChecked(true)
    const isCorrect = rows.every((r, i) => r.id === correctOrder[i].id)
    if (isCorrect && !correct) {
      setCorrect(true)
      onComplete()
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-bold text-gray-800 text-base">
        {content.prompt ?? content.question ?? 'Put these in the correct order:'}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((row) => <SortableRow key={row.id} row={row} />)}
          </div>
        </SortableContext>
      </DndContext>
      {correct ? (
        <p className="text-sm font-semibold text-green-600">✓ Correct order!</p>
      ) : (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleCheck}
            className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-red-700 transition-colors"
          >
            Check Order
          </button>
          {checked && (
            <span className="text-sm font-semibold text-red-500">Not quite — try again</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Matching ─────────────────────────────────────────────

type MatchingPair = { id: string; left: string; right: string }
type MatchLine = { leftId: string; x1: number; y1: number; x2: number; y2: number; correct: boolean | null }

function MatchingItemView({
  content,
  onComplete,
  isCompleted,
}: {
  content: Record<string, any>
  onComplete: () => void
  isCompleted: boolean
}) {
  const pairs = useMemo<MatchingPair[]>(() => {
    const raw = content.pairs as Array<{ id?: string; left: string; right: string }>
    return raw.map((p, i) => ({ id: p.id ?? String(i), left: p.left, right: p.right }))
  }, [content.pairs])

  const [rightOptions] = useState<MatchingPair[]>(() => shuffle(pairs))
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(isCompleted)
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
    if (correct) return
    setSelectedLeft((prev) => (prev === id ? null : id))
    setChecked(false)
  }

  const handleRightClick = (rightId: string) => {
    if (!selectedLeft || correct) return
    setMatches((prev) => ({ ...prev, [selectedLeft]: rightId }))
    setSelectedLeft(null)
    setChecked(false)
  }

  function handleCheck() {
    setChecked(true)
    const isCorrect = pairs.every((p) => matches[p.id] === p.id)
    if (isCorrect && !correct) {
      setCorrect(true)
      onComplete()
    }
  }

  const allMatched = pairs.every((p) => matches[p.id] !== undefined)
  const lineColor = (l: MatchLine) =>
    l.correct === null ? '#dc2626' : l.correct ? '#16a34a' : '#ef4444'

  return (
    <div className="space-y-4">
      <p className="font-bold text-gray-800 text-base">
        {content.prompt ?? content.question ?? 'Match the following:'}
      </p>
      <div ref={containerRef} className="relative grid grid-cols-2 gap-16 text-sm">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {lines.map((l) => (
            <line
              key={l.leftId}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={lineColor(l)}
              strokeWidth={2.5}
              strokeDasharray={l.correct === null ? '5 3' : undefined}
            />
          ))}
        </svg>

        <div className="space-y-2">
          {pairs.map((p) => {
            const isSelected = selectedLeft === p.id
            const isMatched = matches[p.id] !== undefined
            return (
              <button
                key={p.id}
                ref={(el) => { leftRefs.current[p.id] = el }}
                onClick={() => handleLeftClick(p.id)}
                className={[
                  'w-full rounded-2xl px-3 py-2.5 text-left font-semibold transition-colors border-2',
                  isSelected ? 'bg-red-600 text-white border-red-600'
                    : isMatched ? 'bg-red-50 border-red-200'
                    : 'bg-gray-100 border-transparent hover:bg-red-50 hover:border-red-200',
                ].join(' ')}
              >
                {p.left}
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          {rightOptions.map((p) => {
            const isMatchedBySelected = selectedLeft !== null && matches[selectedLeft] === p.id
            const isMatchedByAny = Object.values(matches).includes(p.id)
            return (
              <button
                key={p.id}
                ref={(el) => { rightRefs.current[p.id] = el }}
                onClick={() => handleRightClick(p.id)}
                className={[
                  'w-full rounded-2xl px-3 py-2.5 text-left font-semibold transition-colors border-2',
                  isMatchedBySelected ? 'bg-red-600 text-white border-red-600'
                    : isMatchedByAny ? 'bg-red-50 border-red-200'
                    : selectedLeft ? 'bg-white border-gray-200 hover:bg-red-50 hover:border-red-200 cursor-pointer'
                    : 'bg-white border-gray-200',
                ].join(' ')}
              >
                {p.right}
              </button>
            )
          })}
        </div>
      </div>

      {selectedLeft && (
        <p className="text-xs font-semibold text-yellow-500">Now click an item on the right to match it</p>
      )}

      {correct ? (
        <p className="text-sm font-semibold text-green-600">✓ All matched correctly!</p>
      ) : (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleCheck}
            disabled={!allMatched}
            className="rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check Matches
          </button>
          <button
            onClick={() => { setMatches({}); setSelectedLeft(null); setChecked(false) }}
            className="rounded-2xl border-2 border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          {checked && (
            <span className="text-sm font-semibold text-red-500">Not quite — try again</span>
          )}
        </div>
      )}
    </div>
  )
}
