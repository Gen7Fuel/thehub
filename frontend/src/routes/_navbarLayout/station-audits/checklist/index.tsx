import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, CircleDashed, ClipboardCheck, Loader2 } from 'lucide-react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { isApiError } from '@/api/core/errors'
import { stationAuditsService } from '@/api/station-audits/station-audits.service'
import type { StationAuditSectionListReadModel } from '@/api/station-audits/station-audits.types'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist/')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
  }),
  component: SectionNavigationPage,
})

function SectionNavigationPage() {
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const { site } = Route.useSearch()
  const [data, setData] = useState<StationAuditSectionListReadModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!site && user?.location) navigate({ search: { site: user.location }, replace: true })
  }, [navigate, site, user?.location])

  useEffect(() => {
    if (!site) return
    let cancelled = false
    setLoading(true)
    setError('')

    stationAuditsService.listSections({ site, type: 'store' })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) {
          navigate({ to: '/no-access' })
          return
        }
        setError('Unable to load audit sections. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [navigate, site])

  const completion = data?.summary.total
    ? Math.round((data.summary.completed / data.summary.total) * 100)
    : 0
  const sortedSections = useMemo(
    () => [...(data?.sections || [])].sort((left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
      || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [data?.sections],
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
          <SitePicker value={site} onValueChange={(nextSite) => navigate({ search: { site: nextSite }, replace: true })} className="h-11 w-full sm:w-60" />
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

      {!loading && !error && data?.sections.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <CircleDashed className="mx-auto mb-3 h-9 w-9 text-slate-400" />
          <h2 className="font-semibold text-slate-800">No sections assigned</h2>
          <p className="mt-1 text-sm text-slate-500">This station has no active audit sections.</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedSections.map((section) => {
            const percent = section.summary.total ? Math.round((section.summary.completed / section.summary.total) * 100) : 0
            return (
              <Link key={section._id} to="/station-audits/checklist/$sectionId" params={{ sectionId: section._id }} search={{ site, frequency: 'all' }} className="group">
                <Card className="h-full border-slate-200 transition-all group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{section.name}</CardTitle>
                      {section.summary.pending === 0 && section.summary.total > 0
                        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        : <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />}
                    </div>
                    {section.description && <p className="text-sm font-normal text-slate-500">{section.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{section.summary.completed} of {section.summary.total} completed</span>
                      <strong className="text-emerald-700">{percent}%</strong>
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} /></div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['daily', 'weekly', 'monthly'] as const).map((frequency) => section.frequencies[frequency].total > 0 && (
                        <Badge key={frequency} variant="secondary" className="capitalize">{frequency} {section.frequencies[frequency].completed}/{section.frequencies[frequency].total}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
