import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, CircleDashed, Loader2, MessageSquareText, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { SitePicker } from '@/components/custom/sitePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { isApiError } from '@/api/core/errors'
import { stationAuditsService } from '@/api/station-audits/station-audits.service'
import type { StationAuditChecklistReadModel, StationAuditFrequency } from '@/api/station-audits/station-audits.types'

export const Route = createFileRoute('/_navbarLayout/station-audits/checklist/$sectionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : undefined,
    frequency: ['daily', 'weekly', 'monthly'].includes(String(search.frequency))
      ? search.frequency as StationAuditFrequency
      : 'all' as StationAuditFrequency,
  }),
  component: SectionChecklistPage,
})

const labels: Record<StationAuditFrequency, string> = { all: 'All frequencies', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

function SectionChecklistPage() {
  const { sectionId } = Route.useParams()
  const search = Route.useSearch()
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const [data, setData] = useState<StationAuditChecklistReadModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!search.site && user?.location) navigate({ search: { ...search, site: user.location }, replace: true })
  }, [navigate, search, user?.location])

  useEffect(() => {
    if (!search.site) return
    let cancelled = false
    setLoading(true)
    setError('')
    stationAuditsService.getSectionChecklists(sectionId, { site: search.site, frequency: search.frequency, type: 'store' })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((requestError) => {
        if (cancelled) return
        if (isApiError(requestError) && requestError.status === 403) return void navigate({ to: '/no-access' })
        if (isApiError(requestError) && requestError.status === 404) return void navigate({ to: '/station-audits/checklist', search: { site: search.site } })
        setError('Unable to load this audit section. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [navigate, search.frequency, search.site, sectionId])

  const section = data?.sections[0]
  const progress = section?.summary.total ? Math.round((section.summary.completed / section.summary.total) * 100) : 0
  const sortedItems = useMemo(() => section?.checklists || [], [section])

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-10 sm:px-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/station-audits/checklist" search={{ site: search.site }}><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Sections</Button></Link>
        <div className="grid gap-2 sm:grid-cols-2">
          <SitePicker value={search.site} onValueChange={(site) => navigate({ search: { ...search, site }, replace: true })} className="h-11 w-full sm:w-52" />
          <Select value={search.frequency} onValueChange={(frequency) => navigate({ search: { ...search, frequency: frequency as StationAuditFrequency }, replace: true })}>
            <SelectTrigger className="h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {loading && <div className="flex min-h-60 items-center justify-center rounded-2xl border border-dashed bg-white"><Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" /> Loading checklist…</div>}
      {!loading && error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-red-700">{error}</div>}

      {!loading && !error && section && (
        <>
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{section.name}</h1>{section.description && <p className="mt-1 text-sm text-slate-600">{section.description}</p>}</div>
              <Badge variant="outline" className="bg-white">{section.summary.pending} remaining</Badge>
            </div>
            <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><strong className="text-sm text-emerald-700">{progress}%</strong></div>
          </div>

          {sortedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No {labels[search.frequency as StationAuditFrequency].toLowerCase()} items are assigned.</div>
          ) : (
            <div className="grid gap-3">
              {sortedItems.map((checklist) => (
                <Card key={checklist._id} className={checklist.completed ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}>
                  <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="mb-2 flex flex-wrap gap-1.5"><Badge variant="secondary" className="capitalize">{checklist.frequency}</Badge>{checklist.category && <Badge variant="outline">{checklist.category}</Badge>}<Badge variant="outline">{checklist.department?.name || 'Unassigned'}</Badge></div><CardTitle className="text-base sm:text-lg">{checklist.item}</CardTitle></div>
                      {checklist.completed ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <CircleDashed className="h-6 w-6 text-slate-300" />}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 sm:p-5 sm:pt-2">
                    <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500"><span>{checklist.statusOptionSet?.options?.length || 0} status options</span>{checklist.commentRequired && <span className="flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" /> Comment required</span>}{checklist.requestOrderEnabled && <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Ordering available</span>}</div>
                    <Button className="h-11 w-full sm:w-auto" variant={checklist.completed ? 'outline' : 'default'} onClick={() => toast.info(`${checklist.item} submission will be connected next.`)}>{checklist.completed ? 'Update response' : 'Complete checklist'}</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
