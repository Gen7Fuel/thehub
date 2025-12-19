import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useEffect } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button';
// import { domain } from '@/lib/constants'

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
  payouts?: number
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
    payouts: number
  }
  report?: { notes?: string; submitted?: boolean }
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
  // const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>(
    report?.report?.submitted === true ? 'submitted' : 'idle'
  )
  const notes = report?.report?.notes ?? ''
  const submitted = report?.report?.submitted === true

  const saveNotes = async (text: string) => {
    if (!site || !date || submitted || !text.trim()) return
    await fetch('/api/cash-summary/report', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({ site, date, notes: text }),
    }).catch(() => { })
    // Optionally refetch route loader:
    // navigate({ search: (prev: Search) => ({ ...prev }) })
  }

  useEffect(() => {
    if (report?.report?.submitted === true) {
      setSubmitState('submitted')
    } else {
      setSubmitState('idle')
    }
  }, [report])


  const onSubmitClick = async () => {
    if (submitState !== 'idle' || !site || !date) return

    // If this site sells lottery, ensure a saved Lottery entry exists for this date
    try {
      const token = localStorage.getItem('token')
      const locResp = await fetch('/api/locations', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (locResp.ok) {
        const locs = await locResp.json()
        const found = Array.isArray(locs) ? locs.find((l: any) => l.stationName === site) : null
        if (found && found.sellsLottery) {
          // lottery state was loaded earlier; if missing, block submit
          if (!lottery) {
            alert('You need to add lottery values to submit this report. Redirecting to Lottery entry page.')
            navigate({ to: '/cash-summary/lottery' })
            return
          }
        }
      }
    } catch (e) {
      console.warn('Could not verify site sellsLottery', e)
      // if we cannot verify, allow submit to proceed
    }

    const proceed = window.confirm(
      'An email will be sent to Accounting with a copy of the Cash Summary Report.\n\nDo you want to continue?'
    )
    if (!proceed) return

    // console.log('submitted')
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

  // Lottery saved entry for this site/date (for report print)
  const [lottery, setLottery] = useState<any | null>(null)
  const [bullock, setBullock] = useState<any | null>(null)
  const [_, setLotteryLoading] = useState(false)

  useEffect(() => {
    const fetchLottery = async () => {
      if (!site || !date) {
        setLottery(null)
        setBullock(null)
        return
      }
      setLotteryLoading(true)
      try {
        const token = localStorage.getItem('token')
        const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!resp.ok) {
          setLottery(null)
          setBullock(null)
          return
        }
        const data = await resp.json()
        setLottery(data?.lottery ?? null)
        setBullock(data?.totals ?? null)
      } catch (e) {
        console.warn('Failed to fetch lottery for report', e)
        setLottery(null)
        setBullock(null)
      } finally {
        setLotteryLoading(false)
      }
    }
    fetchLottery()
  }, [site, date])

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
          #print-area { position: relative; inset: 0; width: 100%; }
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
                  <Card title="Payouts" value={fmtNum(totals?.payouts)} />
                </div>
              </div>

              {/* Lottery summary (only show when a saved Lottery exists for this site/date)
                  Rendered between Totals and Shifts. Images are excluded from this report view. */}
              {lottery && (
                <div className="mb-4 border rounded p-3 bg-card">
                  <h4 className="text-sm font-semibold mb-2">Lottery</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Lottery</th>
                          <th className="px-3 py-2 text-left">Bullock</th>
                          <th className="px-3 py-2 text-left">Over / Short</th>
                        </tr>
                      </thead>

                      <tbody>
                        {/* ================= ONLINE SALES ================= */}
                        <tr className="border-t font-semibold">
                          <td className="px-3 py-2">Online Sales</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.onlineLottoTotal ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? `$${Number(bullock.onlineSales || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? (
                              <span
                                className={
                                  ((bullock.onlineSales || 0) -
                                    ((lottery.onlineLottoTotal ?? 0) -
                                      (lottery.onlineCancellations || 0) -
                                      (lottery.onlineDiscounts || 0))) > 0
                                    ? 'text-green-600'
                                    : ((bullock.onlineSales || 0) -
                                      ((lottery.onlineLottoTotal ?? 0) -
                                        (lottery.onlineCancellations || 0) -
                                        (lottery.onlineDiscounts || 0))) < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                $
                                {Number(
                                  (bullock.onlineSales || 0) -
                                  ((lottery.onlineLottoTotal ?? 0) -
                                    (lottery.onlineCancellations || 0) -
                                    (lottery.onlineDiscounts || 0)),
                                ).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>

                        <tr className="border-t bg-gray-50">
                          <td className="px-3 py-2 pl-4">Lotto Cancellations</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.onlineCancellations ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">—</td>
                        </tr>

                        <tr className="border-t bg-gray-50">
                          <td className="px-3 py-2 pl-4">Lotto Discounts</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.onlineDiscounts ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">—</td>
                        </tr>

                        {/* ================= SCRATCH SALES ================= */}
                        <tr className="border-t font-semibold">
                          <td className="px-3 py-2">Scratch Sales</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.instantLottTotal ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? `$${Number(bullock.scratchSales || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? (
                              <span
                                className={
                                  ((bullock.scratchSales || 0) -
                                    ((lottery.instantLottTotal ?? 0) +
                                      (lottery.scratchFreeTickets ?? 0))) > 0
                                    ? 'text-green-600'
                                    : ((bullock.scratchSales || 0) -
                                      ((lottery.instantLottTotal ?? 0) +
                                        (lottery.scratchFreeTickets ?? 0))) < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                $
                                {Number(
                                  (bullock.scratchSales || 0) -
                                  ((lottery.instantLottTotal ?? 0) +
                                    (lottery.scratchFreeTickets ?? 0)),
                                ).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>

                        <tr className="border-t bg-gray-50">
                          <td className="px-3 py-2 pl-4">Scratch Free Tickets</td>
                          <td className="px-3 py-2">
                            {lottery.scratchFreeTickets != null
                              ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">—</td>
                        </tr>

                        {/* ================= PAYOUTS ================= */}
                        <tr className="border-t font-semibold">
                          <td className="px-3 py-2">Payouts</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.lottoPayout ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? `$${Number(bullock.payouts || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? (
                              <span
                                className={
                                  ((bullock.payouts || 0) -
                                    ((lottery.lottoPayout ?? 0) +
                                      (lottery.scratchFreeTickets ?? 0))) > 0
                                    ? 'text-green-600'
                                    : ((bullock.payouts || 0) -
                                      ((lottery.lottoPayout ?? 0) +
                                        (lottery.scratchFreeTickets ?? 0))) < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                $
                                {Number(
                                  (bullock.payouts || 0) -
                                  ((lottery.lottoPayout ?? 0) +
                                    (lottery.scratchFreeTickets ?? 0)),
                                ).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>

                        <tr className="border-t bg-gray-50">
                          <td className="px-3 py-2 pl-4">Scratch Free Tickets Payouts</td>
                          <td className="px-3 py-2">
                            {lottery.scratchFreeTickets != null
                              ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2">—</td>
                        </tr>

                        {/* ================= DATAWAVE ================= */}
                        <tr className="border-t font-semibold">
                          <td className="px-3 py-2">Datawave Value</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.dataWave ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? `$${Number(bullock.dataWave || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? (
                              <span
                                className={
                                  ((bullock.dataWave || 0) - (lottery.dataWave ?? 0)) > 0
                                    ? 'text-green-600'
                                    : ((bullock.dataWave || 0) - (lottery.dataWave ?? 0)) < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                $
                                {Number(
                                  (bullock.dataWave || 0) - (lottery.dataWave ?? 0),
                                ).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>

                        <tr className="border-t bg-gray-50">
                          <td className="px-3 py-2 pl-4">Datawave Fee</td>
                          <td className="px-3 py-2">
                            ${Number(lottery.feeDataWave ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? `$${Number(bullock.dataWaveFee || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bullock ? (
                              <span
                                className={
                                  ((bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0)) > 0
                                    ? 'text-green-600'
                                    : ((bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0)) < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                $
                                {Number(
                                  (bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0),
                                ).toFixed(2)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                        <KV k="Payouts" v={fmtNum(r.payouts)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <textarea
                  className="w-full min-h-[120px] border rounded px-3 py-2 text-sm"
                  defaultValue={notes}
                  onBlur={(e) => saveNotes(e.target.value)}
                  placeholder="Add notes for this cash summary…"
                  disabled={submitted}
                />
                {submitted && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Notes are locked because this report is submitted.
                  </div>
                )}
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