import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { addMonths, addYears, format, getDay, parseISO, startOfMonth } from 'date-fns'
import { CalendarDays, ChartNoAxesCombined, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Clock3, Loader2 } from 'lucide-react'
import { auditTrackerService } from '@/api/audit-tracker/audit-tracker.service'
import type { AuditReportAvailability, AuditReportFrequency } from '@/api/audit-tracker/audit-tracker.types'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { hasAuditTrackerAccess, hasAuditTrackerPermission } from '@/lib/auditTrackerPermissions'

export const Route = createFileRoute('/_navbarLayout/audit-tracker/report')({ component: AuditTrackerReportPage })

type AvailabilityPeriod = AuditReportAvailability['periods'][number]
const monthAnchor = (date = new Date()) => format(startOfMonth(date), 'yyyy-MM-dd')

function AvailabilityDot({ available }: { available: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
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
              {periods.map((period) => <button key={period.periodKey} type="button" onClick={() => { onSelect(period); setOpen(false) }} className={`flex h-10 flex-col items-center justify-center rounded-lg text-sm transition hover:bg-violet-50 ${selected === period.date ? 'bg-violet-100 font-bold text-violet-800 ring-1 ring-violet-300' : period.hasData ? 'text-slate-900' : 'text-slate-400'}`}><span>{period.label}</span><AvailabilityDot available={period.hasData} /></button>)}
            </div>
          </div>
        ) : frequency === 'weekly' ? (
          <div className="space-y-1.5">
            <p className="mb-2 text-[11px] text-slate-500">Weeks run Sunday through Saturday.</p>
            {periods.map((period) => <button key={period.periodKey} type="button" onClick={() => { onSelect(period); setOpen(false) }} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition hover:border-violet-200 hover:bg-violet-50 ${selected === period.date ? 'border-violet-300 bg-violet-50 text-violet-800' : period.hasData ? 'border-slate-200' : 'border-slate-100 text-slate-400'}`}><span><strong className="mr-2">{period.periodKey.replace(/^\d+-W/, 'Week ')}</strong>{period.label}</span><AvailabilityDot available={period.hasData} /></button>)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {periods.map((period) => <button key={period.periodKey} type="button" onClick={() => { onSelect(period); setOpen(false) }} className={`flex h-16 flex-col items-center justify-center rounded-lg border text-sm transition hover:border-violet-200 hover:bg-violet-50 ${selected === period.date ? 'border-violet-300 bg-violet-50 font-bold text-violet-800' : period.hasData ? 'border-slate-200' : 'border-slate-100 text-slate-400'}`}><span>{period.label}</span><span className="mt-1"><AvailabilityDot available={period.hasData} /></span></button>)}
          </div>
        )}
        <div className="mt-3 flex gap-4 border-t pt-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><AvailabilityDot available />Audit activity</span><span className="flex items-center gap-1.5"><AvailabilityDot available={false} />No activity</span></div>
      </DialogContent>
    </Dialog>
  )
}

function AuditTrackerReportPage() {
  const { user } = useAuth()
  const [site, setSite] = useState('')
  const [frequency, setFrequency] = useState<AuditReportFrequency>('daily')
  const [anchor, setAnchor] = useState(monthAnchor)
  const [selectedDate, setSelectedDate] = useState('')

  useEffect(() => { if (!site && user?.location) setSite(user.location) }, [site, user?.location])
  const availabilityQuery = useQuery({
    queryKey: ['audit-tracker', 'report', 'availability', site, frequency, anchor],
    queryFn: () => auditTrackerService.reportAvailability({ site, frequency, anchor }),
    enabled: Boolean(site),
  })
  const reportQuery = useQuery({
    queryKey: ['audit-tracker', 'report', 'store', site, frequency, selectedDate],
    queryFn: () => auditTrackerService.reportOverview({ site, frequency, date: selectedDate }),
    enabled: Boolean(site && selectedDate),
  })
  const data = reportQuery.data
  const percent = data?.summary.total ? Math.round((data.summary.completed / data.summary.total) * 100) : 0
  const sections = useMemo(() => [...(data?.sections || [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name)), [data?.sections])

  if (!user) return null
  if (!hasAuditTrackerAccess(user.access) || !hasAuditTrackerPermission(user.access, 'report')) return <Navigate to="/no-access" replace />

  const resetSelection = () => setSelectedDate('')
  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-10 sm:px-5">
      <section className="mb-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-600 p-2.5 text-white"><ChartNoAxesCombined className="h-6 w-6" /></div><div><h1 className="text-xl font-bold sm:text-2xl">Store audit reports</h1><p className="mt-1 text-sm text-slate-600">Select a period to load its section completion report.</p></div></div>
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[680px]">
            <div className="space-y-1"><p className="text-xs font-semibold text-slate-600">Station</p><SitePicker value={site} onValueChange={(value) => { setSite(value); resetSelection() }} className="h-10 w-full" /></div>
            <label className="space-y-1 text-xs font-semibold text-slate-600">Frequency<select value={frequency} onChange={(event) => { setFrequency(event.target.value as AuditReportFrequency); setAnchor(monthAnchor()); resetSelection() }} className="h-10 w-full rounded-md border bg-white px-3 text-sm font-normal"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <div className="space-y-1"><p className="text-xs font-semibold text-slate-600">Report period</p><PeriodPicker frequency={frequency} anchor={anchor} selected={selectedDate} periods={availabilityQuery.data?.periods || []} loading={availabilityQuery.isFetching} onAnchorChange={(value) => { setAnchor(value); resetSelection() }} onSelect={(period) => setSelectedDate(period.date)} /></div>
          </div>
        </div>
        {data && <div className="mt-5 rounded-xl border bg-white/90 p-3"><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium">{data.period.label}</span><strong className="text-violet-700">{data.summary.completed} of {data.summary.total} completed · {percent}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${percent}%` }} /></div></div>}
      </section>

      {!selectedDate && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-violet-400" /><h2 className="font-semibold text-slate-800">Select a report period</h2><p className="mt-1 text-sm text-slate-500">Green dots indicate audit activity. Periods without activity remain available for incomplete-audit review.</p></div>}
      {selectedDate && reportQuery.isLoading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white text-sm text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading report…</div>}
      {selectedDate && reportQuery.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">Unable to load this report.</div>}
      {selectedDate && data && !sections.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><CircleDashed className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-semibold">No assigned checklists</h2></div>}
      {selectedDate && data && sections.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.map((section) => {
        const value = section.summary.total ? Math.round((section.summary.completed / section.summary.total) * 100) : 0
        const complete = section.summary.pending === 0
        const started = section.summary.completed > 0
        const theme = complete ? ['border-emerald-200 bg-emerald-50/70', 'bg-emerald-500', 'text-emerald-700'] : started ? ['border-amber-200 bg-amber-50/70', 'bg-amber-500', 'text-amber-700'] : ['border-red-200 bg-red-50/60', 'bg-red-500', 'text-red-700']
        return <Card key={section._id} className={theme[0]}><CardHeader className="pb-3"><div className="flex justify-between gap-3"><CardTitle className="text-lg">{section.name}</CardTitle>{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-slate-400" />}</div></CardHeader><CardContent><div className="mb-2 flex justify-between text-xs"><span>{section.summary.completed} of {section.summary.total} completed</span><strong className={theme[2]}>{value}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full ${theme[1]}`} style={{ width: `${value}%` }} /></div><p className="mt-4 text-xs text-slate-500">{section.run ? (section.run.state === 'completed' ? 'Run completed' : 'Run in progress') : 'Audit not started'}</p></CardContent></Card>
      })}</div>}
    </div>
  )
}
