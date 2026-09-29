import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

// Trainer-facing MCQ walkthrough for a single course. Pulls the same
// published-course data Academy uses, but only ever renders the `mcq`
// items (flattened across all sections, in order) — no videos/other content
// types, no employee-number gate, and no progress/completion is ever saved.
// The user can always move to the next question regardless of whether their
// answer was right; at the end they can restart or head back to the list.

type FeedbackType = 'correct' | 'close' | 'wrong'

interface MCQOption {
  id: string
  text: string
  isCorrect: boolean
  feedback?: string
  feedbackType?: FeedbackType
}

interface MCQContent {
  question: string
  explanation?: string
  options: MCQOption[]
}

interface MCQPage {
  id: string
  content: MCQContent
}

interface CourseData {
  title: string
  pages: MCQPage[]
}

export const Route = createFileRoute('/_navbarLayout/ai-customer/mcq/$courseId')({
  component: RouteComponent,
})

function makeAuthHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'academy' }
}

// The hardcoded "classic" question, kept as its own course in the list so
// the feedback-modal styling has a known-good reference to check against.
const DEMO_COURSE: CourseData = {
  title: 'Demo',
  pages: [
    {
      id: 'demo-1',
      content: {
        question: 'What are the Gen 7 Customer Engagement Standards?',
        options: [
          {
            id: 'A',
            text: 'Ask customer what they are looking for, put down your cell phone and punch in their sale.',
            isCorrect: false,
            feedbackType: 'wrong',
            feedback: "Just a reminder: Being on your cell phone while on the floor is against Gen 7 policies and procedures. Keeping your focus entirely on the customers helps us provide that top-tier service!",
          },
          {
            id: 'B',
            text: 'Say Hello to customer. Ask them what they want. If they are buying fuel ask them what pump they are at. Confirm the sale. Tap the Gen 7 cash card and method of payment.',
            isCorrect: false,
            feedbackType: 'close',
            feedback: "You're getting there! In this scenario, we missed asking for the Status Card and the Gen 7 Cash Card. Also, don't forget to thank the customer—it's the Gen 7 way!",
          },
          {
            id: 'C',
            text: 'Say Hi and smile at the customer. Confirm pump number, $sale, and fuel grade. Ask customer if they have a status card. Ask customer for Gen 7 cash card, if customer does not have a card, tap and give them one. Thank the customer and process the sale.',
            isCorrect: true,
            feedbackType: 'correct',
            feedback: "Spot on! You're a Gen 7 Rockstar. 🌟 You covered all the bases from the smile to the rewards. Keep that gold standard going!",
          },
          {
            id: 'D',
            text: 'Say Hi and smile at the customer. Confirm pump number, $sale, and fuel grade. Ask customer for Gen 7 cash card, if customer does not have a card, tap and give them one. Thank the customer and process the sale.',
            isCorrect: false,
            feedbackType: 'close',
            feedback: "So close! You missed asking for the Status Card. Remember: once a transaction is finished, it cannot be undone if the status card isn't attached. We want to make sure our customers get their benefits every time!",
          },
        ],
      },
    },
  ],
}

function normalizeOptions(raw: any[]): MCQOption[] {
  return (raw ?? []).map((o, i) =>
    typeof o === 'object' && o !== null
      ? { id: o.id ?? String(i), text: o.text, isCorrect: o.isCorrect ?? false, feedback: o.feedback, feedbackType: o.feedbackType }
      : { id: String(i), text: String(o), isCorrect: false },
  )
}

