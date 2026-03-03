import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useEffect, useRef } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button';
import { Info, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LotteryComparisonTable } from '@/components/custom/LotteryComparisionTable'

interface CardProps {
  title: React.ReactNode
  value: React.ReactNode
  dialogContent?: React.ReactNode
}
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
    voidedTransactionsAmount?: number
  }
  report?: { notes?: string; submitted?: boolean; unsettledPrepays?: number; handheldDebit?: number }
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
    if (!site || !date) {
      return { report: null as ReportData | null, error: null as string | null, accessDenied: false }
    }

    try {
      const res = await fetch(
        `/api/cash-summary/report?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
            "X-Required-Permission": "accounting.cashSummary.report",
          },
        }
      )

      // ✅ Permission denied
      if (res.status === 403) {
        return { report: null, error: null, accessDenied: true }
      }

      if (!res.ok) {
        const msg = await res.text().catch(() => 'Failed to load')
        return { report: null, error: msg || 'Failed to load', accessDenied: false }
      }

      const report = (await res.json()) as ReportData
      return { report, error: null, accessDenied: false }

    } catch (err) {
      return { report: null, error: 'Network error', accessDenied: false }
    }
  }
})

export function Card({ title, value, dialogContent }: CardProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border rounded-md p-4 bg-card">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        {title}
        {dialogContent && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button>
                <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-xs text-xs leading-relaxed">
              <DialogHeader>
                <DialogTitle>{title} Details</DialogTitle>
              </DialogHeader>
              {dialogContent}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="text-base">{value}</div>
    </div>
  )
}


function RouteComponent() {
  const { user } = useAuth()
  const access = user?.access || {}
  const { site, date } = Route.useSearch()
  // const { report, error } = Route.useLoaderData() as { report: ReportData | null; error: string | null }
  const { report, error, accessDenied } = Route.useLoaderData() as {
    report: ReportData | null
    error: string | null
    accessDenied: boolean
  }
  const navigate = useNavigate({ from: Route.fullPath })
  // const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted'>(
    report?.report?.submitted === true ? 'submitted' : 'idle'
  )
  const notes = report?.report?.notes ?? ''
  const submitted = report?.report?.submitted === true
  const unsettledPrepays = report?.report?.unsettledPrepays ?? undefined
  const handheldDebit = report?.report?.handheldDebit ?? undefined

  const [noteText, setNoteText] = useState('')
  const [fetching, setFetching] = useState(false)

  const [voidedDetails, setVoidedDetails] = useState<any[]>([]);
  const [loadingVoided, setLoadingVoided] = useState(false);

  // Lottery saved entry for this site/date (for report print)
  const [lottery, setLottery] = useState<any | null>(null)
  const [bullock, setBullock] = useState<any | null>(null)
  const [_, setLotteryLoading] = useState(false)

  const skeletonCards = useMemo(
    () => Array.from({ length: 9 }).map((_, i) => (
      <div key={i} className="border rounded-md p-4 bg-muted/30 animate-pulse h-24" />
    )),
    []
  )

  const submitStateRef = useRef<'idle' | 'submitting' | 'submitted'>(submitState)
  useEffect(() => {
    submitStateRef.current = submitState
  }, [submitState])

  // ✅ Redirect on permission failure
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" })
    }
  }, [accessDenied, navigate])


  useEffect(() => {
    setNoteText(notes)
  }, [notes])

  // const saveNotes = async (text: string) => {
  //   if (!site || !date || submitted || !text.trim()) return
  //   await fetch('/api/cash-summary/report', {
  //     method: 'PUT',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  //     },
  //     body: JSON.stringify({ site, date, notes: text }),
  //   }).catch(() => { })
  //   // Optionally refetch route loader:
  //   // navigate({ search: (prev: Search) => ({ ...prev }) })
  // }
  const saveNotes = async (text: string) => {
    if (!site || !date || submitted || !text.trim()) return

    try {
      const res = await fetch('/api/cash-summary/report', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.cashSummary.report',
        },
        body: JSON.stringify({ site, date, notes: text }),
      })

      // ✅ Permission denied → redirect
      if (res.status === 403) {
        navigate({ to: "/no-access" })
        return
      }

      if (!res.ok) {
        console.warn('Failed to save notes')
        return
      }

      // Optional: refetch loader
      // navigate({ search: (prev: Search) => ({ ...prev }) })

    } catch {
      console.warn('Failed to save notes (network)')
    }
  }

  // const saveField = async (key: 'unsettledPrepays' | 'handheldDebit', value: string) => {
  //   if (!site || !date || submitted) return
  //   const num = Number(value)
  //   if (!Number.isFinite(num)) return
  //   await fetch('/api/cash-summary/report', {
  //     method: 'PUT',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  //     },
  //     body: JSON.stringify({ site, date, [key]: num }),
  //   }).catch(() => { })
  // }
  const saveField = async (key: 'unsettledPrepays' | 'handheldDebit', value: string) => {
    if (!site || !date || submitted) return

    const num = Number(value)
    if (!Number.isFinite(num)) return

    try {
      const res = await fetch('/api/cash-summary/report', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.cashSummary.report',
        },
        body: JSON.stringify({ site, date, [key]: num }),
      })

      // ✅ Permission denied → redirect
      if (res.status === 403) {
        navigate({ to: "/no-access" })
        return
      }

      if (!res.ok) {
        console.warn(`Failed to save field: ${key}`)
        return
      }

    } catch {
      console.warn(`Failed to save field (network): ${key}`)
    }
  }


  useEffect(() => {
    if (report?.report?.submitted === true) {
      setSubmitState('submitted')
    } else {
      setSubmitState('idle')
    }
  }, [report])


  const onSubmitClick = async () => {
    if (submitStateRef.current !== 'idle' || !site || !date) {
      return
    }

    // If this site sells lottery, ensure a saved Lottery entry exists for this date
    try {
      const token = localStorage.getItem('token')
      const locResp = await fetch('/api/locations', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (locResp.ok) {
        const locs = await locResp.json()
        const found = Array.isArray(locs) ? locs.find((l: any) => l.stationName === site) : null
        if (found && found.sellsLottery) {
          console.log('[CashSummary] onSubmitClick site sellsLottery; lottery present?', !!lottery)
          // lottery state was loaded earlier; if missing, block submit
          if (!lottery) {
            alert('You need to add lottery values to submit this report. Redirecting to Lottery entry page.')
            navigate({ to: '/cash-summary/lottery' })
            return
          }
        }
      }
    } catch (e) {
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
          'X-Required-Permission': 'accounting.cashSummary.report',
        },
        body: JSON.stringify({ site, date }),
      })
      if (r.status === 403) {
        navigate({ to: "/no-access" })
        return
      }
      if (!r.ok) {
        const msg = await r.text().catch(() => 'Submit failed')
        throw new Error(msg || 'Submit failed')
      }
      setSubmitState('submitted')
    } catch (e) {
      alert('Failed to submit.')
      setSubmitState('idle')
    }
  }

  const onFetch = async () => {
    submitStateRef.current = 'idle'
    setSubmitState('idle')

    if (fetching) { return }
    if (!site || !date) { return }
    const ids = (report?.rows || []).map((r) => r._id).filter(Boolean)
    if (ids.length === 0) { return }
    setFetching(true)
    try {
      const token = localStorage.getItem('token') || ''
      let permissionDenied = false
      for (const id of ids) {
        try {
          const res = await fetch(`/api/cash-summary/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Required-Permission': 'accounting.cashSummary.report.fetchAgain',
            },
            body: JSON.stringify({ refetch: true }),
          })
          if (res.status === 403) {
            permissionDenied = true
            break
          }
          // Continue even if one fails; surface minimal feedback
          if (!res.ok) {
            // ignore refetch failures silently
          }
        } catch (e) {
          // ignore refetch errors silently
        }
      }
      // ✅ Redirect if permission failed
      if (permissionDenied) {
        navigate({ to: "/no-access" })
        return
      }
      await navigate({ search: (prev: Search) => ({ ...prev }) })
      await onSubmitClick()
    } finally {
      setFetching(false)
    }
  }

  const fetchVoidedDetails = async () => {
    // Only fetch if we don't already have data for this specific report
    if (voidedDetails.length > 0 || loadingVoided) return;

    setLoadingVoided(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(
        `/api/cash-summary/voided-transactions-details?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
        { headers: token ? { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'accounting.cashSummary.report' } : {}, }
      );
      if (resp.status === 403) {
        navigate({ to: "/no-access" })
        return
      }
      if (resp.ok) {
        const data = await resp.json();
        setVoidedDetails(data);
      }
    } catch (e) {
      console.error('Failed to fetch voided details', e);
    } finally {
      setLoadingVoided(false);
    }
  };

  // We still need this to "reset" when the user changes the main report site/date
  useEffect(() => {
    setVoidedDetails([]);
  }, [site, date]);

  console.log('Site/date report:', site, date, voidedDetails)

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
          headers: token ? { Authorization: `Bearer ${token}`, 'X-Required-Permission': 'accounting.cashSummary.report' } : {},
        })
        if (resp.status === 403) {
          setLottery(null)
          setBullock(null)
          navigate({ to: "/no-access" })
          return
        }
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

  const safeBullock = bullock ?? {
    onlineSales: 0,
    scratchSales: 0,
    payouts: 0,
  }

  const safeLottery = lottery ?? {
    onlineLottoTotal: 0,
    onlineCancellations: 0,
    onlineDiscounts: 0,
    instantLottTotal: 0,
    scratchFreeTickets: 0,
    lottoPayout: 0,
    vouchersRedeemed: 0,
  }

  const fmtNum = (n?: number) =>
    typeof n === 'number'
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—'

  const overShort =
    (totals?.canadian_cash_collected ?? 0) - (totals?.report_canadian_cash ?? 0) + (handheldDebit ?? 0) + (unsettledPrepays ?? 0)

  const baseReportedCash = totals?.report_canadian_cash || 0

  const onlineOverShort =
    (safeBullock.onlineSales || 0) -
    ((safeLottery.onlineLottoTotal ?? 0) -
      (safeLottery.onlineCancellations || 0) -
      (safeLottery.onlineDiscounts || 0))

  const scratchOverShort =
    (safeBullock.scratchSales || 0) -
    ((safeLottery.instantLottTotal ?? 0) +
      (safeLottery.scratchFreeTickets ?? 0) +
      (safeLottery.oldScratchTickets ?? 0))

  const payoutOverShort =
    (safeBullock.payouts || 0) - (safeLottery.lottoPayout ?? 0)

  const adjustedReportedCash =
    baseReportedCash + onlineOverShort + scratchOverShort

  const adjustedItemSales =
    (totals?.item_sales || 0) + onlineOverShort + scratchOverShort

  const adjustedPayouts =
    (totals?.payouts || 0) + payoutOverShort

  const adjustedOverShort =
    (totals?.canadian_cash_collected ?? 0) - // total cash collected
    (adjustedReportedCash ?? 0) + (handheldDebit ?? 0) + (unsettledPrepays ?? 0)          // adjusted reported cash

  const osColor =
    overShort > 0 ? 'text-green-600' : overShort < 0 ? 'text-red-600' : 'text-muted-foreground'
  const adjustedOsColor =
    adjustedOverShort > 0 ? 'text-green-600' : adjustedOverShort < 0 ? 'text-red-600' : 'text-muted-foreground'

  if (accessDenied) return null

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
            {/* <Button type="button" variant="outline" onClick={() => window.print()}>
              Export PDF
            </Button> */}
            {access?.accounting?.cashSummary?.report?.fetchAgain && (
              <Button
                type="button"
                variant="outline"
                onClick={onFetch}
                disabled={fetching}
                title="Refetch shifts and submit"
                aria-label="Refetch shifts and submit"
              >
                <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
              </Button>
            )}
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
                  <Card
                    title={<span className="font-bold text-black">Voided Transactions</span>}
                    value={
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-semibold ${typeof totals?.voidedTransactionsAmount === 'number' && totals.voidedTransactionsAmount !== 0
                            ? 'text-red-600'
                            : ''
                            }`}
                        >
                          {fmtNum(totals?.voidedTransactionsAmount)}
                        </span>

                        {/* Only show the icon if the amount is greater than 0 */}
                        {(totals?.voidedTransactionsAmount ?? 0) > 0 && (
                          <Dialog onOpenChange={(open) => open && fetchVoidedDetails()}>
                            <DialogTrigger asChild>
                              <button className="p-1 rounded-full hover:bg-gray-100 transition-colors inline-flex items-center outline-none">
                                <Info className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-blue-600" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>Voided Transactions Summary</DialogTitle>
                              </DialogHeader>

                              <div className="flex-1 overflow-y-auto mt-4">
                                {loadingVoided ? (
                                  <div className="py-20 text-center animate-pulse">Loading summary...</div>
                                ) : voidedDetails.length > 0 ? (
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted sticky top-0">
                                      <tr>
                                        <th className="p-3 text-left">Transaction ID</th>
                                        <th className="p-3 text-left">Time</th>
                                        <th className="p-3 text-left">Items</th>
                                        <th className="p-3 text-right">Total Refunded</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {voidedDetails.map((tx) => (
                                        <tr key={tx.transactionId} className="hover:bg-muted/30">
                                          <td className="p-3 font-mono text-sm">{tx.transactionId}</td>
                                          <td className="p-3 text-muted-foreground">
                                            {/* Extracts the time portion (HH:mm:ss) from the ISO string without timezone conversion */}
                                            {tx.eventStartTime?.toString().split('T')[1]?.substring(0, 5) || tx.eventStartTime}
                                          </td>
                                          <td className="p-3">
                                            <Dialog>
                                              <DialogTrigger asChild>
                                                <button className="text-blue-600 underline hover:text-blue-800 font-medium cursor-pointer">
                                                  {tx.items.length} {tx.items.length === 1 ? 'Item' : 'Items'}
                                                </button>
                                              </DialogTrigger>
                                              <DialogContent className="max-w-2xl">
                                                <DialogHeader>
                                                  <DialogTitle>Transaction Details: {tx.transactionId} ({tx.eventStartTime?.toString().split('T')[1]?.substring(0, 5)})</DialogTitle>
                                                </DialogHeader>
                                                <div className="mt-4 border rounded-md overflow-hidden">
                                                  <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 border-b">
                                                      <tr>
                                                        <th className="p-2 text-left">Line</th>
                                                        <th className="p-2 text-left">Item Name</th>
                                                        <th className="p-2 text-left">UPC/GTIN</th>
                                                        <th className="p-2 text-right">Amount</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                      {tx.items.map((item: any, i: number) => (
                                                        <tr key={i}>
                                                          <td className="p-2 text-muted-foreground">{item.transactionLine}</td>
                                                          <td className="p-2 font-medium">
                                                            {item.itemName === 'NoMap' ? (
                                                              <span className="italic text-slate-400">Item Details Not Found</span>
                                                            ) : (
                                                              item.itemName
                                                            )}
                                                          </td>
                                                          <td className="p-2 text-muted-foreground font-mono">
                                                            {item.upc?.toString().startsWith('99999') || item.gtin?.toString().startsWith('99999') ? (
                                                              <span className="text-slate-300">N/A</span>
                                                            ) : (
                                                              item.upc || item.gtin || '—'
                                                            )}
                                                          </td>
                                                          <td className="p-2 text-right">{fmtNum(item.amount)}</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </DialogContent>
                                            </Dialog>
                                          </td>
                                          <td className="p-3 text-right font-bold text-red-600">
                                            {fmtNum(tx.totalAmount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="py-20 text-center text-muted-foreground">No records found.</div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    }
                  />
                </div>
              </div>

              {lottery && (
                <div className="rounded-lg bg-gray-100 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4">Adjusted Totals (After Lottery)</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                    <Card
                      title={<span className="font-bold text-black">Total Canadian Cash Counted</span>}
                      value={<span className="font-semibold">{fmtNum(totals?.canadian_cash_collected)}</span>}
                    />

                    <Card
                      title={<span className="font-bold text-black">Final Canadian Cash Reported</span>}
                      value={<span className="font-semibold">{fmtNum(adjustedReportedCash)}</span>}
                      dialogContent={
                        <div className="whitespace-pre-line text-sm leading-relaxed">
                          Adjusted Reported Cash = Bulloch Reported Cash + (Online Lottery Sales Over/Short + Scratch Lottery Sales Over/Short)
                        </div>
                      }
                    />

                    <Card
                      title={<span className="font-bold text-black">Final Over/Short</span>}
                      value={<span className={`font-bold ${adjustedOsColor}`}>{fmtNum(adjustedOverShort)}</span>}
                    />

                    <Card
                      title={<span className="font-bold text-black">Final Item Sales</span>}
                      value={<span className="font-semibold">{fmtNum(adjustedItemSales)}</span>}
                      dialogContent={
                        <div className="whitespace-pre-line text-sm leading-relaxed">
                          Adjusted Item Sales = Bulloch Item Sales + (Online Lottery Sales Over/Short + Scratch Lottery Sales Over/Short)
                        </div>
                      }
                    />

                    <Card
                      title={<span className="font-bold text-black">Final Payouts</span>}
                      value={<span className="font-semibold">{fmtNum(adjustedPayouts)}</span>}
                      dialogContent={
                        <div className="whitespace-pre-line text-sm leading-relaxed">
                          Adjusted Payouts = Bulloch Payouts + Lottery Payout Over/Short
                        </div>
                      }
                    />

                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold mb-2">Adjustments</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="border rounded-md p-4 bg-card">
                    <label className="text-xs text-muted-foreground mb-1 block">Unsettled Prepays</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={typeof unsettledPrepays === 'number' ? unsettledPrepays : ''}
                      onBlur={(e) => saveField('unsettledPrepays', e.target.value)}
                      disabled={submitted}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                  <div className="border rounded-md p-4 bg-card">
                    <label className="text-xs text-muted-foreground mb-1 block">Handheld Debit</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={typeof handheldDebit === 'number' ? handheldDebit : ''}
                      onBlur={(e) => saveField('handheldDebit', e.target.value)}
                      disabled={submitted}
                      className="border rounded px-3 py-2 w-full"
                    />
                  </div>
                </div>
                {submitted && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Adjustments are locked because this report is submitted.
                  </div>
                )}
              </div>

              {/* Lottery summary (only show when a saved Lottery exists for this site/date)
                  Rendered between Totals and Shifts. Images are excluded from this report view. */}
              {/* Integrated Lottery Comparison Table */}
              {lottery && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold px-1">Lottery Reconciliation</h3>
                  <LotteryComparisonTable
                    lotteryData={lottery}
                    bullockData={bullock}
                    isReadOnly={true}
                    showImages={false} // Set to false for the report view
                  />
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
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onBlur={() => saveNotes(noteText)}
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


// function Card({ title, value }: { title: string; value: React.ReactNode }) {
//   return (
//     <div className="border rounded-md p-4 bg-card">
//       <div className="text-xs text-muted-foreground mb-1">{title}</div>
//       <div className="text-base">{value}</div>
//     </div>
//   )
// }
// function Card({ title, value, tooltip }: CardProps) {
//   return (
//     <div className="border rounded-md p-4 bg-card">
//       <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
//         <span>{title}</span>

//         {tooltip && (
//           <TooltipProvider>
//             <Tooltip>
//               <TooltipTrigger asChild>
//                 <Info className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground" />
//               </TooltipTrigger>
//               <TooltipContent className="max-w-xs text-xs leading-relaxed">
//                 {tooltip}
//               </TooltipContent>
//             </Tooltip>
//           </TooltipProvider>
//         )}
//       </div>

//       <div className="text-base">{value}</div>
//     </div>
//   )
// }

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  )
}