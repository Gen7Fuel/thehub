import * as React from 'react'
import { useEffect, useRef } from 'react'
import { createFileRoute, useLoaderData, useNavigate } from '@tanstack/react-router'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import { pdf, Document, Page, Image as PdfImage, StyleSheet } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { Trash2, MessageSquareText, RefreshCcw } from 'lucide-react'


type BOLPhoto = {
  _id: string
  site: string
  date: string // YYYY-MM-DD
  filename: string
  bolNumber?: string
  createdAt?: string
  updatedAt?: string
  comments?: Array<{ text: string; createdAt: string; user?: string }>
}
type Search = { site: string; from: string; to: string }
type ListResponse = {
  site: string
  from: string | null
  to: string | null
  count: number
  entries: BOLPhoto[]
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const parseYmd = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const Route = createFileRoute('/_navbarLayout/fuel-rec/list')({
  validateSearch: (search: Record<string, any>) => {
    const today = new Date()
    const last7From = subDays(today, 6)
    return {
      site: typeof search.site === 'string' ? search.site : '',
      from: typeof search.from === 'string' ? search.from : ymd(last7From),
      to: typeof search.to === 'string' ? search.to : ymd(today),
    } as Search
  },
  loaderDeps: ({ search }) => ({ site: search.site, from: search.from, to: search.to }),
  loader: async ({ deps }) => {
    const { site, from, to } = deps as Search
    if (!site || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return { site, from, to, data: null as ListResponse | null }
    }
    const res = await fetch(
      `/api/fuel-rec/list?site=${encodeURIComponent(site)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as ListResponse
    return { site, from, to, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth();
  const access = user?.access || {}

  const { site, from, to, data } = useLoaderData({ from: Route.id }) as {
    site: string
    from: string
    to: string
    data: ListResponse | null
  }
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<Search>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...next }) })

  const range: DateRange | undefined = React.useMemo(() => {
    const f = parseYmd(from)
    const t = parseYmd(to)
    return f && t ? { from: f, to: t } : undefined
  }, [from, to])

  const onRangeSet: React.Dispatch<React.SetStateAction<DateRange | undefined>> = (val) => {
    const next = typeof val === 'function' ? val(range) : val
    if (!next?.from || !next?.to) return
    setSearch({ from: ymd(next.from), to: ymd(next.to) })
  }

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        page: { padding: 16 },
        image: { width: '100%', height: '100%', objectFit: 'contain' },
      }),
    []
  )

  const fetchAsDataUrl = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load image (${res.status})`)
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Track in-flight requests per entry
  const [pending, setPending] = React.useState<Set<string>>(() => new Set())
  // Local entries state for optimistic delete updates
  const [entries, setEntries] = React.useState<BOLPhoto[]>(() => data?.entries || [])
  React.useEffect(() => {
    setEntries(data?.entries || [])
  }, [data])

  // Modal state for image preview
  const [modalImg, setModalImg] = React.useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  // Comment modal state
  const [commentModal, setCommentModal] = React.useState<{ entry: BOLPhoto | null }>(() => ({ entry: null }))
  const [commentText, setCommentText] = React.useState('')
  const [commentPending, setCommentPending] = React.useState(false)
  const [commentError, setCommentError] = React.useState<string | null>(null)

  // Close modal on ESC
  useEffect(() => {
    if (!modalImg && !commentModal.entry) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalImg(null);
        setCommentModal({ entry: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalImg, commentModal.entry]);

  const requestAgain = async (e: BOLPhoto) => {
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch('/api/fuel-rec/request-again', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site: e.site, date: e.date }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      alert(`Retake request sent for ${e.site} on ${e.date}.`)
    } catch (err) {
      alert(`Retake request failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }

  const sanitizeSegment = (s?: string) => {
    var n = (s ?? '').toString()
    var invalid = '<>:"/\\|?*'
    var out = ''
    var prevSpace = false
    for (var i = 0; i < n.length; i++) {
      var ch = n[i]
      var code = ch.charCodeAt(0)
      var isInvalid = (invalid.indexOf(ch) !== -1) || (code < 32)
      var mapped = isInvalid ? ' ' : ch
      var isSpace = mapped === ' '
      if (isSpace) {
        if (!prevSpace && out.length > 0) {
          out += ' '
        }
        prevSpace = true
      } else {
        out += mapped
        prevSpace = false
      }
    }
    if (out.endsWith(' ')) out = out.slice(0, -1)
    return out
  }

  const formatDesiredName = (e: BOLPhoto) => {
    const date = (e.date || '').trim()
    const site = sanitizeSegment(e.site)
    const bol = sanitizeSegment(e.bolNumber || '')
    const parts = [date, site, bol].filter(Boolean)
    return parts.join(' - ')
  }

  const downloadPdfForEntry = async (e: BOLPhoto) => {
    try {
      const imgUrl = `/cdn/download/${e.filename}`
      const dataUrl = await fetchAsDataUrl(imgUrl)
      const Doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <PdfImage src={dataUrl} style={styles.image} />
          </Page>
        </Document>
      )
      const blob = await pdf(Doc).toBlob()
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      const dot = e.filename.lastIndexOf('.')
      const base = dot > 0 ? e.filename.slice(0, dot) : e.filename
      const desired = formatDesiredName(e) || base
      a.download = `${desired}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`PDF download failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const deleteEntry = async (e: BOLPhoto) => {
    if (!access?.accounting?.fuelRec?.delete) return
    const ok = window.confirm(`Delete entry for ${e.site} on ${e.date}? This cannot be undone.`)
    if (!ok) return
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(e._id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.fuelRec.delete',
        },
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      setEntries((prev) => prev.filter((x) => x._id !== e._id))
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePickerWithRange date={range} setDate={onRangeSet} />
      </div>

      {!site && <div className="text-xs text-muted-foreground">Pick a site to view BOL entries.</div>}

      {data && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Showing {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} for {data.site} from {data.from} to {data.to}
          </div>
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">BOL Number</th>
                    <th className="px-2 py-2">Preview</th>
                    {/* <th className="px-2 py-2">Created</th> */}
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id} className="border-b">
                      <td className="px-2 py-2 font-mono">{e.date}</td>
                      <td className="px-2 py-2">{e.bolNumber || '—'}</td>
                      <td className="px-2 py-2">
                        <img
                          src={`/cdn/download/${e.filename}`}
                          alt={`${e.date} preview`}
                          className="w-16 h-16 object-cover rounded border cursor-pointer"
                          loading="lazy"
                          onClick={() => setModalImg(`/cdn/download/${e.filename}`)}
                        />
                      </td>
                      {/* ...existing code... */}
                      <td className="px-2 py-2 space-x-3">
                        <Button
                          onClick={() => downloadPdfForEntry(e)}
                        >
                          PDF
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCommentModal({ entry: e })}
                          title="Comments"
                          aria-label="Comments"
                          className="relative"
                        >
                          <MessageSquareText className="h-4 w-4" />
                          <span className="sr-only">Comments</span>
                          {e.comments && e.comments.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center border border-white">
                              {e.comments.length}
                            </span>
                          )}
                        </Button>

                        {access?.accounting?.fuelRec?.requestAgain && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => requestAgain(e)}
                            disabled={pending.has(e._id)}
                            title="Request Again"
                            aria-label="Request Again"
                          >
                            {pending.has(e._id) ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        {access?.accounting?.fuelRec?.delete && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteEntry(e)}
                            disabled={pending.has(e._id)}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal for image preview */}
      {modalImg && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={() => setModalImg(null)}
          tabIndex={-1}
        >
          <img
            src={modalImg}
            alt="Full preview"
            className="w-full h-full object-contain absolute top-0 left-0"
            style={{ zIndex: 51 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-900 z-60"
            onClick={() => setModalImg(null)}
            autoFocus
          >
            Close
          </button>
        </div>
      )}

      {/* Modal for comments */}
      {commentModal.entry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
          onClick={() => setCommentModal({ entry: null })}
          tabIndex={-1}
        >
          <div
            className="relative bg-white rounded shadow-lg p-4 max-w-lg w-full flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-lg">Comments</div>
              <button
                className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-900"
                onClick={() => setCommentModal({ entry: null })}
              >
                Close
              </button>
            </div>
            {/* Previous comments */}
            <div className="mb-4 max-h-48 overflow-y-auto">
              {commentModal.entry.comments && commentModal.entry.comments.length > 0 ? (
                commentModal.entry.comments.map((c, idx) => (
                  <div key={idx} className="mb-2 p-2 border rounded bg-gray-50">
                    <div className="text-xs text-muted-foreground mb-1">
                      {c.user ? `${c.user} • ` : ''}{new Date(c.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm">{c.text}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No comments yet.</div>
              )}
            </div>
            {/* New comment input */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!commentText.trim()) return;
                setCommentPending(true);
                setCommentError(null);
                try {
                  // Replace with actual API endpoint
                  const res = await fetch(`/api/fuel-rec/${encodeURIComponent(commentModal.entry._id)}/comment`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                    },
                    body: JSON.stringify({ text: commentText }),
                  });
                  if (!res.ok) {
                    const msg = await res.text().catch(() => '');
                    throw new Error(msg || `HTTP ${res.status}`);
                  }
                  // Update local state with returned comments array
                  const result = await res.json();
                  if (!result.comments) throw new Error('No comments returned');
                  setEntries(prev => prev.map(x =>
                    x._id === commentModal.entry!._id
                      ? { ...x, comments: result.comments }
                      : x
                  ));
                  setCommentModal(cm => cm.entry ? {
                    entry: { ...cm.entry, comments: result.comments }
                  } : cm);
                  setCommentText('');
                } catch (err) {
                  setCommentError(err instanceof Error ? err.message : String(err));
                } finally {
                  setCommentPending(false);
                }
              }}
              className="flex flex-col gap-2"
            >
              <textarea
                className="border rounded p-2 text-sm resize-none"
                rows={3}
                placeholder="Add a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                disabled={commentPending}
                autoFocus
              />
              {commentError && <div className="text-xs text-red-600">{commentError}</div>}
              <Button type="submit" disabled={commentPending || !commentText.trim()}>
                {commentPending ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}