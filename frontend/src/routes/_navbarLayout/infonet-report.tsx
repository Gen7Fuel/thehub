import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { SitePicker } from '@/components/custom/sitePicker' // Adjust imports to your project
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
// import { useAuth } from "@/context/AuthContext";


// Helper for formatting dates to YYYY-MM-DD for the API
// Helpers for YYYY-MM-DD
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const Route = createFileRoute('/_navbarLayout/infonet-report')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    site: (search.site as string) || '',
    from: (search.from as string) || '',
    to: (search.to as string) || '',
  }),
  loaderDeps: ({ search: { site, from, to } }) => ({ site, from, to }),
})

function RouteComponent() {
  const { site, from, to } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync internal state with URL params or default to 30 days
  const [currentRange, setCurrentRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
    const endDate = to ? new Date(to) : new Date()
    const startDate = from ? new Date(from) : new Date()

    // If no URL params, default to 30 days ago
    if (!from) startDate.setDate(endDate.getDate() - 30)

    return { from: startDate, to: endDate }
  })

  const setSearch = (next: Partial<{ site: string; from: string; to: string }>) => {
    navigate({ search: (prev: any) => ({ ...prev, ...next }) })
  }

  // Update URL search params only when a full range is picked
  useEffect(() => {
    if (currentRange.from && currentRange.to) {
      setSearch({
        from: ymd(currentRange.from),
        to: ymd(currentRange.to)
      })
    }
  }, [currentRange])

  // Calculate Grand Totals for the summary section
  const grandTotals = data.reduce(
    (acc, row) => {
      acc.taxExempt += row.totalExemptedTax || 0
      acc.itemSales += row.totalItemSales || 0
      // Ensure we sum the absolute values if the backend hasn't already
      acc.cplBulloch += Math.abs(row.totalCplBulloch || 0)
      return acc
    },
    { taxExempt: 0, itemSales: 0, cplBulloch: 0 }
  )

  // Sort data descending by date (Latest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  useEffect(() => {
    async function fetchReport() {
      // Only fetch if site and full range are selected
      if (!site || !from || !to) {
        setData([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        const query = new URLSearchParams({
          site,
          from,
          to
        }).toString()

        const res = await fetch(`/api/cash-summary/tax-exempt-report?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
            'Content-Type': 'application/json'
          },
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to fetch report data')
        }

        const json = await res.json()
        setData(json)
      } catch (err: any) {
        setError(err.message)
        console.error("Fetch error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [site, from, to])
  return (
    <div className="pt-5 flex flex-col items-center min-h-screen bg-slate-50 pb-10">
      <div className="my-4 flex flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[220px]"
        />

        <DatePickerWithRange
          date={currentRange}
          setDate={(val: any) => {
            // Logic copied from OverShortReport
            const next = typeof val === 'function' ? val(currentRange) : val
            if (next?.from && next?.to) {
              setCurrentRange(next)
            } else if (next?.from) {
              // Allows UI to show the selection in progress
              setCurrentRange({ from: next.from, to: undefined })
            }
          }}
        />
      </div>

      {!site && (
        <p className="mt-10 text-sm text-muted-foreground text-center">
          Please select a site and date range to view the Tax Exempt report.
        </p>
      )}

      {site && (
        <div className="w-full max-w-6xl px-4">
          {loading && <div className="text-center py-10 animate-pulse text-slate-500">Loading report data...</div>}
          {error && <div className="text-red-600 text-center py-10 bg-red-50 rounded-lg border border-red-100">{error}</div>}

          {!loading && !error && data.length > 0 && (
            <>
              {/* 2. Grand Total Summary Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md border border-blue-700">
                  <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Total Infonet Tax Rebate</p>
                  <p className="text-3xl font-bold mt-1">
                    C${grandTotals.taxExempt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {/* New CPL Bulloch Card with Warning Logic */}
                <div className={`p-6 rounded-xl shadow-md border transition-all ${grandTotals.cplBulloch > grandTotals.taxExempt
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-white text-slate-800 border-slate-200'
                  }`}>
                  <p className={`${grandTotals.cplBulloch > grandTotals.taxExempt ? 'text-red-100' : 'text-slate-500'} text-sm font-medium uppercase tracking-wider`}>
                    Total CPL Bulloch Tax {grandTotals.cplBulloch > grandTotals.taxExempt && "⚠️ Exceeds Infonet"}
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    C${grandTotals.cplBulloch.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white text-slate-800 p-6 rounded-xl shadow-md border border-slate-200">
                  <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Item Sales</p>
                  <p className="text-3xl font-bold mt-1 text-slate-900">
                    C${grandTotals.itemSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* 3. Daily Breakdown Table */}
              <div className="overflow-hidden border border-slate-300 rounded-lg shadow-md bg-white">
                <table className="min-w-full text-sm border-collapse table-fixed">
                  <thead className="bg-slate-800 text-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold w-32">Date</th>
                      <th className="px-4 py-3 text-left font-semibold w-40">Shift Numbers</th>
                      <th className="px-4 py-3 text-right font-semibold w-40">Infonet Tax (C$)</th>
                      <th className="px-4 py-3 text-right font-semibold w-40">CPL Bulloch Tax</th> {/* NEW COLUMN */}
                      <th className="px-4 py-3 text-right font-semibold w-40">Total Item Sales</th>
                      <th className="px-4 py-3 text-center font-semibold w-36">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {sortedData.map((row) => {
                      const hasShifts = row.shiftNumbers && row.shiftNumbers.length > 0;

                      // Use absolute values for comparison
                      const absBulloch = Math.abs(row.totalCplBulloch || 0);
                      const absInfonet = Math.abs(row.totalExemptedTax || 0);
                      const isOverLimit = absBulloch > absInfonet;
                      return (
                        <tr key={row.date} className={`transition-colors ${isOverLimit ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.date}</td>
                          <td className="px-4 py-3 text-slate-600 truncate">
                            {hasShifts ? row.shiftNumbers.join(', ') : '—'}
                          </td>

                          {!hasShifts && !row.isSubmitted ? (
                            <td colSpan={4} className="px-4 py-3 text-center text-amber-600 italic bg-amber-50/50">
                              No shifts recorded for this date.
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-right text-blue-700 font-bold">
                                {absInfonet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>

                              {/* Displaying as a positive number for the report view */}
                              <td className={`px-4 py-3 text-right font-bold ${isOverLimit ? 'text-red-600' : 'text-slate-700'}`}>
                                {absBulloch.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>

                              <td className="px-4 py-3 text-right font-medium">
                                {row.totalItemSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {row.isSubmitted ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                    Draft
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!loading && !error && data.length === 0 && (
            <p className="text-center py-10 text-slate-400 italic">No data found for the selected criteria.</p>
          )}
        </div>
      )}
    </div>
  )
}