function RouteComponent() {
  const { courseId } = Route.useParams()
  const navigate = useNavigate()
  const isDemo = courseId === 'demo'

  const [course, setCourse] = useState<CourseData | null>(isDemo ? DEMO_COURSE : null)
  const [loading, setLoading] = useState(!isDemo)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    setLoading(true)
    setError(null)
    axios
      .get(`/api/academy/learner/courses/${courseId}`, { headers: makeAuthHeaders() })
      .then((res) => {
        const raw = res.data
        const pages: MCQPage[] = []
        const sections = [...(raw.sections ?? [])].sort((a: any, b: any) => a.order - b.order)
        for (const section of sections) {
          const items = [...(section.items ?? [])].sort((a: any, b: any) => a.order - b.order)
          for (const item of items) {
            if (item.type !== 'mcq') continue
            pages.push({
              id: item._id,
              content: {
                question: item.content?.question ?? '',
                explanation: item.content?.explanation,
                options: normalizeOptions(item.content?.options ?? []),
              },
            })
          }
        }
        setCourse({ title: raw.title, pages })
      })
      .catch((err) => {
        if (err.response?.status === 403) navigate({ to: '/no-access' })
        else if (err.response?.status === 404) setError('Course not found.')
        else setError('Failed to load course.')
      })
      .finally(() => setLoading(false))
  }, [courseId, isDemo, navigate])

  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)

  function goBackToList() {
    navigate({ to: '/ai-customer/mcq' })
  }

  function restart() {
    setIndex(0)
    setFinished(false)
  }

  function handleNext() {
    if (!course) return
    if (index >= course.pages.length - 1) setFinished(true)
    else setIndex((i) => i + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center space-y-4">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={goBackToList}
            className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            ← Back to MCQs
          </button>
        </div>
      </div>
    )
  }

  if (!course) return null

  if (course.pages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center space-y-4">
          <p className="text-sm text-gray-500">This course has no MCQs yet.</p>
          <button
            onClick={goBackToList}
            className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black text-white uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            ← Back to MCQs
          </button>
        </div>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-green-600 px-8 py-8 text-white text-center">
            <div className="text-5xl mb-2">✅</div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter">All Done!</h1>
          </div>
          <div className="p-8 text-center space-y-6">
            <p className="text-sm text-gray-500">
              You've gone through all {course.pages.length} question{course.pages.length !== 1 ? 's' : ''} in{' '}
              <span className="font-semibold text-gray-700">{course.title}</span>.
            </p>
            <div className="space-y-3">
              <button
                onClick={restart}
                className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Restart ↻
              </button>
              <button
                onClick={goBackToList}
                className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm font-black text-gray-600 uppercase tracking-widest hover:bg-gray-50 transition-colors"
              >
                ← Back to MCQs
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const page = course.pages[index]
  const isLast = index === course.pages.length - 1

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans flex flex-col items-center pt-8 pb-16">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-8 py-6 text-white">
          <button
            onClick={goBackToList}
            className="text-xs font-bold text-white/70 hover:text-white uppercase tracking-widest transition-colors"
          >
            ← Back to MCQs
          </button>
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest mt-3">Gen 7 Academy</p>
          <h1 className="text-xl font-black uppercase italic tracking-tight mt-1">{course.title}</h1>
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm opacity-80 font-semibold">MCQ Practice</p>
            <p className="text-xs opacity-60 font-mono tabular-nums">{index + 1} / {course.pages.length}</p>
          </div>
          <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${((index + 1) / course.pages.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-8">
          <MCQQuestion key={page.id} content={page.content} onNext={handleNext} isLast={isLast} />
        </div>
      </div>
    </div>
  )
}

// ─── Single MCQ question, self-contained ───────────────────
//
// No completion tracking of any kind — "Next" only requires that the
// trainer has interacted with the question (selected an option, or checked
// their multi-select answer), never that they got it right.

function resolvedFeedbackType(opt: MCQOption): FeedbackType {
  return opt.feedbackType ?? (opt.isCorrect ? 'correct' : 'wrong')
}

function MCQQuestion({ content, onNext, isLast }: { content: MCQContent; onNext: () => void; isLast: boolean }) {
  const options = content.options
  const multipleCorrect = useMemo(() => options.filter((o) => o.isCorrect).length > 1, [options])

  // Single-correct state
  const [selectedOpt, setSelectedOpt] = useState<MCQOption | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [answered, setAnswered] = useState(false)

  // Multi-correct state
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [multiChecked, setMultiChecked] = useState(false)

  function handleSingleSelect(opt: MCQOption) {
    setSelectedOpt(opt)
    setModalOpen(true)
  }

  function handleModalClose() {
    setAnswered(true)
    setModalOpen(false)
  }

  function toggleMulti(id: string) {
    if (multiChecked) return
    setMultiSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const theme: FeedbackType = selectedOpt ? resolvedFeedbackType(selectedOpt) : 'wrong'

  // ── Multi-correct render ──
  if (multipleCorrect) {
    const allCorrect = multiChecked && options.every((o) => o.isCorrect === multiSelected.has(o.id))
    return (
      <div className="space-y-4">
        <p className="font-bold text-gray-800 text-lg leading-tight">{content.question}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Select all that apply</p>
        <div className="space-y-3">
          {options.map((o, i) => {
            const isSelected = multiSelected.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => toggleMulti(o.id)}
                className={[
                  'w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex gap-4 items-center group',
                  multiChecked
                    ? o.isCorrect ? 'border-green-500 bg-green-50' : isSelected ? 'border-red-400 bg-red-50' : 'border-gray-100 opacity-50'
                    : isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30',
                ].join(' ')}
              >
                <span className={[
                  'w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-colors',
                  multiChecked
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
        {content.explanation && multiChecked && (
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 border border-gray-100">
            {content.explanation}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          {!multiChecked ? (
            <button
              onClick={() => setMultiChecked(true)}
              disabled={multiSelected.size === 0}
              className="rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Check Answer
            </button>
          ) : (
            <span className={`text-sm font-semibold ${allCorrect ? 'text-green-600' : 'text-red-500'}`}>
              {allCorrect ? '✓ All correct!' : 'Not quite — correct answers highlighted above.'}
            </span>
          )}
          <button
            onClick={onNext}
            disabled={!multiChecked}
            className="ml-auto rounded-2xl bg-red-600 px-6 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLast ? 'Finish ✓' : 'Next →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Single-correct render ──
  return (
    <div className="space-y-4">
      <p className="font-bold text-gray-800 text-lg leading-tight">{content.question}</p>
      <div className="space-y-3">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => handleSingleSelect(o)}
            className={[
              'w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex gap-4 items-center group',
              selectedOpt?.id === o.id && !modalOpen
                ? resolvedFeedbackType(o) === 'correct'
                  ? 'border-green-500 bg-green-50'
                  : resolvedFeedbackType(o) === 'close'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-red-500 bg-red-50'
                : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30',
            ].join(' ')}
          >
            <span className={[
              'w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-colors',
              selectedOpt?.id === o.id && !modalOpen
                ? resolvedFeedbackType(o) === 'correct'
                  ? 'bg-green-500 text-white'
                  : resolvedFeedbackType(o) === 'close'
                    ? 'bg-orange-500 text-white'
                    : 'bg-red-500 text-white'
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
                {theme === 'correct' ? 'Awesome!' : theme === 'close' ? 'Nice Try!' : 'Quick Warning'}
              </h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                {selectedOpt.feedback || (
                  theme === 'correct'
                    ? "That's the right answer! Well done."
                    : "That's not the right answer."
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
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={onNext}
          disabled={!answered}
          className="rounded-2xl bg-red-600 px-6 py-2.5 text-sm font-black text-white uppercase tracking-wider hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLast ? 'Finish ✓' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
