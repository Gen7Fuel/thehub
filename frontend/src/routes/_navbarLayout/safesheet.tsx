import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

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

function RouteComponent() {
  const { site } = Route.useSearch() as { site?: string }
  const navigate = useNavigate({ from: Route.fullPath })

  const updateSearch = (site: string) => {
    navigate({ search: { site } })
  }

  const [sheet, setSheet] = useState<SafeSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // which column we're adding to when Add Entry is clicked
  // const [entryType, setEntryType] = useState<'cashIn' | 'cashExpenseOut' | 'cashDepositBank'>('cashIn')

  // selection of dashed cells (only active when shouldHighlight returns true)
  // const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  // refs for inline editable last-row TDs (use HTMLTableCellElement since cells are contentEditable)
  const descRef = useRef<HTMLTableCellElement | null>(null)
  const cashInRef = useRef<HTMLTableCellElement | null>(null)
  const cashExpenseRef = useRef<HTMLTableCellElement | null>(null)
  const cashDepositRef = useRef<HTMLTableCellElement | null>(null)

  // Decide when a cell in the table should show dashed outline (and be selectable)
  // const shouldHighlight = (v?: number | null) =>
  //   entryType === 'cashDepositBank' && v !== undefined && v !== null && v !== 0

  // // Clear selections when entryType changes; also clear inline fields
  // useEffect(() => {
  //   setSelectedCells(new Set())
  //   // clear inline numeric fields when switching type
  //   if (cashInRef.current) cashInRef.current.innerText = ''
  //   if (cashExpenseRef.current) cashExpenseRef.current.innerText = ''
  //   if (cashDepositRef.current) cashDepositRef.current.innerText = ''
  // }, [entryType])

  // When selectedCells change, compute sum and populate the inline editable cell for the current entryType
  // useEffect(() => {
  //   if (!sheet) return
  //   let sum = 0
  //   for (const key of Array.from(selectedCells)) {
  //     const [entryId, field] = key.split(':')
  //     const entry = sheet.entries.find(e => e._id === entryId)
  //     if (!entry) continue
  //     const val = (field === 'cashOnHandSafe') ? (entry.cashOnHandSafe ?? 0) : (entry as any)[field] ?? 0
  //     sum += Number(val || 0)
  //   }

  //   const display = sum === 0 ? '' : String(sum)

  //   if (entryType === 'cashIn') {
  //     if (cashInRef.current) cashInRef.current.innerText = display
  //   } else if (entryType === 'cashExpenseOut') {
  //     if (cashExpenseRef.current) cashExpenseRef.current.innerText = display
  //   } else if (entryType === 'cashDepositBank') {
  //     if (cashDepositRef.current) cashDepositRef.current.innerText = display
  //   }
  // }, [selectedCells, sheet, entryType])

  // fetch safesheet for selected site
  useEffect(() => {
    if (!site) {
      setSheet(null)
      setError(null)
      return
    }

    let mounted = true
    const fetchSheet = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('fetch safesheet start', site);

        const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "safesheet",
          },
        });

        console.log('fetch safesheet response', res);

        if (res.status === 403) {
          // Redirect to no-access page (SPA-style)
          navigate({ to: "/no-access" });
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to fetch safesheet for ${site}`);
        }

        const data: SafeSheet = await res.json();
        console.log('fetch safesheet body', data);

        if (mounted) setSheet(data);

      } catch (err: any) {
        console.error('fetchSheet error', err);
        if (mounted) setError(err.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSheet()
    return () => { mounted = false }
  }, [site])

  // Toggle selection for a table cell (only if shouldHighlight allows)
  // const toggleCell = (entryId: string, field: string, value?: number | null) => {
  //   if (!shouldHighlight(value)) return
  //   const key = `${entryId}:${field}`
  //   setSelectedCells(prev => {
  //     const next = new Set(prev)
  //     if (next.has(key)) next.delete(key)
  //     else next.add(key)
  //     return next
  //   })
  // }

  // const isCellSelected = (entryId: string, field: string) => selectedCells.has(`${entryId}:${field}`)

  // read numeric from a contentEditable TD
  const readEditableNumber = (el?: HTMLTableCellElement | null) => {
    if (!el) return 0
    const txt = el.innerText.replace(/,/g, '').trim()
    if (txt === '') return 0
    const n = Number(txt)
    return isNaN(n) ? 0 : n
  }

  // Add entry: read inline editable cells (or use selection-sum which was already written into inline cell)
  const handleAddEntry = async () => {
    if (!site) {
      console.warn('No site selected')
      return
    }

    const desc = descRef.current?.innerText?.trim() || ''
    const inlineCashIn = readEditableNumber(cashInRef.current)
    const inlineExpense = readEditableNumber(cashExpenseRef.current)
    const inlineDeposit = readEditableNumber(cashDepositRef.current)

    // Build entry body
    const entryBody: Record<string, any> = {
      date: new Date().toISOString(),
      description: desc,
      cashIn: 0,
      cashExpenseOut: 0,
      cashDepositBank: 0,
    }

    // Use inline values for all three fields (user may have populated multiple)
    entryBody.cashIn = inlineCashIn
    entryBody.cashExpenseOut = inlineExpense
    entryBody.cashDepositBank = inlineDeposit

    // if everything zero, reject
    if (!entryBody.cashIn && !entryBody.cashExpenseOut && !entryBody.cashDepositBank) {
      setError('Please enter an amount in one of the fields')
      return
    }

    console.log('posting entry (inline row)', { site, entryBody })

    try {
      const res = await fetch(`/api/safesheets/site/${encodeURIComponent(site)}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "safesheet",
        },
        body: JSON.stringify(entryBody)
      })
      console.log('post entry response', res)
      // ✅ Handle 403 before doing anything else
      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }
      const body = await res.json().catch(() => null)
      console.log('post entry body', body)
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to add entry')
      }

      if (body?.entries) {
        setSheet(prev => prev ? { ...prev, entries: body.entries } : prev)
      }

      // clear inline row and selection
      if (descRef.current) descRef.current.innerText = ''
      if (cashInRef.current) cashInRef.current.innerText = ''
      if (cashExpenseRef.current) cashExpenseRef.current.innerText = ''
      if (cashDepositRef.current) cashDepositRef.current.innerText = ''
      // setSelectedCells(new Set())
      setError(null)
    } catch (err: any) {
      console.error('addEntry error', err)
      setError(err.message || 'Add entry failed')
    }
  }

  const formattedEntries = useMemo(() => {
    if (!sheet) return []
    const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const fmtOrBlank = (v?: number | null) => {
      if (v === null || v === undefined) return ''
      if (v === 0) return '' // show blank instead of 0
      return fmt.format(v)
    }

    return sheet.entries.map(e => ({
      ...e,
      dateDisplay: new Date(e.date).toLocaleDateString(),
      cashInDisplay: fmtOrBlank(e.cashIn),
      cashExpenseOutDisplay: fmtOrBlank(e.cashExpenseOut),
      cashDepositBankDisplay: fmtOrBlank(e.cashDepositBank),
      cashOnHandSafeDisplay: fmtOrBlank(e.cashOnHandSafe ?? null)
    }))
  }, [sheet])

  return (
    <div className="pt-14">
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
        <p className="text-sm text-muted-foreground">Please select a site to view the safesheet.</p>
      )}

      {site && (
        <div>
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && sheet && (
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left text-sm">Date</th>
                    <th className="px-3 py-2 text-left text-sm">Description</th>
                    <th className="px-3 py-2 text-right text-sm">Cash In</th>
                    <th className="px-3 py-2 text-right text-sm">Cash Expense Out</th>
                    <th className="px-3 py-2 text-right text-sm">Cash Deposit Bank</th>
                    <th className="px-3 py-2 text-right text-sm">Cash On Hand (Safe)</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedEntries.map((e) => (
                    <tr key={e._id} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2 text-sm">{e.dateDisplay}</td>

                      <td className="px-3 py-2 text-sm">
                        {e.description}
                      </td>

                      {/* Cash In cell */}
                      <td className="px-3 py-2 text-sm text-right">
                        <div
                          role="button"
                          // onClick={() => toggleCell(e._id, 'cashIn', e.cashIn)}
                          className='border-2 border-transparent px-1 py-0.5 rounded inline-block'
                        >
                          {e.cashInDisplay}
                        </div>
                      </td>

                      {/* Cash Expense Out cell */}
                      <td className="px-3 py-2 text-sm text-right">
                        <div
                          role="button"
                          // onClick={() => toggleCell(e._id, 'cashExpenseOut', e.cashExpenseOut)}
                          className='border-2 border-transparent px-1 py-0.5 rounded inline-block'
                        >
                          {e.cashExpenseOutDisplay}
                        </div>
                      </td>

                      {/* Cash Deposit Bank cell */}
                      <td className="px-3 py-2 text-sm text-right">
                        <div
                          role="button"
                          // onClick={() => toggleCell(e._id, 'cashDepositBank', e.cashDepositBank)}
                          className='border-2 border-transparent px-1 py-0.5 rounded inline-block'
                        >
                          {e.cashDepositBankDisplay}
                        </div>
                      </td>

                      {/* Cash On Hand (Safe) cell */}
                      <td className="px-3 py-2 text-sm text-right font-medium">
                        <div className='border-2 border-transparent px-1 py-0.5 rounded inline-block'>
                          {e.cashOnHandSafeDisplay}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Inline input row - today's date (greyed), contentEditable TDs, Add button */}
                  <tr className="bg-white">
                    <td className="px-3 py-2 text-sm text-gray-400 border-r border-slate-500 rounded-l-md">
                      {new Date().toLocaleDateString()}
                    </td>

                    <td
                      className="px-3 py-2 text-sm border border-slate-500"
                      contentEditable={true}
                      ref={descRef}
                      suppressContentEditableWarning
                    />

                    <td
                      className="px-3 py-2 text-sm text-right border border-slate-500"
                      contentEditable={true}
                      ref={cashInRef}
                      suppressContentEditableWarning
                      aria-label="cash-in-input"
                    />

                    <td
                      className="px-3 py-2 text-sm text-right border border-slate-500"
                      contentEditable={true}
                      ref={cashExpenseRef}
                      suppressContentEditableWarning
                      aria-label="cash-expense-input"
                    />

                    <td
                      className="px-3 py-2 text-sm text-right border border-slate-500"
                      contentEditable={true}
                      ref={cashDepositRef}
                      suppressContentEditableWarning
                      aria-label="cash-deposit-input"
                    />

                    <td className="px-3 py-2 text-sm text-right rounded-r-md">
                      <div className="flex items-center gap-2 justify-end">
                        <Button onClick={handleAddEntry}>Add Entry</Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && sheet && sheet.entries.length === 0 && (
            <p className="text-sm text-muted-foreground mt-4">No entries found for this site.</p>
          )}
        </div>
      )}
    </div>
  )
}