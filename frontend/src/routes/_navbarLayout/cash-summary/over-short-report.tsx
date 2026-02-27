import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calculator, Wallet, TrendingUp, Landmark, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// --- Helpers ---
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const Route = createFileRoute('/_navbarLayout/cash-summary/over-short-report')({
  component: OverShortReport,
  validateSearch: (search: Record<string, unknown>) => ({
    site: (search.site as string) || '',
    date: (search.date as string) || '',
  }),
})

function OverShortReport() {
  const { site, date } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [data, setData] = useState<any[]>([])
  const [safesheetData, setSafesheetData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [_, setError] = useState<string | null>(null)

  const [currentRange, setCurrentRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
    const end = date ? new Date(date) : new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - 30)
    return { from: start, to: end }
  })

  useEffect(() => {
    if (!site || !currentRange.from || !currentRange.to) return

    const fetchAllData = async () => {
      setLoading(true)
      try {
        const fromStr = ymd(currentRange.from!)
        const toStr = ymd(currentRange.to!)
        const [osRes, safeRes] = await Promise.all([
          fetch(`/api/cash-summary/over-short?site=${site}&from=${fromStr}&to=${toStr}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch(`/api/safesheets/site/${site}/daily-balances?from=${fromStr}&to=${toStr}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        ])
        const osJson = await osRes.json()
        const safeJson = await safeRes.json()
        setData(Array.isArray(osJson) ? osJson : [])
        setSafesheetData(safeJson.data || [])
      } catch (err: any) {
        setError("Sync error")
      } finally {
        setLoading(false)
      }
    }
    fetchAllData()
  }, [site, currentRange])

  const safesheetMap = useMemo(() => {
    const map = new Map()
    safesheetData.forEach(d => map.set(d.date.split('T')[0], d))
    return map
  }, [safesheetData])

  // Fixed Totals Calculation to prevent NaN
  const totals = useMemo(() => {
    return data.reduce((acc, row) => {
      const daySafe = safesheetMap.get(row.date)
      return {
        overShort: acc.overShort + (Number(row.overShort) || 0),
        sales: acc.sales + (Number(row.report_canadian_cash) || 0),
        collected: acc.collected + (Number(row.canadian_cash_collected) || 0),
        deposits: acc.deposits + (Number(daySafe?.bankDepositTotal) || 0)
      }
    }, { overShort: 0, sales: 0, collected: 0, deposits: 0 })
  }, [data, safesheetMap])

  const setSearch = (next: any) => navigate({ search: (prev: any) => ({ ...prev, ...next }) })

  return (
    <div className="pt-5 flex flex-col items-center min-h-screen bg-slate-50 pb-10">
      <div className="my-4 flex flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <SitePicker value={site} onValueChange={(v) => setSearch({ site: v })} className="w-[220px]" />
        <DatePickerWithRange
          date={currentRange}
          setDate={(val: any) => {
            const next = typeof val === 'function' ? val(currentRange) : val
            if (next?.from && next?.to) setCurrentRange(next)
          }}
        />
      </div>

      {site && (
        <div className="w-full max-w-7xl px-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Net Over/Short"
              value={totals.overShort}
              icon={<Calculator size={20} />}
              variant={totals.overShort < 0 ? "danger" : totals.overShort > 0 ? "success" : "default"}
            />
            <SummaryCard title="Total Cash Sales" value={totals.sales} icon={<TrendingUp size={20} />} variant="default" />
            <SummaryCard title="Total Cash Collected" value={totals.collected} icon={<Wallet size={20} />} variant="info" />
            <SummaryCard title="Total Bank Deposits" value={totals.deposits} icon={<Landmark size={20} />} variant="warning" />
          </div>

          <div className="overflow-hidden border border-slate-300 rounded-xl shadow-md bg-white">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 py-4 text-left font-semibold">Date</th>
                  <th className="px-4 py-4 text-right font-semibold">Collected (C$)</th>
                  <th className="px-4 py-4 text-right font-semibold">Reported (C$)</th>
                  <th className="px-4 py-4 text-right font-semibold">Bank Deposit (C$)</th>
                  <th className="px-4 py-4 text-right font-semibold">Safe Balance (C$)</th>
                  <th className="px-4 py-4 text-center font-semibold">Over/Short (C$)</th>
                  <th className="px-4 py-4 text-left font-semibold">Managers Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <Loader2 className="animate-spin mx-auto text-slate-400" />
                    </td>
                  </tr>
                ) : (
                  // Sort descending: later dates (e.g. 2024-05-20) will appear before earlier ones (2024-05-01)
                  [...data]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((row) => {
                      const daySafe = safesheetMap.get(row.date);
                      const v = Number(row.overShort || 0);
                      const isShort = v < -0.01;
                      const isOver = v > 0.01;

                      return (
                        <tr
                          key={row.date}
                          className={`transition-colors ${isShort ? 'bg-red-50/30 hover:bg-red-50/50' :
                            isOver ? 'bg-green-50/30 hover:bg-green-50/50' :
                              'hover:bg-slate-50'
                            }`}
                        >
                          <td className="px-4 py-4 font-bold text-slate-700">{row.date}</td>
                          <td className="px-4 py-4 text-right font-medium text-blue-600">
                            {row.canadian_cash_collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-500 italic">
                            {row.report_canadian_cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-emerald-600">
                            {daySafe?.bankDepositTotal > 0 ? (
                              `${daySafe.bankDepositTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-slate-400 bg-slate-50/30">
                            {(daySafe?.endOfDayBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Badge
                              className={`w-28 justify-center font-bold ${isShort ? 'bg-red-100 text-red-700 border-red-200' :
                                isOver ? 'bg-green-100 text-green-700 border-green-200' :
                                  'bg-slate-100 text-slate-500'
                                }`}
                              variant="outline"
                            >
                              {v < 0 ? '-' : v > 0 ? '+' : ''}{Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <NoteCell date={row.date} note={row.notes} variance={v} />
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon, variant }: any) {
  const styles = {
    // Subtle Red Background for Shortages
    danger: "border-l-4 border-l-red-500 bg-red-50/50 text-slate-900",
    // Subtle Green Background for Overages
    success: "border-l-4 border-l-green-500 bg-green-50/50 text-slate-900",
    // Subtle Blue for General Info
    info: "border-l-4 border-l-blue-500 bg-blue-50/30 text-slate-900",
    // Subtle Orange for Warnings/Deposits
    warning: "border-l-4 border-l-orange-500 bg-orange-50/30 text-slate-900",
    // Neutral Slate
    default: "border-l-4 border-l-slate-800 bg-white text-slate-900"
  }[variant as string] || "bg-white"

  return (
    <Card className={`${styles} shadow-sm border-slate-200 transition-colors duration-200`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {title}
          </p>
          <div className={`${value < 0 ? 'text-red-300' : value > 0 ? 'text-green-300' : 'text-slate-300'}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-black flex items-baseline gap-1">
          {/* Explicitly show minus sign for negative values */}
          {value < 0 && <span className="text-red-600 font-bold">-</span>}
          {/* Explicitly show plus sign for positive variance ONLY if it's the Over/Short card */}
          {variant === "success" && value > 0 && <span className="text-green-600 font-bold">+</span>}

          <span className={value < 0 ? "text-red-700" : value > 0 && variant === "success" ? "text-green-700" : "text-slate-900"}>
            C${Math.abs(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function NoteCell({ date, note, variance }: { date: string, note?: string, variance: number }) {
  if (!note) return <span className="text-slate-300 italic text-[10px]">No notes</span>
  const preview = note.split(' ').slice(0, 10).join(' ') + (note.split(' ').length > 10 ? '...' : '')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 text-left hover:bg-slate-100 p-1 rounded transition-all group max-w-[150px]">
          <MessageSquare size={14} className="text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-600 line-clamp-1 group-hover:text-blue-600 underline decoration-dotted underline-offset-4">{preview}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Managers Note - {date}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex justify-between bg-slate-50 p-3 rounded border">
            <span className="text-sm text-slate-500 font-bold uppercase">Variance</span>
            <span className={`font-bold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {variance < 0 ? '-' : '+'}C${Math.abs(variance).toLocaleString()}
            </span>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-lg border text-slate-700 leading-relaxed">"{note}"</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}