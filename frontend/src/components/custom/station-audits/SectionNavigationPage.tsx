import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleDashed, ClipboardCheck, Loader2 } from 'lucide-react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { isApiError } from '@/api/core/errors'
import { stationAuditsService } from '@/api/station-audits/station-audits.service'
import type { StationAuditFrequency, StationAuditSectionListReadModel, StationAuditSectionSummary } from '@/api/station-audits/station-audits.types'

type SectionFrequency = Exclude<StationAuditFrequency, 'all'>
const allFrequencies: SectionFrequency[] = ['daily', 'weekly', 'monthly']

function summarizeSection(section: StationAuditSectionSummary, frequencies: SectionFrequency[]) {
  return frequencies.reduce(
    (summary, frequency) => ({
      total: summary.total + section.frequencies[frequency].total,
      completed: summary.completed + section.frequencies[frequency].completed,
      pending: summary.pending + section.frequencies[frequency].pending,
    }),
    { total: 0, completed: 0, pending: 0 },
  )
}

export function StationAuditSectionNavigationPage({
  auditType,
  site,
  onSectionOpen,
  onSiteChange,
  onNoAccess,
  visibleFrequencies = allFrequencies,
}: {
  auditType: 'store' | 'visitor'
  site?: string
  onSectionOpen: (sectionId: string) => void
  onSiteChange: (site: string) => void
  onNoAccess: () => void
  visibleFrequencies?: SectionFrequency[]
}) {
  const { user } = useAuth()
  const [data, setData] = useState<StationAuditSectionListReadModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!site && user?.location) onSiteChange(user.location)
  }, [onSiteChange, site, user?.location])

  useEffect(() => {
    if (!site) return
    let cancelled = false
    setLoading(true)
    setError('')

    stationAuditsService.listSections({ site, type: auditType })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) {
          onNoAccess()
          return
        }
        setError('Unable to load audit sections. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [auditType, onNoAccess, site])

  const visibleSummary = useMemo(() => (data?.sections || []).reduce(
    (summary, section) => {
      const sectionSummary = summarizeSection(section, visibleFrequencies)
      return {
        total: summary.total + sectionSummary.total,
        completed: summary.completed + sectionSummary.completed,
        pending: summary.pending + sectionSummary.pending,
      }
    },
    { total: 0, completed: 0, pending: 0 },
  ), [data?.sections, visibleFrequencies])
  const completion = visibleSummary.total
    ? Math.round((visibleSummary.completed / visibleSummary.total) * 100)
    : 0
  const visibleSections = useMemo(
    () => [...(data?.sections || [])]
      .filter((section) => summarizeSection(section, visibleFrequencies).total > 0)
      .sort((left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
        || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [data?.sections, visibleFrequencies],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
      <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-600 p-2.5 text-white"><ClipboardCheck className="h-6 w-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Choose an audit section</h1>
              <p className="mt-1 text-sm text-slate-600">Open one section to load only its assigned checklist items.</p>
            </div>
          </div>
          <SitePicker value={site} onValueChange={onSiteChange} className="h-11 w-full sm:w-60" />
        </div>

        {data && (
          <div className="mt-5 rounded-xl border bg-white/90 p-3">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">Overall progress</span>
              <span className="font-bold text-emerald-700">{completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        )}
      </div>

      {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Loading sections…</div>}
      {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && data && visibleSections.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <CircleDashed className="mx-auto mb-3 h-9 w-9 text-slate-400" />
          <h2 className="font-semibold text-slate-800">No sections assigned</h2>
          <p className="mt-1 text-sm text-slate-500">This station has no active audit sections.</p>
        </div>
      )}

      {!loading && !error && data && visibleSections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSections.map((section) => {
            const sectionSummary = summarizeSection(section, visibleFrequencies)
            const percent = sectionSummary.total ? Math.round((sectionSummary.completed / sectionSummary.total) * 100) : 0
            return (
              <button key={section._id} type="button" onClick={() => onSectionOpen(section._id)} className="group text-left">
                <Card className="h-full border-slate-200 transition-all group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{section.name}</CardTitle>
                      {sectionSummary.pending === 0 && sectionSummary.total > 0
                        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        : <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />}
                    </div>
                    {section.description && <p className="text-sm font-normal text-slate-500">{section.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{sectionSummary.completed} of {sectionSummary.total} completed</span>
                      <strong className="text-emerald-700">{percent}%</strong>
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} /></div>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleFrequencies.map((frequency) => section.frequencies[frequency].total > 0 && (
                        <Badge key={frequency} variant="secondary" className="capitalize">{frequency} {section.frequencies[frequency].completed}/{section.frequencies[frequency].total}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
