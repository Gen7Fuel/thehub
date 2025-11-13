import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'

type Entry = {
  _id: string
  date: string
  description?: string
  cashIn: number
  cashExpenseOut: number
  cashDepositBank: number
  cashOnHandSafe?: number
  createdAt?: string
  updatedAt?: string
}

type SafeSheet = {
  _id: string
  site: string
  initialBalance: number
  entries: Entry[]
  createdAt?: string
  updatedAt?: string
}

export const Route = createFileRoute('/_navbarLayout/safesheet')({
  component: RouteComponent,
  validateSearch: (search) =>
    search as {
      site: string
    },
  loaderDeps: ({ search: { site }}) => ({ site })
})

export default function RouteComponent() {
  const { site } = Route.useSearch() as { site?: string }
  const navigate = useNavigate({ from: Route.fullPath })

  const updateSearch = (site: string) => {
    navigate({ search: { site } })
  }

  const [sheet, setSheet] = useState<SafeSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descRef = useRef<HTMLTableCellElement | null>(null)
  const cashInRef = useRef<HTMLTableCellElement | null>(null)
  const cashExpenseRef = useRef<HTMLTableCellElement | null>(null)
  const cashDepositRef = useRef<HTMLTableCellElement | null>(null)

  // Format numbers
  const fmtNumber = (v?: number | null) => {
    if (v === null || v === undefined || v === 0) return ''
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  }

  // Fetch sheet
  useEffect(() => {
    if (!site) {
      setSheet(null)
      setError(null)
      return
    }
    let mounted = true
    const fetchSheet = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "safesheet",
          },
        })
        if (res.status === 403) {
          navigate({ to: '/no-access' })
          return
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || 'Failed to fetch safesheet')
        }
        const data: SafeSheet = await res.json()
        if (mounted) setSheet(data)
      } catch (err: any) {
        console.error(err)
        if (mounted) setError(err.message || 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchSheet()
    return () => { mounted = false }
  }, [site])

  // Read numeric value from editable TD
  const readEditableNumber = (el?: HTMLTableCellElement | null) => {
    if (!el) return 0
    const txt = el.innerText.replace(/,/g, '').trim()
    const n = Number(txt)
    return isNaN(n) ? 0 : n
  }

  // Recompute running balance
  const recomputeCashOnHand = (entries: Entry[], initialBalance: number) => {
    let balance = initialBalance
    return entries.map((entry) => {
      balance = balance + entry.cashIn - entry.cashExpenseOut - entry.cashDepositBank
      return { ...entry, cashOnHandSafe: balance }
    })
  }

  // Add entry
  const handleAddEntry = async () => {
    if (!site || !sheet) return

    const entryBody = {
      date: new Date().toISOString(),
      description: descRef.current?.innerText.trim() || '',
      cashIn: readEditableNumber(cashInRef.current),
      cashExpenseOut: readEditableNumber(cashExpenseRef.current),
      cashDepositBank: readEditableNumber(cashDepositRef.current),
    }

    if (!entryBody.cashIn && !entryBody.cashExpenseOut && !entryBody.cashDepositBank) {
      setError('Please enter an amount in one of the fields')
      return
    }

    try {
      const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "safesheet",
        },
        body: JSON.stringify(entryBody)
      })

      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to add entry')

      if (body?.entries) {
        const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
        setSheet(prev => prev ? { ...prev, entries: updated } : prev)
      }

      // Clear inline row
      if (descRef.current) descRef.current.innerText = ''
      if (cashInRef.current) cashInRef.current.innerText = ''
      if (cashExpenseRef.current) cashExpenseRef.current.innerText = ''
      if (cashDepositRef.current) cashDepositRef.current.innerText = ''
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Add entry failed')
    }
  }

  // Update a single entry and recompute balances
  const updateEntry = async (entryId: string, field: string, value: any) => {
    if (!site || !sheet) return
    try {
      const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "safesheet",
        },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.status === 403) {
        navigate({ to: '/no-access' })
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || 'Failed to update entry')

      if (body?.entries) {
        const updated = recomputeCashOnHand(body.entries, sheet.initialBalance)
        setSheet(prev => prev ? { ...prev, entries: updated } : prev)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Update failed')
    }
  }

  // Memoized entries for display
  const formattedEntries = useMemo(() => {
    if (!sheet) return []
    return sheet.entries.map(e => ({
      ...e,
      // dateDisplay: new Date(e.date).toLocaleDateString(),
      dateDisplay: new Date(e.date).toLocaleDateString(),
      cashInDisplay: fmtNumber(e.cashIn),
      cashExpenseOutDisplay: fmtNumber(e.cashExpenseOut),
      cashDepositBankDisplay: fmtNumber(e.cashDepositBank),
      cashOnHandSafeDisplay: fmtNumber(e.cashOnHandSafe ?? null)
    }))
  }, [sheet])

  const showButtons = (id: string) => {
    console.log("Show buttons for entry id:", id);
  }

  return (
    <div className="pt-14 flex flex-col items-center">
      <div className="my-4 flex flex-col items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={updateSearch}
          placeholder="Pick a site"
          label="Site"
          className="w-[220px]"
        />
      </div>

      {!site && (
        <p className="text-sm text-muted-foreground text-center">
          Please select a site to view the safesheet.
        </p>
      )}

      {site && (
        <div className="w-full max-w-5xl px-2 sm:px-4">
          {loading && <p className="text-center">Loading...</p>}
          {error && <p className="text-red-600 text-center">{error}</p>}

          {!loading && !error && sheet && (
            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
              <table className="min-w-full text-sm border-collapse table-fixed">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium border-b border-slate-300">Date</th>
                    <th className="px-2 py-1 text-left font-medium border-b border-slate-300">Description</th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300">Cash In</th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300">Cash Expense Out</th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300">Cash Deposit Bank</th>
                    <th className="px-2 py-1 text-right font-medium border-b border-slate-300">Cash On Hand</th>
                  </tr>
                </thead>

                <tbody>
                  {formattedEntries.map((e) => {
                    const isToday = (() => {
                      const entry = new Date(e.date)
                      const now = new Date()
                      return entry.getUTCFullYear() === now.getUTCFullYear() &&
                            entry.getUTCMonth() === now.getUTCMonth() &&
                            entry.getUTCDate() === now.getUTCDate()
                    })()


                    // const isTodayUTC = (dateStr: string) => {
                    //   const entryDate = new Date(dateStr)
                    //   const today = new Date()
                    //   return entryDate.getUTCFullYear() === today.getUTCFullYear() &&
                    //         entryDate.getUTCMonth() === today.getUTCMonth() &&
                    //         entryDate.getUTCDate() === today.getUTCDate()
                    // }

                    // const isToday = isTodayUTC(e.date)



                    const handleCellBlur = (field: 'description' | 'cashIn' | 'cashExpenseOut' | 'cashDepositBank') =>
                      async (ev: React.FocusEvent<HTMLTableCellElement>) => {
                        ev.currentTarget.contentEditable = 'false'
                        if (!isToday) return

                        let value: string | number = ev.currentTarget.innerText.trim()
                        if (field !== 'description') value = Number(value.replace(/,/g, '')) || 0

                        // Update local state immediately
                        setSheet(prev => {
                          if (!prev) return prev
                          const updatedEntries = prev.entries.map(entry =>
                            entry._id === e._id ? { ...entry, [field]: value } : entry
                          )
                          const recomputed = recomputeCashOnHand(updatedEntries, prev.initialBalance)
                          return { ...prev, entries: recomputed }
                        })

                        // Update backend
                        await updateEntry(e._id, field, value)
                      }

                    const handleCellDoubleClick = (ev: React.MouseEvent<HTMLTableCellElement>) => {
                      if (isToday) {
                        ev.currentTarget.contentEditable = 'true'
                        ev.currentTarget.focus()
                      }
                    }

                    return (
                      <tr key={e._id} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50 transition-colors">
                        <td className="px-3 py-1.5 border-b border-slate-200 whitespace-nowrap text-gray-700">{e.dateDisplay}</td>
                        <td className="px-3 py-1.5 border-b border-slate-200 text-gray-700"
                          onDoubleClick={handleCellDoubleClick}
                          onBlur={handleCellBlur('description')}>
                          {e.description || ''}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
                          onDoubleClick={handleCellDoubleClick}
                          onBlur={handleCellBlur('cashIn')}>
                          {e.cashInDisplay}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
                          onDoubleClick={handleCellDoubleClick}
                          onBlur={handleCellBlur('cashExpenseOut')}>
                          {e.cashExpenseOutDisplay}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right text-gray-700"
                          onClick={() => e.cashDepositBankDisplay && showButtons(e._id)}
                          onDoubleClick={handleCellDoubleClick}
                          onBlur={handleCellBlur('cashDepositBank')}>
                          {e.cashDepositBankDisplay}
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-200 text-right font-medium text-gray-800">{e.cashOnHandSafeDisplay}</td>
                      </tr>
                    )
                  })}

                  {/* Inline add row */}
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2 text-gray-400 border-t border-slate-300 text-sm whitespace-nowrap">
                      {new Date().toLocaleDateString()}
                    </td>
                    <td ref={descRef} contentEditable suppressContentEditableWarning data-placeholder="Description"
                      className="px-3 py-2 border-t border-slate-300 text-sm text-slate-800 bg-white min-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
                    <td ref={cashInRef} contentEditable suppressContentEditableWarning data-placeholder="0.00"
                      className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
                    <td ref={cashExpenseRef} contentEditable suppressContentEditableWarning data-placeholder="0.00"
                      className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
                    <td ref={cashDepositRef} contentEditable suppressContentEditableWarning data-placeholder="0.00"
                      className="px-3 py-2 border-t border-slate-300 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm" />
                    <td className="px-3 py-2 border-t border-slate-300 text-right">
                      <Button size="sm" onClick={handleAddEntry} className="text-sm h-8 px-3">Add</Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && sheet && sheet.entries.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              No entries found for this site.
            </p>
          )}
        </div>
      )}
    </div>
  )
}