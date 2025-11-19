import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button';

type Search = { site: string; date: string }

type Row = {
  _id: string
  shift_number: string
  canadian_cash_collected?: number
  item_sales?: number
  cash_back?: number
  loyalty?: number
  cpl_bulloch?: number
  exempted_tax?: number
  report_canadian_cash?: number
}

type ReportData = {
  site: string
  date: string
  rows: Row[]
  totals: {
    count: number
    canadian_cash_collected: number
    item_sales: number
    cash_back: number
    loyalty: number
    cpl_bulloch: number
    exempted_tax: number
    report_canadian_cash: number
  }
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/report')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): Search => {
    const today = (() => {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()
    return {
      site: (search.site as string) || '',
      date: (search.date as string) || today,
    }
  },
  loaderDeps: ({ search: { site, date } }) => ({ site, date }),
  loader: async ({ deps: { site, date } }) => {
    if (!site || !date) return { report: null as ReportData | null, error: null as string | null }
    const res = await fetch(
      `/api/cash-summary/report?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Failed to load')
      return { report: null, error: msg || 'Failed to load' }
    }
    const report = (await res.json()) as ReportData
    return { report, error: null }
  },
})

function RouteComponent() {
  const { site, date } = Route.useSearch()
  const { report, error } = Route.useLoaderData() as { report: ReportData | null; error: string | null }
  const navigate = useNavigate({ from: Route.fullPath })
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle')

  const onSubmitClick = async () => {
    if (submitState !== 'idle' || !site || !date) return

    const proceed = window.confirm(
      'An email will be sent to Accounting with a copy of the Cash Summary Report.\n\nDo you want to continue?'
    )
    if (!proceed) return

    try {
      setSubmitState('submitting')
      const r = await fetch('/api/cash-summary/submit/to/safesheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site, date }),
      })
      if (!r.ok) {
        const msg = await r.text().catch(() => 'Submit failed')
        throw new Error(msg || 'Submit failed')
      }
      setSubmitState('submitted')
    } catch (e) {
      console.error(e)
      alert('Failed to submit.')
      setSubmitState('idle')
    }
  }

  const submitDisabled = submitState !== 'idle'
  const submitLabel =
    submitState === 'idle' ? 'Submit' : submitState === 'submitting' ? 'Submitting...' : 'Submitted'

  const updateSite = (newSite: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, site: newSite }) })
  const updateDate = (newDate: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, date: newDate }) })

  const rows = report?.rows ?? []
  const totals = report?.totals
  const hasRows = rows.length > 0

  const fmtNum = (n?: number) =>
    typeof n === 'number'
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—'

  const overShort =
    (totals?.canadian_cash_collected ?? 0) - (totals?.report_canadian_cash ?? 0)

  const osColor =
    overShort > 0 ? 'text-green-600' : overShort < 0 ? 'text-red-600' : 'text-muted-foreground'

  const skeletonCards = useMemo(
    () => Array.from({ length: 9 }).map((_, i) => (
      <div key={i} className="border rounded-md p-4 bg-muted/30 animate-pulse h-24" />
    )),
    []
  )

  return (
    <div className="pt-2 w-full flex flex-col items-center">
      {/* Print-only CSS: hide everything except #print-area */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; inset: 0; width: 100%; }
        }
      `}</style>

      <div className="w-full max-w-7xl px-4 space-y-6">
        <div className="flex items-end gap-4">
          <SitePicker
            value={site}
            onValueChange={updateSite}
            placeholder="Pick a site"
            label="Site"
            className="w-[220px]"
          />
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => updateDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div className="ml-auto flex flex-row gap-2">
            {hasRows && (
              <Button type="button" onClick={onSubmitClick} disabled={submitDisabled}>
                {submitLabel}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => window.print()}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden" id="print-area">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/40">
            <h2 className="text-sm font-semibold">
              Cash Summary – {site || '—'} – {date || '—'}
            </h2>
            {error && <span className="text-xs text-red-600">Error: {error}</span>}
          </div>

          {!site || !date ? (
            <div className="p-4 text-sm text-muted-foreground">Pick a site and date.</div>
          ) : !report && !error ? (
            <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{skeletonCards}</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No summaries</div>
          ) : (
            <div className="p-4 space-y-8">
              <div>
                <h3 className="text-sm font-semibold mb-2">Totals</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card title="Total Canadian Cash Counted" value={fmtNum(totals?.canadian_cash_collected)} />
                  <Card title="Total Canadian Cash Reported" value={fmtNum(totals?.report_canadian_cash)} />
                  <Card
                    title="Over/Short"
                    value={<span className={`font-semibold ${osColor}`}>{fmtNum(overShort)}</span>}
                  />
                  <Card title="Item Sales" value={fmtNum(totals?.item_sales)} />
                  <Card title="Cash Back" value={fmtNum(totals?.cash_back)} />
                  <Card title="Loyalty" value={fmtNum(totals?.loyalty)} />
                  <Card title="Exempted Tax" value={fmtNum(totals?.exempted_tax)} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Shifts</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((r) => (
                    <div key={r._id} className="border rounded-md p-4 bg-card">
                      <div className="text-xs text-muted-foreground mb-1">Shift Number</div>
                      <div className="text-base font-semibold mb-3">{r.shift_number}</div>
                      <div className="grid gap-2 text-sm">
                        <KV k="Canadian Cash Counted" v={fmtNum(r.canadian_cash_collected)} />
                        <KV k="Canadian Cash Reported" v={fmtNum(r.report_canadian_cash)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="border rounded-md p-4 bg-card">
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="text-base">{value}</div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  )
}