import { useEffect, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Building2, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Filter, History, ImageIcon, Loader2, MapPin, MessageSquareText, Search, ShieldAlert, UsersRound } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerIssue, AuditTrackerIssueStatus } from '@/api/audit-tracker/audit-tracker.types'
import { ActivityEntry, IssueActivityExportButton } from '@/components/custom/station-audits/IssueActivityPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'
import { IssuePriorityLabel, priorityFooterStyle } from '@/components/custom/station-audits/IssuePriorityLabel'
import { stationAuditPhotoUrl } from '@/lib/stationAuditPhotos'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/issues-board')({ component: IssuesBoardPage })

const sections: Array<{ status: AuditTrackerIssueStatus; title: string; description: string }> = [
  { status: 'created', title: 'Created issues', description: 'New issues waiting for action' },
  { status: 'in_progress', title: 'In progress', description: 'Issues currently being worked on' },
  { status: 'on_hold', title: 'On hold', description: 'Issues waiting for additional action or information' },
  { status: 'resolved', title: 'Completed', description: 'Resolved during the past 30 days' },
]

function IssuesBoardPage() {
  const { user } = useAuth()
  const allowed = Boolean(user && hasAuditTrackerAccess(user.access) && hasAuditTrackerPermission(user.access, 'issuesBoard'))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [site, setSite] = useState('all')
  const [department, setDepartment] = useState('all')
  const [priority, setPriority] = useState('all')
  const [draftSite, setDraftSite] = useState('all')
  const [draftDepartment, setDraftDepartment] = useState('all')
  const [draftPriority, setDraftPriority] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<AuditTrackerIssue | null>(null)
  const [submissionIssue, setSubmissionIssue] = useState<AuditTrackerIssue | null>(null)
  const [expanded, setExpanded] = useState<Record<AuditTrackerIssueStatus, boolean>>({ created: true, in_progress: true, on_hold: true, resolved: false })

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useQuery({
    queryKey: ['audit-tracker', 'issues-board', debouncedSearch, site, department, priority],
    queryFn: () => auditTrackerService.issuesBoard({ search: debouncedSearch || undefined, site, department, priority }),
    enabled: allowed,
  })
  if (!user) return null
  if (!allowed) return <Navigate to="/no-access" replace />
  const activeFilters = [site, department, priority].filter((value) => value !== 'all').length

  return <div className="mx-auto w-full max-w-[1500px] px-3 pb-10 sm:px-5 lg:px-6">
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-violet-600 p-2.5 text-white"><ClipboardList className="h-5 w-5" /></div><div><h1 className="text-xl font-black">Issues Board</h1><p className="text-sm text-slate-500">Read-only operational view across your accessible sites.</p></div></div>
        <div className="mt-4 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search checklist, section, category…" className="pl-9" /></div><Button variant="outline" onClick={() => { setDraftSite(site); setDraftDepartment(department); setDraftPriority(priority); setFiltersOpen(true) }}><Filter className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Filters</span>{activeFilters > 0 && <Badge className="ml-2 hidden rounded-full sm:inline-flex">{activeFilters}</Badge>}</Button></div>
      </div>

      <div className="space-y-3 bg-slate-50/70 p-3 sm:p-4">
        {query.isLoading ? <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading Issues Board…</div> : sections.map((section) => {
          const data = query.data?.sections[section.status] || { issues: [], total: 0 }
          const open = expanded[section.status]
          return <div key={section.status} className="overflow-hidden rounded-xl border bg-white">
            <button type="button" onClick={() => setExpanded((current) => ({ ...current, [section.status]: !current[section.status] }))} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="flex min-w-0 items-center gap-3">{open ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}<div><h2 className="font-bold text-slate-900">{section.title} <span className="text-slate-400">({data.total})</span></h2><p className="text-xs text-slate-500">{section.description}</p></div></div></button>
            {open && <div className="border-t bg-slate-50/50 p-3">{data.issues.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.issues.map((issue) => <BoardIssueCard key={issue._id} issue={issue} onActivity={() => setSelectedIssue(issue)} onSubmission={() => setSubmissionIssue(issue)} />)}</div> : <p className="p-8 text-center text-sm text-slate-500">No matching issues in this section.</p>}{data.total > data.issues.length && <p className="mt-3 text-center text-xs text-slate-500">Showing the 100 most recently updated issues.</p>}</div>}
          </div>
        })}
      </div>
    </section>

    <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Filter Issues Board</DialogTitle><DialogDescription>Filters apply across every status section.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Site</Label><Select value={draftSite} onValueChange={setDraftSite}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{query.data?.sites.length === 1 ? query.data.sites[0].name : 'All accessible sites'}</SelectItem>{(query.data?.sites || []).length > 1 && query.data?.sites.map((entry) => <SelectItem key={entry._id} value={entry._id}>{entry.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Department</Label><Select value={draftDepartment} onValueChange={setDraftDepartment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{query.data?.departments.map((entry) => <SelectItem key={entry._id} value={entry._id}>{entry.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Priority</Label><Select value={draftPriority} onValueChange={setDraftPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All priorities</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => { setDraftSite('all'); setDraftDepartment('all'); setDraftPriority('all') }}>Clear</Button><Button onClick={() => { setSite(draftSite); setDepartment(draftDepartment); setPriority(draftPriority); setFiltersOpen(false) }}>Apply filters</Button></DialogFooter></DialogContent></Dialog>
    <BoardActivityDialog issue={selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)} />
    <OriginalSubmissionDialog issue={submissionIssue} onOpenChange={(open) => !open && setSubmissionIssue(null)} />
  </div>
}

function BoardIssueCard({ issue, onActivity, onSubmission }: { issue: AuditTrackerIssue; onActivity: () => void; onSubmission: () => void }) {
  const owner = issue.assignees.find((entry) => entry.role === 'owner')?.user
  const collaboratorCount = issue.assignees.filter((entry) => entry.role === 'collaborator').length
  const timestamp = boardTimestamp(issue.updatedAt)
  return <Card className="flex h-full flex-col gap-0 overflow-hidden p-4"><div className={"-mx-4 -mt-4 flex items-start justify-between gap-3 border-b px-4 py-3 " + priorityFooterStyle[issue.priority]}><div className="min-w-0"><p className="truncate text-xs font-semibold text-violet-700">{issue.snapshot.sectionName}</p><h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug">{issue.snapshot.checklistItem}</h3></div><IssuePriorityLabel priority={issue.priority} /></div><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="outline" className="h-6 px-2 text-[10px]">Occurrence {issue.occurrenceNumber}</Badge>{issue.escalation?.level !== 'none' && <Badge className="h-6 bg-amber-100 px-2 text-[10px] text-amber-800"><ShieldAlert className="mr-1 h-3 w-3" />Escalated</Badge>}</div><div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-600"><span className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" />{issue.site.site || issue.site.stationName}</span><span className="flex items-center gap-1.5 truncate"><Building2 className="h-3.5 w-3.5 shrink-0" />{issue.currentDepartment?.name || issue.snapshot.departmentName}</span><span className="flex items-center gap-1.5 truncate"><CalendarClock className="h-3.5 w-3.5 shrink-0" />{formatPeriod(issue)}</span><span className="flex items-center gap-1.5 truncate"><UsersRound className="h-3.5 w-3.5 shrink-0" />{owner ? `${`${owner.firstName} ${owner.lastName}`.trim() || owner.email}${collaboratorCount ? ` +${collaboratorCount}` : ''}` : 'No owner'}</span></div><div className="mt-auto pt-4"><p className="cursor-help border-t pt-3 text-[10px] text-slate-400" title={timestamp.exact}>Updated {timestamp.display}</p><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" size="sm" className="h-9 px-2 text-xs" onClick={onSubmission}><MessageSquareText className="mr-1.5 h-3.5 w-3.5" />Submission</Button><Button type="button" size="sm" className="h-9 px-2 text-xs" onClick={onActivity}><History className="mr-1.5 h-3.5 w-3.5" />Activity</Button></div></div></Card>
}

function formatPeriod(issue: AuditTrackerIssue) {
  const frequency = issue.run?.frequency ? `${issue.run.frequency.charAt(0).toUpperCase()}${issue.run.frequency.slice(1)}` : 'Audit'
  return `${frequency} · ${issue.run?.periodKey || 'Unknown period'}`
}

function boardTimestamp(value: string) {
  const date = new Date(value)
  const exact = format(date, "MMM d, yyyy 'at' h:mm a")
  return {
    exact,
    display: Date.now() - date.getTime() >= 24 * 60 * 60 * 1000
      ? exact
      : formatDistanceToNow(date, { addSuffix: true }),
  }
}

function OriginalSubmissionDialog({ issue, onOpenChange }: { issue: AuditTrackerIssue | null; onOpenChange: (open: boolean) => void }) {
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const photos = issue?.response?.photos?.length ? issue.response.photos : issue?.snapshot.originalPhotos || []
  const comment = issue?.response?.comment || issue?.snapshot.originalComment || ''
  const selectedStatus = issue?.response?.selectedStatus?.label || issue?.snapshot.statusLabel || 'No status recorded'
  useEffect(() => { if (!issue) setPhotoIndex(null) }, [issue])
  return <>
    <Dialog open={Boolean(issue)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Original store submission</DialogTitle><DialogDescription>{issue ? `${issue.snapshot.checklistItem} · ${issue.site.site || issue.site.stationName}` : ''}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected status</p><p className="mt-1 text-sm font-semibold text-slate-800">{selectedStatus}</p></div>
          <div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><MessageSquareText className="h-3.5 w-3.5" />Store comment</p><p className="mt-2 whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm leading-6 text-slate-700">{comment || 'No comment was provided.'}</p></div>
          <div><p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"><ImageIcon className="h-3.5 w-3.5" />Original photos ({photos.length})</p>{photos.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.slice(0, 3).map((photo, index) => <button type="button" key={`${photo}-${index}`} onClick={() => setPhotoIndex(index)} className="relative min-h-24 touch-manipulation overflow-hidden rounded-xl border bg-slate-100"><img src={stationAuditPhotoUrl(photo)} alt={`Store evidence ${index + 1}`} className="aspect-video h-full w-full object-cover" />{index === 2 && photos.length > 3 && <span className="absolute inset-0 flex items-center justify-center bg-slate-950/65 text-xl font-bold text-white">+{photos.length - 2}</span>}</button>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No photos were submitted.</p>}</div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={photoIndex !== null} onOpenChange={(open) => !open && setPhotoIndex(null)}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12"><DialogTitle>Store photo</DialogTitle><DialogDescription>{photoIndex !== null ? `Photo ${photoIndex + 1} of ${photos.length}` : ''}</DialogDescription></DialogHeader>
        {photoIndex !== null && photos[photoIndex] && <div className="relative flex min-h-[55vh] items-center justify-center bg-slate-950 p-2 sm:p-6"><img src={stationAuditPhotoUrl(photos[photoIndex])} alt={`Store evidence ${photoIndex + 1}`} className="max-h-[68vh] max-w-full object-contain" />{photos.length > 1 && <><Button type="button" size="icon" variant="secondary" className="absolute left-2 h-12 w-12 touch-manipulation rounded-full sm:left-4" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)} aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></Button><Button type="button" size="icon" variant="secondary" className="absolute right-2 h-12 w-12 touch-manipulation rounded-full sm:right-4" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} aria-label="Next photo"><ChevronRight className="h-6 w-6" /></Button></>}<a href={stationAuditPhotoUrl(photos[photoIndex])} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 inline-flex h-11 touch-manipulation items-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow"><ExternalLink className="mr-2 h-4 w-4" />Open in new tab</a></div>}
      </DialogContent>
    </Dialog>
  </>
}

function BoardActivityDialog({ issue, onOpenChange }: { issue: AuditTrackerIssue | null; onOpenChange: (open: boolean) => void }) {
  const query = useQuery({ queryKey: ['audit-tracker', 'issues-board', 'activity', issue?._id], queryFn: () => auditTrackerService.issuesBoardActivity(issue!._id), enabled: Boolean(issue) })
  return <Dialog open={Boolean(issue)} onOpenChange={onOpenChange}><DialogContent className="flex h-[88vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full"><DialogHeader className="border-b px-5 py-4 pr-12"><div className="flex flex-wrap items-center justify-between gap-2"><DialogTitle>{issue?.snapshot.checklistItem || 'Issue activity'}</DialogTitle>{issue && <IssueActivityExportButton issue={issue} data={query.isError ? undefined : query.data} />}</div><DialogDescription>{issue ? `${issue.site.site || issue.site.stationName} · ${issue.currentDepartment?.name || issue.snapshot.departmentName}` : ''}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">{query.isLoading ? <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading activity…</div> : query.data?.activities.length ? <div className="space-y-3">{query.data.hasMore && <p className="text-center text-xs text-slate-500">Showing the first 200 activities.</p>}{query.data.activities.map((activity) => <ActivityEntry key={activity._id} activity={activity} />)}</div> : <p className="p-8 text-center text-sm text-slate-500">No activity recorded.</p>}</div></DialogContent></Dialog>
}
