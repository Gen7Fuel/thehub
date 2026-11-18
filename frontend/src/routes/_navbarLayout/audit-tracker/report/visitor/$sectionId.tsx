import { useState } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Loader2 } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditReportFrequency, AuditReportSection } from '@/api/audit-tracker/audit-tracker.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report/visitor/$sectionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : '',
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency)) ? search.frequency as AuditReportFrequency : 'daily' as AuditReportFrequency,
    date: typeof search.date === 'string' ? search.date : '',
  }),
  component: VisitorAuditComparisonPage,
})

type ReportItem = AuditReportSection['checklists'][number]

function photoUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/cdn/download/')) return value
  if (value.startsWith('cdn/download/')) return `/${value}`
  return `/cdn/download/${encodeURIComponent(value)}`
}

function personName(person?: { firstName?: string; lastName?: string; email?: string } | null) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || 'Not available'
}

function responseText(item: ReportItem | null, field: 'status' | 'comment') {
  if (!item?.completed) return ''
  return field === 'status' ? item.response?.selectedStatus?.label || '' : item.response?.comment || ''
}

function shortText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit).trim()}…` : value
}

function VisitorAuditComparisonPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sectionId } = Route.useParams()
  const search = Route.useSearch()
  const [textDialog, setTextDialog] = useState<{ title: string; value: string } | null>(null)
  const [images, setImages] = useState<{ photos: string[]; index: number } | null>(null)
  const query = useQuery({
    queryKey: ['audit-tracker', 'report', 'visitor-comparison', sectionId, search.site, search.frequency, search.date],
    queryFn: () => auditTrackerService.visitorComparison(sectionId, search),
    enabled: Boolean(sectionId && search.site && search.date),
  })

  if (!user) return null
  if (!hasAuditTrackerAccess(user.access) || !hasAuditTrackerPermission(user.access, 'report')) return <Navigate to="/no-access" replace />
  if (!search.site || !search.date) return <Navigate to="/audit-tracker/report" search={{ type: 'visitor', frequency: search.frequency }} replace />
  const data = query.data
  const storeAuditor = data?.storeRun?.completedBy || data?.storeRun?.startedBy
  const visitorAuditor = data?.visitorRun?.completedBy || data?.visitorRun?.startedBy

  return (
    <div className="mx-auto w-full max-w-[1700px] px-3 pb-10 sm:px-5">
      <section className="mb-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-sm sm:p-5">
        <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate({ to: '/audit-tracker/report', search: { site: search.site, type: 'visitor', frequency: search.frequency, date: search.date } })}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to sections</Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{data?.section.name || 'Visitor comparison'}</h1><p className="mt-1 text-sm text-slate-600">{data ? `${data.location.name} · ${data.period.label}` : 'Loading comparison…'}</p></div>
          {data && <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border bg-white px-3 py-2 text-xs"><p className="font-semibold text-slate-500">Store audit</p><p className="mt-1 font-medium text-slate-900">{personName(storeAuditor)}</p></div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs"><p className="font-semibold text-violet-600">Visitor audit</p><p className="mt-1 font-medium text-violet-900">{personName(visitorAuditor)}</p></div>
          </div>}
        </div>
        {data && <div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary">{data.summary.total} checklists</Badge><Badge className="bg-amber-100 text-amber-800">{data.summary.differing} answers differ</Badge><Badge variant="outline">{data.summary.statusDifferences} status differences</Badge><Badge variant="outline">{data.summary.issueDifferences} issue differences</Badge></div>}
      </section>

      {query.isLoading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading Store and Visitor results…</div>}
      {query.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">Unable to load this comparison.</div>}
      {data && <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] table-fixed text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="w-[24%] px-4 py-3">Checklist</th><th className="w-[8%] px-3 py-3">Source</th><th className="w-[18%] px-3 py-3">Selected status</th><th className="w-[23%] px-3 py-3">Comment</th><th className="w-[14%] px-3 py-3">Completed by</th><th className="w-[8%] px-3 py-3">Completed at</th><th className="w-[5%] px-3 py-3 text-center">Images</th></tr></thead>
            <tbody>{data.checklists.map((entry) => [
              { source: 'Store', item: entry.store, tone: 'bg-slate-50/40' },
              { source: 'Visitor', item: entry.visitor, tone: 'bg-violet-50/30' },
            ].map((row, rowIndex) => {
              const status = responseText(row.item, 'status')
              const comment = responseText(row.item, 'comment')
              const photos = row.item?.response?.photos || []
              const issueRaised = row.item?.response?.issueRaised === true
              return <tr key={`${entry.checklist}-${row.source}`} className={`border-b align-top ${issueRaised ? 'bg-red-50' : row.tone}`}>
                {rowIndex === 0 && <td rowSpan={2} className="border-r px-4 py-3 align-middle"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold leading-snug text-slate-900">{entry.snapshot.item}</p><div className="mt-2 flex flex-wrap gap-1">{entry.snapshot.category && <Badge variant="secondary" className="text-[9px]">{entry.snapshot.category}</Badge>}{entry.snapshot.departmentName && <Badge variant="outline" className="text-[9px]">{entry.snapshot.departmentName}</Badge>}</div></div>{entry.differs && <Badge className="bg-amber-100 text-amber-800">Different</Badge>}</div></td>}
                <td className="px-3 py-3"><Badge className={row.source === 'Visitor' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-700'}>{row.source}</Badge>{issueRaised && <Badge className="mt-1.5 bg-red-600 text-white">Issue</Badge>}</td>
                <td className="px-3 py-3">{row.item?.completed ? <button type="button" className="text-left text-xs font-medium leading-relaxed text-violet-700 hover:underline" onClick={() => setTextDialog({ title: `${row.source} selected status`, value: status || 'No status recorded' })}>{shortText(status || 'No status recorded', 42)}</button> : <span className="text-xs font-medium text-slate-400">Not completed</span>}</td>
                <td className="px-3 py-3">{row.item?.completed ? comment ? <button type="button" className="text-left text-xs leading-relaxed text-slate-700 hover:text-violet-700 hover:underline" onClick={() => setTextDialog({ title: `${row.source} comment`, value: comment })}>{shortText(comment, 58)}</button> : <span className="text-xs text-slate-400">No comment</span> : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="px-3 py-3 text-xs text-slate-600">{row.item?.completed ? personName(row.item.response?.checkedBy) : '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{row.item?.response?.checkedAt ? <>{format(parseISO(row.item.response.checkedAt), 'MMM d')}<span className="block text-[10px]">{format(parseISO(row.item.response.checkedAt), 'h:mm a')}</span></> : '—'}</td>
                <td className="px-3 py-3 text-center">{photos.length ? <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => setImages({ photos, index: 0 })}><ImageIcon className="mr-1 h-3.5 w-3.5" />{photos.length}</Button> : '—'}</td>
              </tr>
            }))}</tbody>
          </table>
        </div>
      </section>}

      <Dialog open={Boolean(textDialog)} onOpenChange={(open) => !open && setTextDialog(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{textDialog?.title}</DialogTitle><DialogDescription>Complete value recorded for this response.</DialogDescription></DialogHeader><div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-relaxed">{textDialog?.value}</div></DialogContent></Dialog>
      <Dialog open={Boolean(images)} onOpenChange={(open) => !open && setImages(null)}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Submission images</DialogTitle><DialogDescription>{images ? `Image ${images.index + 1} of ${images.photos.length}` : ''}</DialogDescription></DialogHeader>{images && <div className="space-y-3"><div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-slate-950"><img src={photoUrl(images.photos[images.index])} alt="Audit submission" className="max-h-[65vh] max-w-full object-contain" />{images.photos.length > 1 && <><Button size="icon" variant="secondary" className="absolute left-3" onClick={() => setImages((current) => current ? { ...current, index: (current.index - 1 + current.photos.length) % current.photos.length } : null)}><ChevronLeft /></Button><Button size="icon" variant="secondary" className="absolute right-3" onClick={() => setImages((current) => current ? { ...current, index: (current.index + 1) % current.photos.length } : null)}><ChevronRight /></Button></>}</div><div className="flex justify-end"><Button asChild variant="outline"><a href={photoUrl(images.photos[images.index])} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open image</a></Button></div></div>}</DialogContent></Dialog>
    </div>
  )
}
