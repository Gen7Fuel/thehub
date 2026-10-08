import * as React from 'react'
import { createFileRoute, useLoaderData, useNavigate } from '@tanstack/react-router'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import { pdf, Document, Page, Image as PdfImage, StyleSheet } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { ClipboardCheck, Trash2, MessageSquareText, RefreshCcw, ExternalLink, Link2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'


type BOLPhoto = {
  _id: string
  site: string
  date: string // YYYY-MM-DD
  filename: string
  bolNumber?: string
  poLinked?: boolean
  poNumber?: string
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
type FuelOrderCandidate = {
  _id: string
  poNumber: string
  estimatedDeliveryDate?: string
  originalDeliveryDate?: string
  estimatedDeliveryWindow?: { start?: string; end?: string }
  supplier?: { supplierName?: string }
  carrier?: { carrierName?: string }
  rack?: { rackName?: string; rackLocation?: string }
  items?: Array<{ grade: string; ltrs: number }>
}
type FuelOrderItem = { grade: string; ltrs: number }
type LinkablePoResponse = {
  from: string
  to: string
  count: number
  orders: FuelOrderCandidate[]
  linkedOrder?: FuelOrderCandidate | null
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

  const [locationNames, setLocationNames] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    fetch('/api/locations', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((r) => r.json())
      .then((data: Array<{ stationName: string; legalName?: string }>) => {
        const map: Record<string, string> = {}
        for (const loc of data) {
          if (loc.stationName === 'Silver Grizzly' && loc.legalName) map[loc.stationName] = loc.legalName
        }
        setLocationNames(map)
      })
      .catch(() => {})
  }, [])

  // Track in-flight requests per entry
  const [pending, setPending] = React.useState<Set<string>>(() => new Set())
  // Local entries state for optimistic delete updates
  const [entries, setEntries] = React.useState<BOLPhoto[]>(() => data?.entries || [])
  React.useEffect(() => {
    setEntries(data?.entries || [])
  }, [data])

  // Modal States
  const [selectedImg, setSelectedImg] = React.useState<string | null>(null)
  const [activeCommentEntry, setActiveCommentEntry] = React.useState<BOLPhoto | null>(null)
  const [commentText, setCommentText] = React.useState('')
  const [commentPending, setCommentPending] = React.useState(false)
  const [activeLinkEntry, setActiveLinkEntry] = React.useState<BOLPhoto | null>(null)
  const [linkableOrders, setLinkableOrders] = React.useState<FuelOrderCandidate[]>([])
  const [linkRange, setLinkRange] = React.useState<{ from: string; to: string } | null>(null)
  const [linkLoading, setLinkLoading] = React.useState(false)
  const [linkPendingOrderId, setLinkPendingOrderId] = React.useState<string | null>(null)
  const [linkDaysBack, setLinkDaysBack] = React.useState(2)
  const [linkedOrder, setLinkedOrder] = React.useState<FuelOrderCandidate | null>(null)
  const [unlinkPending, setUnlinkPending] = React.useState(false)
  const [reviewOrder, setReviewOrder] = React.useState<FuelOrderCandidate | null>(null)
  const [reviewItems, setReviewItems] = React.useState<FuelOrderItem[]>([])
  const [retainItems, setRetainItems] = React.useState<FuelOrderItem[]>([])
  const [retainMode, setRetainMode] = React.useState(false)

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
    const site = sanitizeSegment(locationNames[e.site] ?? e.site)
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

  const postBolComment = async (e: BOLPhoto) => {
    try {
      setPending((prev) => new Set(prev).add(e._id))
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(e._id)}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ text: 'BOL Posted' }),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      const result = await res.json()
      setEntries((prev) => prev.map((x) => x._id === e._id ? { ...x, comments: result.comments } : x))
      toast.success('BOL Posted')
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(e._id)
        return next
      })
    }
  }

  const loadLinkableOrders = async (e: BOLPhoto, daysBack: number) => {
    setLinkLoading(true)
    try {
      const res = await fetch(
        `/api/fuel-rec/${encodeURIComponent(e._id)}/linkable-pos?daysBack=${encodeURIComponent(String(daysBack))}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        }
      )
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      const result = (await res.json()) as LinkablePoResponse
      setLinkableOrders(result.orders || [])
      setLinkedOrder(result.linkedOrder || null)
      setLinkRange({ from: result.from, to: result.to })
    } finally {
      setLinkLoading(false)
    }
  }

  const openLinkDialog = async (e: BOLPhoto) => {
    setActiveLinkEntry(e)
    setLinkableOrders([])
    setLinkRange(null)
    setLinkedOrder(null)
    setLinkDaysBack(2)
    try {
      await loadLinkableOrders(e, 2)
    } catch (err) {
      toast.error(`Failed to load POs: ${err instanceof Error ? err.message : String(err)}`)
      setActiveLinkEntry(null)
    }
  }

  const openQuantityReview = (order: FuelOrderCandidate) => {
    const items = (order.items || []).map((item) => ({
      grade: item.grade,
      ltrs: Number(item.ltrs || 0),
    }))
    setReviewOrder(order)
    setReviewItems(items)
    setRetainItems(items.map((item) => ({ grade: item.grade, ltrs: 0 })))
    setRetainMode(false)
  }

  const updateReviewQty = (grade: string, value: string) => {
    setReviewItems((prev) => prev.map((item) => item.grade === grade
      ? { ...item, ltrs: Math.max(0, parseInt(value, 10) || 0) }
      : item
    ))
  }

  const updateRetainQty = (grade: string, value: string) => {
    setRetainItems((prev) => prev.map((item) => item.grade === grade
      ? { ...item, ltrs: Math.max(0, parseInt(value, 10) || 0) }
      : item
    ))
  }

  const closeQuantityReview = () => {
    setReviewOrder(null)
    setReviewItems([])
    setRetainItems([])
    setRetainMode(false)
  }

  const linkFuelPo = async (order: FuelOrderCandidate, items: FuelOrderItem[], retain: FuelOrderItem[]) => {
    if (!activeLinkEntry) return
    setLinkPendingOrderId(order._id)
    try {
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(activeLinkEntry._id)}/link-po`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          fuelOrderId: order._id,
          items,
          retainItems: retain,
        }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      const result = await res.json()
      toast.success(`Linked BOL ${activeLinkEntry.bolNumber || ''} to PO ${order.poNumber}`)
      setLinkableOrders((prev) => prev.filter((x) => x._id !== order._id))
      setLinkedOrder(result.order || order)
      setEntries((prev) => prev.map((x) => x._id === activeLinkEntry._id
        ? { ...x, poLinked: true, poNumber: order.poNumber }
        : x
      ))
      setActiveLinkEntry((prev) => prev ? { ...prev, poLinked: true, poNumber: order.poNumber } : prev)
      closeQuantityReview()
    } catch (err) {
      toast.error(`Link failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLinkPendingOrderId(null)
    }
  }

  const viewMoreHistorical = async () => {
    if (!activeLinkEntry) return
    const nextDaysBack = linkDaysBack + 5
    setLinkDaysBack(nextDaysBack)
    try {
      await loadLinkableOrders(activeLinkEntry, nextDaysBack)
    } catch (err) {
      toast.error(`Failed to load more POs: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const unlinkFuelPo = async () => {
    if (!activeLinkEntry) return
    setUnlinkPending(true)
    try {
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(activeLinkEntry._id)}/unlink-po`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `HTTP ${res.status}`)
      }
      toast.success(`Unlinked PO ${activeLinkEntry.poNumber || linkedOrder?.poNumber || ''}`)
      setEntries((prev) => prev.map((x) => x._id === activeLinkEntry._id
        ? { ...x, poLinked: false, poNumber: undefined }
        : x
      ))
      const nextEntry = { ...activeLinkEntry, poLinked: false, poNumber: undefined }
      setActiveLinkEntry(nextEntry)
      setLinkedOrder(null)
      setLinkDaysBack(2)
      await loadLinkableOrders(nextEntry, 2)
    } catch (err) {
      toast.error(`Unlink failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUnlinkPending(false)
    }
  }

  const formatOrderDate = (value?: string) => {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return format(parsed, 'MMM d, yyyy')
  }

  const formatOrderItems = (items?: FuelOrderCandidate['items']) => {
    const visible = (items || []).filter((item) => Number(item.ltrs || 0) > 0)
    if (!visible.length) return 'No fuel items'
    return visible.map((item) => `${item.grade}: ${Number(item.ltrs || 0).toLocaleString()}L`).join(' | ')
  }

  const activeBolImageUrl = activeLinkEntry ? `/cdn/download/${activeLinkEntry.filename}` : ''

  const handleCommentSave = async () => {
    if (!commentText.trim() || !activeCommentEntry) return
    setCommentPending(true)
    try {
      const res = await fetch(`/api/fuel-rec/${encodeURIComponent(activeCommentEntry._id)}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ text: commentText }),
      })

      if (!res.ok) throw new Error('Failed to save')

      const result = await res.json()
      // Update the main table list
      setEntries(prev => prev.map(x => x._id === activeCommentEntry._id ? { ...x, comments: result.comments } : x))
      // Update the currently open modal data
      setActiveCommentEntry({ ...activeCommentEntry, comments: result.comments })
      setCommentText('')
    } catch (err) {
      alert("Failed to add comment")
    } finally {
      setCommentPending(false)
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
                          // onClick={() => setModalImg(`/cdn/download/${e.filename}`)}
                          onClick={() => setSelectedImg('/cdn/download/' + e.filename)}
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
                          // onClick={() => setCommentModal({ entry: e })}
                          onClick={() => setActiveCommentEntry(e)}
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

                        <Button
                          variant={e.poLinked ? "default" : "outline"}
                          size="icon"
                          onClick={() => openLinkDialog(e)}
                          disabled={pending.has(e._id)}
                          title={e.poLinked ? `Linked to PO ${e.poNumber || ''}` : 'Link PO'}
                          aria-label={e.poLinked ? `Linked to PO ${e.poNumber || ''}` : 'Link PO'}
                          className={e.poLinked ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : undefined}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>

                        {access?.accounting?.fuelRec?.postBol &&
                          !e.comments?.some((c) => c.text.toLowerCase().includes('bol posted')) && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => postBolComment(e)}
                            disabled={pending.has(e._id)}
                            title="BOL Posted"
                            aria-label="BOL Posted"
                          >
                            <ClipboardCheck className="h-4 w-4" />
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


      {/* 1. Image Viewer Dialog */}
      <Dialog open={!!selectedImg} onOpenChange={() => setSelectedImg(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>BOL Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
            <img 
              src={selectedImg || ''} 
              className="max-w-full max-h-[70vh] object-contain" 
              alt="BOL Preview" 
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => window.open(selectedImg || '', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
            </Button>
            <Button variant="secondary" onClick={() => setSelectedImg(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Comments Dialog */}
      <Dialog open={!!activeCommentEntry} onOpenChange={() => setActiveCommentEntry(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comments - {activeCommentEntry?.date}</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4">
            {/* Scrollable List of Existing Comments */}
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 border-b pb-4">
              {activeCommentEntry?.comments && activeCommentEntry.comments.length > 0 ? (
                activeCommentEntry.comments.map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-bold text-slate-700">{c.user || 'User'}</span>
                      <span>{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{c.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 text-sm py-10">No comments on this record yet.</p>
              )}
            </div>

            {/* Input for New Comment */}
            <div className="space-y-3">
              <textarea
                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={3}
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setActiveCommentEntry(null)}>Cancel</Button>
                <Button onClick={handleCommentSave} disabled={commentPending || !commentText.trim()}>
                  {commentPending ? "Adding..." : "Add Comment"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Link Fuel PO Dialog */}
      <Dialog open={!!activeLinkEntry} onOpenChange={() => setActiveLinkEntry(null)}>
        <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[1500px] !h-[calc(100vh-2rem)] !max-h-[calc(100vh-2rem)] p-0 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,520px)] bg-white">
            <section className="min-h-0 border-r bg-slate-100 flex flex-col">
              <div className="shrink-0 border-b bg-white px-5 py-4">
                <DialogHeader>
                  <DialogTitle>Link PO - {activeLinkEntry?.bolNumber || activeLinkEntry?.date}</DialogTitle>
                </DialogHeader>
                <div className="mt-1 text-xs text-slate-500">
                  {activeLinkEntry?.site} | {activeLinkEntry?.date}
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4">
                <div className="h-full rounded-lg border bg-white overflow-auto">
                  {activeBolImageUrl ? (
                    <div className="min-h-full min-w-full flex items-start justify-center p-4">
                      <img
                        src={activeBolImageUrl}
                        alt={`BOL ${activeLinkEntry?.bolNumber || activeLinkEntry?.date} preview`}
                        className="w-[145%] min-w-[900px] max-w-none h-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">BOL preview unavailable.</div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t bg-white px-4 py-3 flex justify-end">
                <Button variant="outline" onClick={() => window.open(activeBolImageUrl, '_blank')} disabled={!activeBolImageUrl}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Open Image
                </Button>
              </div>
            </section>

            <section className="min-h-0 flex flex-col overflow-hidden">
              <div className="shrink-0 border-b px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">
                  {activeLinkEntry?.poLinked || linkedOrder ? 'Linked PO Details' : 'Select Fuel PO'}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {linkRange
                    ? `Showing unlinked fuel POs from ${linkRange.from} to ${linkRange.to}.`
                    : `Loading unlinked fuel POs for ${activeLinkEntry?.site || 'this BOL'}...`}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {activeLinkEntry?.poLinked || linkedOrder ? (
                  <div className="border rounded-md p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-semibold text-emerald-700">
                          Linked to PO {linkedOrder?.poNumber || activeLinkEntry?.poNumber}
                        </div>
                        {linkedOrder ? (
                          <>
                            <div className="text-xs text-slate-500">
                              Delivery: {formatOrderDate(linkedOrder.estimatedDeliveryDate || linkedOrder.originalDeliveryDate)}
                              {(linkedOrder.estimatedDeliveryWindow?.start || linkedOrder.estimatedDeliveryWindow?.end) &&
                                ` | ${linkedOrder.estimatedDeliveryWindow?.start || '--'} - ${linkedOrder.estimatedDeliveryWindow?.end || '--'}`}
                            </div>
                            <div className="text-xs text-slate-600">
                              {[linkedOrder.supplier?.supplierName, linkedOrder.carrier?.carrierName, linkedOrder.rack?.rackName]
                                .filter(Boolean)
                                .join(' | ') || 'No supplier/carrier/rack details'}
                            </div>
                            <div className="text-xs text-slate-500">{formatOrderItems(linkedOrder.items)}</div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-500">Order details could not be loaded, but this BOL is marked linked.</div>
                        )}
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={unlinkFuelPo}
                        disabled={unlinkPending}
                        className="shrink-0"
                      >
                        {unlinkPending ? 'Unlinking...' : 'Unlink'}
                      </Button>
                    </div>
                  </div>
                ) : linkLoading ? (
                  <div className="py-10 text-center text-sm text-slate-500">Loading POs...</div>
                ) : linkableOrders.length === 0 ? (
                  <div className="border rounded-md">
                    <div className="py-10 text-center text-sm text-slate-500">No unlinked fuel POs found for this window.</div>
                    <div className="border-t p-3 flex justify-end">
                      <Button variant="outline" onClick={viewMoreHistorical} disabled={linkLoading}>
                        View More Historical
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <div className="divide-y">
                      {linkableOrders.map((order) => (
                        <div key={order._id} className="p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">{order.poNumber}</span>
                              <span className="text-xs text-slate-500">
                                Delivery: {formatOrderDate(order.estimatedDeliveryDate || order.originalDeliveryDate)}
                              </span>
                              {(order.estimatedDeliveryWindow?.start || order.estimatedDeliveryWindow?.end) && (
                                <span className="text-xs text-slate-500">
                                  {order.estimatedDeliveryWindow?.start || '--'} - {order.estimatedDeliveryWindow?.end || '--'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              {[order.supplier?.supplierName, order.carrier?.carrierName, order.rack?.rackName]
                                .filter(Boolean)
                                .join(' | ') || 'No supplier/carrier/rack details'}
                            </div>
                            <div className="text-xs text-slate-500">{formatOrderItems(order.items)}</div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => openQuantityReview(order)}
                            disabled={linkPendingOrderId === order._id}
                            className="shrink-0"
                          >
                            Link PO
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t p-3 flex justify-end">
                      <Button variant="outline" onClick={viewMoreHistorical} disabled={linkLoading}>
                        View More Historical
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t px-5 py-3 flex justify-end">
                <Button variant="outline" onClick={() => setActiveLinkEntry(null)}>Close</Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Quantity Review / Retain Dialog */}
      <Dialog open={!!reviewOrder} onOpenChange={(open) => !open && closeQuantityReview()}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {retainMode ? 'Adjust Retain - ' : 'Confirm Quantities - '}
              {reviewOrder?.poNumber}
            </DialogTitle>
          </DialogHeader>

          {!retainMode ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Confirm delivered quantities before linking this BOL to the selected PO.
              </div>

              <div className="border rounded-md divide-y">
                {reviewItems.map((item) => (
                  <div key={item.grade} className="flex items-center justify-between p-3 text-sm">
                    <span className="font-semibold text-slate-700">{item.grade}</span>
                    <span className="font-mono font-semibold">{Number(item.ltrs || 0).toLocaleString()} L</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeQuantityReview}>Cancel</Button>
                <Button variant="outline" onClick={() => setRetainMode(true)}>Retain</Button>
                <Button
                  onClick={() => reviewOrder && linkFuelPo(reviewOrder, reviewItems, [])}
                  disabled={!reviewOrder || linkPendingOrderId === reviewOrder?._id}
                >
                  {linkPendingOrderId === reviewOrder?._id ? 'Linking...' : 'Confirm & Link'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Edit actual delivered quantities if needed, and enter retained litres by grade. Retain values will be posted as a PO comment.
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
                  <div className="p-2">Actual Qty</div>
                  <div className="p-2 text-center">Grade</div>
                  <div className="p-2">Retain Qty</div>
                </div>
                <div className="divide-y">
                  {reviewItems.map((item) => {
                    const retain = retainItems.find((x) => x.grade === item.grade)
                    return (
                      <div key={item.grade} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 p-2">
                        <input
                          type="number"
                          min={0}
                          value={item.ltrs}
                          onChange={(e) => updateReviewQty(item.grade, e.target.value)}
                          className="h-9 w-full rounded-md border px-2 text-sm font-mono"
                        />
                        <div className="text-center text-sm font-semibold text-slate-700">{item.grade}</div>
                        <input
                          type="number"
                          min={0}
                          value={retain?.ltrs || 0}
                          onChange={(e) => updateRetainQty(item.grade, e.target.value)}
                          className="h-9 w-full rounded-md border px-2 text-sm font-mono"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRetainMode(false)}>Back</Button>
                <Button
                  onClick={() => reviewOrder && linkFuelPo(reviewOrder, reviewItems, retainItems)}
                  disabled={!reviewOrder || linkPendingOrderId === reviewOrder?._id}
                >
                  {linkPendingOrderId === reviewOrder?._id ? 'Linking...' : 'Link'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
