import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Building2, CalendarClock, ChevronRight, History, Loader2, MapPin, UsersRound } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditTrackerHistoricalIssue, AuditTrackerIssue } from '@/api/audit-tracker/audit-tracker.types'
import { ActivityEntry } from '@/components/custom/station-audits/IssueActivityPanel'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const statusPresentation = {
  created: { label: 'Created', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  in_progress: { label: 'In Progress', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  on_hold: { label: 'On Hold', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  resolved: { label: 'Resolved', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
} as const

export function IssueHistoryPanel({ issue }: { issue: AuditTrackerIssue }) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const historyQuery = useQuery({
    queryKey: ['audit-tracker', 'issue-history', issue._id],
    queryFn: () => auditTrackerService.issueHistory(issue._id),
  })
  const activityQuery = useQuery({
    queryKey: ['audit-tracker', 'historical-issue-activity', issue._id, selectedIssueId],
    queryFn: () => auditTrackerService.historicalIssueActivities(issue._id, selectedIssueId as string),
    enabled: Boolean(selectedIssueId),
  })

  if (historyQuery.isLoading) {
    return <Card className="flex min-h-56 items-center justify-center gap-2 p-6 text-sm text-slate-500 shadow-none"><Loader2 className="h-5 w-5 animate-spin" />Loading the previous year of issue history…</Card>
  }
  if (historyQuery.isError) {
    return <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-none">Unable to load historical issues.</Card>
  }

  const currentSiteIssues = historyQuery.data?.currentSite || []
  const otherSiteIssues = historyQuery.data?.otherSites || []

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Previous occurrences</h3>
            <p className="text-sm text-slate-500">Issues raised for this checklist during the preceding year.</p>
          </div>
          <Badge variant="secondary">{historyQuery.data?.total || 0} historical issues</Badge>
        </div>

        <HistorySection
          title={`At ${issue.site.site || issue.site.stationName}`}
          description="Previous occurrences at the current store"
          issues={currentSiteIssues}
          empty={(
            <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-500">
              There are no historical issues for this checklist at the current store.
              {otherSiteIssues.length > 0 && ' You can still refer to related occurrences from other stores below.'}
            </div>
          )}
          onSelect={setSelectedIssueId}
        />

        <HistorySection
          title="Related occurrences at other stores"
          description="Company-wide reference for the same checklist"
          issues={otherSiteIssues}
          empty={<div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-500">No other stores raised an issue for this checklist during the preceding year.</div>}
          onSelect={setSelectedIssueId}
        />
      </div>

      <Dialog open={Boolean(selectedIssueId)} onOpenChange={(open) => !open && setSelectedIssueId(null)}>
        <DialogContent className="flex h-[88vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="border-b px-4 py-4 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-violet-600" />Historical issue activity</DialogTitle>
            <DialogDescription>Read-only record of the actions taken during this occurrence.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6">
            {activityQuery.isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading historical activity…</div>
            ) : activityQuery.isError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load this historical activity log.</div>
            ) : activityQuery.data ? (
              <div className="space-y-4">
                <HistoricalSummary issue={activityQuery.data.issue} />
                {activityQuery.data.activities.length ? (
                  <div className="space-y-3">{activityQuery.data.activities.map((activity) => <ActivityEntry key={activity._id} activity={activity} />)}</div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-500">No activity entries were recorded for this historical issue.</div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function HistorySection({ title, description, issues, empty, onSelect }: { title: string; description: string; issues: AuditTrackerHistoricalIssue[]; empty: ReactNode; onSelect: (id: string) => void }) {
  return (
    <section>
      <div className="mb-2">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {issues.length ? <div className="grid gap-3 md:grid-cols-2">{issues.map((issue) => <HistoricalIssueCard key={issue._id} issue={issue} onClick={() => onSelect(issue._id)} />)}</div> : empty}
    </section>
  )
}

function HistoricalIssueCard({ issue, onClick }: { issue: AuditTrackerHistoricalIssue; onClick: () => void }) {
  const status = statusPresentation[issue.status]
  return (
    <button type="button" onClick={onClick} className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{issue.site.site || issue.site.stationName}</p>
          <p className="mt-1 text-xs text-slate-500">Occurrence {issue.occurrenceNumber} · {format(new Date(issue.raisedAt), 'MMM d, yyyy')}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('text-[10px]', status.className)}>{status.label}</Badge>
        <span className="text-xs text-slate-500">{issue.currentDepartment?.name || issue.snapshot.departmentName}</span>
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
        <UsersRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="line-clamp-2"><strong>Last assigned:</strong> {assigneeNames(issue)}</span>
      </div>
    </button>
  )
}

function HistoricalSummary({ issue }: { issue: AuditTrackerHistoricalIssue }) {
  const status = statusPresentation[issue.status]
  return (
    <Card className="p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{issue.snapshot.checklistItem}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{issue.site.site || issue.site.stationName}</p>
        </div>
        <Badge variant="outline" className={status.className}>{status.label}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={<CalendarClock className="h-4 w-4" />} label="Raised" value={format(new Date(issue.raisedAt), 'MMM d, yyyy h:mm a')} />
        <SummaryItem icon={<Building2 className="h-4 w-4" />} label="Last department" value={issue.currentDepartment?.name || issue.snapshot.departmentName} />
        <SummaryItem icon={<UsersRound className="h-4 w-4" />} label="Last assigned" value={assigneeNames(issue)} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Last updated {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}</p>
    </Card>
  )
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{icon}{label}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value}</p></div>
}

function assigneeNames(issue: AuditTrackerHistoricalIssue) {
  const names = issue.assignees.map((entry) => `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() || entry.user.email).filter(Boolean)
  return names.length ? names.join(', ') : 'No active assignee recorded'
}
