import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { addMonths, addYears, format, getDay, parseISO, startOfMonth } from 'date-fns'
import { CalendarDays, ChartNoAxesCombined, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Clock3, Loader2, UserRound } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditReportAvailability, AuditReportFrequency } from '@/api/audit-tracker/audit-tracker.types'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report/')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
    type: search.type === 'visitor' ? 'visitor' as const : 'store' as const,
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency))
      ? search.frequency as AuditReportFrequency
      : 'daily' as AuditReportFrequency,
    date: typeof search.date === 'string' ? search.date : undefined,
    visitor: Number.isInteger(Number(search.visitor)) && Number(search.visitor) >= 0 ? Number(search.visitor) : undefined,
  }),
  component: AuditTrackerReportPage,
})

type AvailabilityPeriod = AuditReportAvailability['periods'][number]
const monthAnchor = (date = new Date()) => format(startOfMonth(date), 'yyyy-MM-dd')

function AvailabilityDot({ available }: { available: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
}

function reportUserName(person?: { firstName?: string; lastName?: string; email?: string } | null) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || 'Unknown user'
}

function PeriodPicker({
  frequency,
  anchor,
  selected,
  periods,
  loading,
  onAnchorChange,
  onSelect,
}: {
  frequency: AuditReportFrequency
  anchor: string
  selected: string
  periods: AvailabilityPeriod[]
  loading: boolean
  onAnchorChange: (anchor: string) => void
  onSelect: (period: AvailabilityPeriod) => void
}) {
  const [open, setOpen] = useState(false)
  const anchorDate = parseISO(anchor)
  const selectedPeriod = periods.find((period) => period.date === selected)
  const buttonLabel = selectedPeriod?.label
    || (selected ? format(parseISO(selected), frequency === 'monthly' ? 'MMMM yyyy' : 'MMM d, yyyy') : `Select ${frequency === 'daily' ? 'date' : frequency === 'weekly' ? 'week' : 'month'}`)
  const move = (direction: number) => onAnchorChange(format(
    frequency === 'monthly' ? addYears(anchorDate, direction) : addMonths(anchorDate, direction),
    'yyyy-MM-dd',
  ))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full justify-start bg-white font-normal">
          <CalendarDays className="mr-2 h-4 w-4 text-violet-600" />{buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Select a {frequency === 'daily' ? 'date' : frequency === 'weekly' ? 'week' : 'month'}</DialogTitle>
          <DialogDescription>Green dots indicate periods with audit activity.</DialogDescription>
        </DialogHeader>
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Previous period"><ChevronLeft className="h-4 w-4" /></Button>
          <strong className="text-sm">{format(anchorDate, frequency === 'monthly' ? 'yyyy' : 'MMMM yyyy')}</strong>
          <Button type="button" variant="ghost" size="icon" onClick={() => move(1)} aria-label="Next period"><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading availability…</div> : frequency === 'daily' ? (
          <div>
            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: getDay(parseISO(`${anchor.slice(0, 7)}-01`)) }).map((_, index) => <span key={`blank-${index}`} />)}
              {periods.map((period) => <button key={period.periodKey} type="button" disabled={!period.hasData} onClick={() => { onSelect(period); setOpen(false) }} className={`flex h-10 flex-col items-center justify-center rounded-lg text-sm transition ${selected === period.date ? 'bg-violet-100 font-bold text-violet-800 ring-1 ring-violet-300' : period.hasData ? 'text-slate-900 hover:bg-violet-50' : 'cursor-not-allowed bg-slate-50/60 text-slate-300'}`}><span>{period.label}</span><AvailabilityDot available={period.hasData} /></button>)}
            </div>
          </div>
        ) : frequency === 'weekly' ? (
          <div className="space-y-1.5">
            <p className="mb-2 text-[11px] text-slate-500">Weeks run Sunday through Saturday.</p>
            {periods.map((period) => <button key={period.periodKey} type="button" disabled={!period.hasData} onClick={() => { onSelect(period); setOpen(false) }} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${selected === period.date ? 'border-violet-300 bg-violet-50 text-violet-800' : period.hasData ? 'border-slate-200 hover:border-violet-200 hover:bg-violet-50' : 'cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-300'}`}><span><strong className="mr-2">{period.periodKey.replace(/^\d+-W/, 'Week ')}</strong>{period.label}</span><AvailabilityDot available={period.hasData} /></button>)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {periods.map((period) => <button key={period.periodKey} type="button" disabled={!period.hasData} onClick={() => { onSelect(period); setOpen(false) }} className={`flex h-16 flex-col items-center justify-center rounded-lg border text-sm transition ${selected === period.date ? 'border-violet-300 bg-violet-50 font-bold text-violet-800' : period.hasData ? 'border-slate-200 hover:border-violet-200 hover:bg-violet-50' : 'cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-300'}`}><span>{period.label}</span><span className="mt-1"><AvailabilityDot available={period.hasData} /></span></button>)}
          </div>
        )}
        <div className="mt-3 flex gap-4 border-t pt-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><AvailabilityDot available />Audit activity</span><span className="flex items-center gap-1.5"><AvailabilityDot available={false} />No activity</span></div>
      </DialogContent>
    </Dialog>
  )
}

function AuditTrackerReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [site, setSite] = useState(search.site || '')
  const [auditType, setAuditType] = useState<'store' | 'visitor'>(search.type)
  const [frequency, setFrequency] = useState<AuditReportFrequency>(search.frequency)
  const [anchor, setAnchor] = useState(() => search.date ? monthAnchor(parseISO(search.date)) : monthAnchor())
  const [selectedDate, setSelectedDate] = useState(search.date || '')
  const [selectedVisitorIndex, setSelectedVisitorIndex] = useState<number | null>(search.visitor ?? null)
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false)

  useEffect(() => {
    if (!site && user?.location) {
      setSite(user.location)
      void navigate({ to: '/audit-tracker/report', search: { site: user.location, type: auditType, frequency, date: selectedDate || undefined, visitor: selectedVisitorIndex ?? undefined }, replace: true })
    }
  }, [auditType, frequency, navigate, selectedDate, selectedVisitorIndex, site, user?.location])
  const availabilityQuery = useQuery({
    queryKey: ['audit-tracker', 'report', 'availability', site, auditType, frequency, anchor],
    queryFn: () => auditTrackerService.reportAvailability({ site, type: auditType, frequency, anchor }),
    enabled: Boolean(site),
  })
  const reportQuery = useQuery({
    queryKey: ['audit-tracker', 'report', auditType, site, frequency, selectedDate, selectedVisitorIndex],
    queryFn: () => auditTrackerService.reportOverview({ site, type: auditType, frequency, date: selectedDate, visitorIndex: auditType === 'visitor' ? selectedVisitorIndex ?? undefined : undefined }),
    enabled: Boolean(site && selectedDate),
  })
  const data = reportQuery.data
  const percent = data?.summary.total ? Math.round((data.summary.completed / data.summary.total) * 100) : 0
  const sections = useMemo(() => [...(data?.sections || [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name)), [data?.sections])
  const selectedVisitor = data?.visitorOptions.find((option) => option.index === selectedVisitorIndex)

  useEffect(() => {
    if (auditType !== 'visitor' || !selectedDate || !data) return
    if (data.visitorOptions.length === 1 && selectedVisitorIndex === null) {
      setSelectedVisitorIndex(0)
      void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: 'visitor', frequency, date: selectedDate, visitor: 0 }, replace: true })
    } else if (selectedVisitorIndex !== null && !data.visitorOptions.some((option) => option.index === selectedVisitorIndex)) {
      setSelectedVisitorIndex(null)
      void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: 'visitor', frequency, date: selectedDate, visitor: undefined }, replace: true })
    } else if (data.visitorOptions.length > 1 && selectedVisitorIndex === null) {
      setVisitorDialogOpen(true)
    } else {
      setVisitorDialogOpen(false)
    }
  }, [auditType, data, frequency, navigate, selectedDate, selectedVisitorIndex, site])

  if (!user) return null
  if (!hasAuditTrackerAccess(user.access) || !hasAuditTrackerPermission(user.access, 'report')) return <Navigate to="/no-access" replace />

  const resetSelection = () => { setSelectedDate(''); setSelectedVisitorIndex(null); setVisitorDialogOpen(false) }
  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-10 sm:px-5">
      <section className="mb-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-600 p-2.5 text-white"><ChartNoAxesCombined className="h-6 w-6" /></div><div><h1 className="text-xl font-bold sm:text-2xl">Audit reports</h1><p className="mt-1 text-sm text-slate-600">Select an audit source and period to load its section completion report.</p></div></div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[860px] xl:grid-cols-4">
            <div className="space-y-1"><p className="text-xs font-semibold text-slate-600">Station</p><SitePicker value={site} onValueChange={(value) => { setSite(value); resetSelection(); void navigate({ to: '/audit-tracker/report', search: { site: value, type: auditType, frequency, date: undefined, visitor: undefined }, replace: true }) }} className="h-10 w-full" /></div>
            <label className="space-y-1 text-xs font-semibold text-slate-600">Audit source<select value={auditType} onChange={(event) => { const value = event.target.value as 'store' | 'visitor'; setAuditType(value); resetSelection(); void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: value, frequency, date: undefined, visitor: undefined }, replace: true }) }} className="h-10 w-full rounded-md border bg-white px-3 text-sm font-normal"><option value="store">Store audit</option><option value="visitor">Visitor audit</option></select></label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">Frequency<select value={frequency} onChange={(event) => { const value = event.target.value as AuditReportFrequency; setFrequency(value); setAnchor(monthAnchor()); resetSelection(); void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: auditType, frequency: value, date: undefined, visitor: undefined }, replace: true }) }} className="h-10 w-full rounded-md border bg-white px-3 text-sm font-normal"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <div className="space-y-1"><p className="text-xs font-semibold text-slate-600">Report period</p><PeriodPicker frequency={frequency} anchor={anchor} selected={selectedDate} periods={availabilityQuery.data?.periods || []} loading={availabilityQuery.isFetching} onAnchorChange={(value) => { setAnchor(value); resetSelection(); void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: auditType, frequency, date: undefined, visitor: undefined }, replace: true }) }} onSelect={(period) => { setSelectedDate(period.date); setSelectedVisitorIndex(null); void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: auditType, frequency, date: period.date, visitor: undefined }, replace: true }) }} /></div>
          </div>
        </div>
        {data && <div className="mt-5 rounded-xl border bg-white/90 p-3"><div className="mb-2 flex flex-wrap items-end justify-between gap-3 text-sm"><div className="flex flex-wrap items-end gap-3">{!(auditType === 'visitor' && data.visitorOptions.length > 1 && selectedVisitorIndex !== null) && <span className="pb-2 font-medium">{data.period.label}</span>}{auditType === 'visitor' && data.visitorOptions.length > 1 && selectedVisitorIndex !== null && <label className="space-y-1 text-xs font-semibold text-slate-600">Visitor<select value={selectedVisitorIndex} onChange={(event) => { const visitorIndex = Number(event.target.value); setSelectedVisitorIndex(visitorIndex); void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: 'visitor', frequency, date: selectedDate, visitor: visitorIndex }, replace: true }) }} className="block h-9 min-w-48 rounded-md border bg-white px-3 text-sm font-normal text-slate-900"><option value={selectedVisitorIndex}>{selectedVisitor ? reportUserName(selectedVisitor.user) : 'Selected Visitor'}</option>{data.visitorOptions.filter((option) => option.index !== selectedVisitorIndex).map((option) => <option key={option.index} value={option.index}>{reportUserName(option.user)}</option>)}</select></label>}{auditType === 'visitor' && data.visitorOptions.length === 1 && selectedVisitor && <span className="pb-2 text-slate-600">Visitor: {reportUserName(selectedVisitor.user)}</span>}</div><strong className="pb-2 text-violet-700">{data.summary.completed} of {data.summary.total} completed · {percent}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} /></div></div>}
      </section>

      <Dialog open={visitorDialogOpen} onOpenChange={setVisitorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Visitor audit</DialogTitle>
            <DialogDescription>More than one Visitor completed audit work during this period. Choose whose sections you want to review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(data?.visitorOptions || []).map((option) => (
              <button
                key={option.index}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
                onClick={() => {
                  setSelectedVisitorIndex(option.index)
                  setVisitorDialogOpen(false)
                  void navigate({ to: '/audit-tracker/report', search: { site: site || undefined, type: 'visitor', frequency, date: selectedDate, visitor: option.index }, replace: true })
                }}
              >
                <span className="flex min-w-0 items-center gap-3"><span className="rounded-full bg-violet-100 p-2 text-violet-700"><UserRound className="h-4 w-4" /></span><span className="truncate font-medium text-slate-900">{reportUserName(option.user)}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{option.runCount} section{option.runCount === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {!selectedDate && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-violet-400" /><h2 className="font-semibold text-slate-800">Select a report period</h2><p className="mt-1 text-sm text-slate-500">Green dots indicate audit activity. Gray periods currently have no report data.</p></div>}
      {selectedDate && reportQuery.isLoading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white text-sm text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading report…</div>}
      {selectedDate && reportQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">Unable to load this report.</div>}
      {selectedDate && data?.visitorSelectionRequired && selectedVisitorIndex === null && !visitorDialogOpen && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><UserRound className="mx-auto mb-3 h-9 w-9 text-violet-400" /><h2 className="font-semibold">Select a Visitor audit</h2><p className="mt-1 text-sm text-slate-500">Choose one of the Visitors who completed audit work during this period.</p><Button type="button" className="mt-4" onClick={() => setVisitorDialogOpen(true)}>Choose Visitor</Button></div>}
      {selectedDate && data && !data.visitorSelectionRequired && !sections.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><CircleDashed className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-semibold">No assigned checklists</h2></div>}
      {selectedDate && data && sections.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.map((section) => {
        const value = section.summary.total ? Math.round((section.summary.completed / section.summary.total) * 100) : 0
        const complete = section.summary.pending === 0
        const started = section.summary.completed > 0
        const auditUser = section.run?.completedBy || section.run?.startedBy
        const theme = complete ? ['border-emerald-200 bg-emerald-50/70', 'bg-emerald-500', 'text-emerald-700'] : started ? ['border-amber-200 bg-amber-50/70', 'bg-amber-500', 'text-amber-700'] : ['border-red-200 bg-red-50/60', 'bg-red-500', 'text-red-700']
        return <button key={section._id} type="button" className="text-left" onClick={() => auditType === 'visitor' && selectedVisitorIndex !== null ? navigate({ to: '/audit-tracker/report/visitor/$sectionId', params: { sectionId: section._id }, search: { site, frequency, date: selectedDate, visitor: selectedVisitorIndex } }) : auditType === 'store' ? navigate({ to: '/audit-tracker/report/$sectionId', params: { sectionId: section._id }, search: { site, type: 'store', frequency, date: selectedDate } }) : undefined}><Card className={`h-full transition hover:-translate-y-0.5 hover:shadow-md ${theme[0]}`}><CardHeader className="pb-3"><div className="flex justify-between gap-3"><CardTitle className="text-lg">{section.name}</CardTitle>{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-slate-400" />}</div></CardHeader><CardContent><div className="mb-2 flex justify-between text-xs"><span>{section.summary.completed} of {section.summary.total} completed</span><strong className={theme[2]}>{value}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full ${theme[1]}`} style={{ width: `${value}%` }} /></div><div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{section.run ? (section.run.state === 'completed' ? 'Run completed' : 'Run in progress') : 'Audit not started'}</span>{auditType === 'visitor' && auditUser && <span className="truncate font-medium text-violet-700">{reportUserName(auditUser)}</span>}</div></CardContent></Card></button>
      })}</div>}
    </div>
  )
}
