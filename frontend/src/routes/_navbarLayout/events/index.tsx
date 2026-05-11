import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'

interface EventDoc {
  _id: string
  site: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  createdBy: {
    id: string
    firstName?: string
    lastName?: string
    email?: string
  }
  createdAt: string
  updatedAt: string
}

export const Route = createFileRoute('/_navbarLayout/events/')({
  component: RouteComponent,
  loader: async () => {
    try {
      const res = await fetch('/api/events', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })
      if (!res.ok) return { events: [] as EventDoc[] }
      const json = await res.json()
      return { events: (json.data || []) as EventDoc[] }
    } catch {
      return { events: [] as EventDoc[] }
    }
  },
})

// ── Date helpers (local time, no UTC drift) ────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function authorName(ev: EventDoc) {
  const f = ev.createdBy?.firstName || ''
  const l = ev.createdBy?.lastName || ''
  const full = `${f} ${l}`.trim()
  return full || ev.createdBy?.email || 'Unknown'
}

// How many days into the future to render in the scrollable calendar.
const DAYS_TO_RENDER = 90

function RouteComponent() {
  const router = useRouter()
  const { user } = useAuth()
  const { events } = Route.useLoaderData() as { events: EventDoc[] }

  const [composeDate, setComposeDate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)

  const [viewing, setViewing] = useState<EventDoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)

  const todayIso = useMemo(() => toIsoDate(new Date()), [])

  // Group events by date for O(1) lookup.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventDoc[]>()
    for (const ev of events) {
      const list = map.get(ev.date) || []
      list.push(ev)
      map.set(ev.date, list)
    }
    return map
  }, [events])

  // Build the day list (today + next N-1 days) grouped by month.
  const monthGroups = useMemo(() => {
    const start = parseIsoDate(todayIso)
    const groups: { key: string; label: string; days: { iso: string; date: Date }[] }[] = []
    let currentKey = ''
    let currentGroup: (typeof groups)[number] | null = null

    for (let i = 0; i < DAYS_TO_RENDER; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      if (key !== currentKey) {
        currentKey = key
        currentGroup = {
          key,
          label: `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`,
          days: [],
        }
        groups.push(currentGroup)
      }
      currentGroup!.days.push({ iso: toIsoDate(d), date: d })
    }
    return groups
  }, [todayIso])

  // Scroll today's row into view on mount.
  const todayRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [])

  const openCompose = (iso: string) => {
    setComposeDate(iso)
    setTitle('')
    setDescription('')
    setComposeError(null)
  }

  const submitEvent = async () => {
    if (!composeDate) return
    if (!title.trim()) {
      setComposeError('Title is required.')
      return
    }
    setSubmitting(true)
    setComposeError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          date: composeDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to create event.')
      }
      setComposeDate(null)
      await router.invalidate()
    } catch (err: any) {
      setComposeError(err?.message || 'Failed to create event.')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteEvent = async () => {
    if (!viewing) return
    setDeleting(true)
    setViewError(null)
    try {
      const res = await fetch(`/api/events/${viewing._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to delete event.')
      }
      setViewing(null)
      await router.invalidate()
    } catch (err: any) {
      setViewError(err?.message || 'Failed to delete event.')
    } finally {
      setDeleting(false)
    }
  }

  const canDeleteViewing =
    !!viewing &&
    (String(viewing.createdBy?.id) === String(user?.id) || (user as any)?.is_admin)

  const formatLongDate = (iso: string) => {
    const d = parseIsoDate(iso)
    return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }

  return (
    <div className="pt-4 w-full flex flex-col items-center">
      <div className="w-full max-w-3xl px-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.location ? `Upcoming events for ${user.location}` : 'Upcoming events for your site'}
            {' '}— click any date to add an event.
          </p>
        </div>

        <div className="border rounded-md divide-y max-h-[75vh] overflow-y-auto bg-background">
          {monthGroups.map((group) => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                {group.label}
              </div>
              <div className="divide-y">
                {group.days.map(({ iso, date }) => {
                  const dayEvents = eventsByDate.get(iso) || []
                  const isToday = iso === todayIso
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6

                  return (
                    <div
                      key={iso}
                      ref={isToday ? todayRef : undefined}
                      onClick={() => openCompose(iso)}
                      className={`group flex items-start gap-4 px-4 py-3 cursor-pointer transition hover:bg-primary/5 ${isWeekend ? 'bg-muted/20' : ''}`}
                    >
                      {/* Date column */}
                      <div className="w-14 shrink-0 text-center">
                        <div className={`text-2xl font-bold leading-none ${isToday ? 'text-primary' : 'text-gray-800'}`}>
                          {date.getDate()}
                        </div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
                          {WEEKDAY_SHORT[date.getDay()]}
                        </div>
                        {isToday && (
                          <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-primary text-primary-foreground">
                            Today
                          </div>
                        )}
                      </div>

                      {/* Events column */}
                      <div className="flex-1 min-w-0">
                        {dayEvents.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic opacity-0 group-hover:opacity-100 transition">
                            Click to add an event
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {dayEvents.map((ev) => (
                              <button
                                key={ev._id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setViewError(null)
                                  setViewing(ev)
                                }}
                                className="w-full text-left rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-2 transition"
                              >
                                <div className="text-sm font-semibold text-gray-800 truncate">{ev.title}</div>
                                {ev.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-1">{ev.description}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCompose(iso)
                        }}
                        aria-label={`Add event on ${iso}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog
        open={!!composeDate}
        onOpenChange={(open) => {
          if (!open && !submitting) setComposeDate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              {composeDate && formatLongDate(composeDate)}
              {user?.location && <> • {user.location}</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                maxLength={200}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details…"
                rows={4}
                maxLength={2000}
                disabled={submitting}
              />
            </div>
          </div>
          {composeError && <p className="text-sm text-destructive">{composeError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposeDate(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitEvent} disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / delete dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setViewing(null)
            setViewError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            {viewing && (
              <DialogDescription>
                {formatLongDate(viewing.date)} • Posted by {authorName(viewing)}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewing?.description && (
            <div className="rounded-md bg-muted/40 border p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
            </div>
          )}
          {viewError && <p className="text-sm text-destructive">{viewError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewing(null)}
              disabled={deleting}
            >
              Close
            </Button>
            {canDeleteViewing && (
              <Button
                type="button"
                variant="destructive"
                onClick={deleteEvent}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
