import { useState } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, ExternalLink, ImageIcon, Loader2 } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditReportFrequency, AuditReportSection } from '@/api/audit-tracker/audit-tracker.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'

type ReportType = 'store' | 'visitor'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report/$sectionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : '',
    type: search.type === 'visitor' ? 'visitor' as ReportType : 'store' as ReportType,
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency))
      ? search.frequency as AuditReportFrequency
      : 'daily' as AuditReportFrequency,
    date: typeof search.date === 'string' ? search.date : '',
  }),
  component: AuditReportSectionPage,
})

function photoUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/cdn/download/')) return value
  if (value.startsWith('cdn/download/')) return `/${value}`
  return `/cdn/download/${encodeURIComponent(value)}`
}

function personName(person?: { firstName?: string; lastName?: string; email?: string } | null) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || 'Unknown user'
}

type ReportChecklist = AuditReportSection['checklists'][number]

function shortText(value: string, limit = 42) {
  return value.length > limit ? `${value.slice(0, limit).trim()}…` : value
}

function ChecklistTable({
  title,
  description,
  items,
  tone,
  onTextOpen,
  onImagesOpen,
}: {
  title: string
  description: string
  items: ReportChecklist[]
  tone: 'issue' | 'complete' | 'incomplete'
  onTextOpen: (title: string, value: string) => void
  onImagesOpen: (photos: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  if (!items.length) return null
  const theme = tone === 'issue'
    ? 'border-red-200 bg-red-50 text-red-800'
    : tone === 'complete'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700'
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        className={`flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left ${isOpen ? 'border-b' : ''} ${theme}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-xs opacity-75">{description}</p></div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white/70">{items.length}</Badge>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="border-b bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr><th className="w-[28%] px-4 py-2.5">Checklist</th><th className="w-[17%] px-3 py-2.5">Selected status</th><th className="w-[22%] px-3 py-2.5">Comment</th><th className="w-[14%] px-3 py-2.5">Completed by</th><th className="w-[11%] px-3 py-2.5">Completed at</th><th className="w-[8%] px-3 py-2.5 text-center">Images</th></tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const response = item.response
              const status = response?.selectedStatus?.label || ''
              const comment = response?.comment || ''
              const photos = response?.photos || []
              return <tr key={item.checklist} className="align-top transition hover:bg-slate-50/70">
                <td className="px-4 py-3"><p className="font-medium leading-snug text-slate-900">{item.snapshot.item}</p><div className="mt-1.5 flex flex-wrap gap-1">{item.snapshot.category && <Badge variant="secondary" className="h-5 text-[9px]">{item.snapshot.category}</Badge>}{item.snapshot.departmentName && <Badge variant="outline" className="h-5 max-w-full truncate text-[9px]">{item.snapshot.departmentName}</Badge>}</div></td>
                <td className="px-3 py-3">{status ? <button type="button" className="text-left text-xs font-medium leading-relaxed text-violet-700 hover:underline" onClick={() => onTextOpen('Selected status', status)} title="View complete status">{shortText(status, 34)}</button> : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="px-3 py-3">{comment ? <button type="button" className="text-left text-xs leading-relaxed text-slate-700 hover:text-violet-700 hover:underline" onClick={() => onTextOpen('Store comment', comment)} title="View complete comment">{shortText(comment, 52)}</button> : <span className="text-xs text-slate-400">No comment</span>}</td>
                <td className="px-3 py-3 text-xs text-slate-600">{response?.checkedBy ? personName(response.checkedBy) : '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{response?.checkedAt ? format(parseISO(response.checkedAt), 'MMM d, yyyy') : '—'}{response?.checkedAt && <span className="mt-0.5 block text-[10px]">{format(parseISO(response.checkedAt), 'h:mm a')}</span>}</td>
                <td className="px-3 py-3 text-center">{photos.length ? <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => onImagesOpen(photos)}><ImageIcon className="mr-1 h-3.5 w-3.5" />{photos.length}</Button> : <span className="text-xs text-slate-400">—</span>}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>}
    </section>
  )
}

function AuditReportSectionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { sectionId } = Route.useParams()
  const search = Route.useSearch()
  const [textDialog, setTextDialog] = useState<{ title: string; value: string } | null>(null)
  const [imageDialog, setImageDialog] = useState<{ photos: string[]; index: number } | null>(null)
  const query = useQuery({
    queryKey: ['audit-tracker', 'report', 'section', sectionId, search.site, search.type, search.frequency, search.date],
    queryFn: () => auditTrackerService.reportSection(sectionId, search),
    enabled: Boolean(sectionId && search.site && search.date),
  })

  if (!user) return null
  if (!hasAuditTrackerAccess(user.access) || !hasAuditTrackerPermission(user.access, 'report')) return <Navigate to="/no-access" replace />
  if (!search.site || !search.date) return <Navigate to="/audit-tracker/report" replace />

  const data = query.data
  const percentage = data?.summary.total ? Math.round((data.summary.completed / data.summary.total) * 100) : 0
  const issueItems = data?.checklists.filter((item) => item.completed && item.response?.issueRaised) || []
  const completedItems = data?.checklists.filter((item) => item.completed && !item.response?.issueRaised) || []
  const incompleteItems = data?.checklists.filter((item) => !item.completed) || []

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 pb-10 sm:px-5">
      <section className="mb-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate({ to: '/audit-tracker/report', search: { site: search.site, type: search.type, frequency: search.frequency, date: search.date } })}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to sections</Button>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-violet-600 p-2.5 text-white"><CalendarClock className="h-5 w-5" /></div>
              <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{data?.section.name || 'Audit section'}</h1><p className="mt-1 text-sm text-slate-600">{data ? `${data.location.name} · ${data.period.label}` : 'Loading report period…'}</p></div>
            </div>
          </div>
          {data && <div className="flex flex-wrap gap-2"><Badge variant="secondary" className="capitalize">{data.type}</Badge><Badge variant="outline" className="capitalize">{data.frequency}</Badge><Badge className={data.run ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'}>{data.run ? data.run.state.replace('_', ' ') : 'Not started'}</Badge></div>}
        </div>
        {data && <div className="mt-4 rounded-xl border bg-white/90 p-3"><div className="mb-2 flex justify-between gap-3 text-sm"><span>{data.summary.completed} of {data.summary.total} checklists completed</span><strong className="text-violet-700">{percentage}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${percentage}%` }} /></div></div>}
      </section>

      {query.isLoading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white text-sm text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading checklist submissions…</div>}
      {query.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">Unable to load this section report.</div>}
      {data && !data.checklists.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><CircleDashed className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-semibold">No checklists applied to this period</h2></div>}

      {data && data.checklists.length > 0 && <div className="space-y-5">
        <ChecklistTable title="Issues raised" description="Completed checklist submissions where the store recorded an issue." items={issueItems} tone="issue" onTextOpen={(title, value) => setTextDialog({ title, value })} onImagesOpen={(photos) => setImageDialog({ photos, index: 0 })} />
        <ChecklistTable title="Completed without issues" description="Completed checklist submissions with no issue raised." items={completedItems} tone="complete" onTextOpen={(title, value) => setTextDialog({ title, value })} onImagesOpen={(photos) => setImageDialog({ photos, index: 0 })} />
        <ChecklistTable title="Incomplete checklists" description="Expected checklist items without a submitted response." items={incompleteItems} tone="incomplete" onTextOpen={(title, value) => setTextDialog({ title, value })} onImagesOpen={(photos) => setImageDialog({ photos, index: 0 })} />
      </div>}

      <Dialog open={Boolean(textDialog)} onOpenChange={(open) => !open && setTextDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{textDialog?.title}</DialogTitle><DialogDescription>Complete value recorded with this checklist response.</DialogDescription></DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{textDialog?.value}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(imageDialog)} onOpenChange={(open) => !open && setImageDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Submission images</DialogTitle><DialogDescription>{imageDialog ? `Image ${imageDialog.index + 1} of ${imageDialog.photos.length}` : ''}</DialogDescription></DialogHeader>
          {imageDialog && <div className="space-y-3">
            <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl border bg-slate-950 sm:min-h-[460px]">
              <img src={photoUrl(imageDialog.photos[imageDialog.index])} alt={`Audit submission ${imageDialog.index + 1}`} className="max-h-[65vh] max-w-full object-contain" />
              {imageDialog.photos.length > 1 && <><Button type="button" size="icon" variant="secondary" className="absolute left-3" onClick={() => setImageDialog((current) => current ? { ...current, index: (current.index - 1 + current.photos.length) % current.photos.length } : null)}><ChevronLeft className="h-5 w-5" /></Button><Button type="button" size="icon" variant="secondary" className="absolute right-3" onClick={() => setImageDialog((current) => current ? { ...current, index: (current.index + 1) % current.photos.length } : null)}><ChevronRight className="h-5 w-5" /></Button></>}
            </div>
            <div className="flex items-center justify-between gap-3"><div className="flex gap-1.5 overflow-x-auto">{imageDialog.photos.map((photo, index) => <button key={`${photo}-${index}`} type="button" onClick={() => setImageDialog((current) => current ? { ...current, index } : null)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 ${index === imageDialog.index ? 'border-violet-500' : 'border-transparent'}`}><img src={photoUrl(photo)} alt="" className="h-full w-full object-cover" /></button>)}</div><Button asChild variant="outline" size="sm"><a href={photoUrl(imageDialog.photos[imageDialog.index])} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open</a></Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
