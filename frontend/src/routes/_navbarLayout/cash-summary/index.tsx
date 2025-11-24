import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SitePicker } from '@/components/custom/sitePicker'

type CashSummarySearch = { site: string; id?: string }

interface CashSummaryDoc {
  _id: string
  site?: string
  shift_number: string
  date: string
  canadian_cash_collected?: number
  item_sales?: number
  cash_back?: number
  loyalty?: number
  cpl_bulloch?: number
  exempted_tax?: number
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CashSummarySearch => ({
    site: (search.site as string) || '',
    id: typeof search.id === 'string' ? search.id : undefined,
  }),
  loaderDeps: ({ search: { id } }) => ({ id }),
  loader: async ({ deps: { id } }) => {
    if (!id) return { existing: null as CashSummaryDoc | null }
    const res = await fetch(`/api/cash-summary/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    if (!res.ok) return { existing: null }
    return { existing: (await res.json()) as CashSummaryDoc }
  },
})

function RouteComponent() {
  const { site, id } = Route.useSearch()
  const { existing } = Route.useLoaderData() as { existing: CashSummaryDoc | null }
  const navigate = useNavigate({ from: Route.fullPath })

  const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const [shiftNumber, setShiftNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [canadianCashCollected, setCanadianCashCollected] = useState('')
  const [itemSales, setItemSales] = useState('')
  const [cashBack, setCashBack] = useState('')
  const [loyalty, setLoyalty] = useState('')
  const [cplBulloch, setCplBulloch] = useState('')
  const [exemptedTax, setExemptedTax] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Populate form when existing record loads
  useEffect(() => {
    if (existing) {
      setShiftNumber(existing.shift_number)
      setDate(existing.date.slice(0, 10))
      setCanadianCashCollected(toStr(existing.canadian_cash_collected))
      setItemSales(toStr(existing.item_sales))
      setCashBack(toStr(existing.cash_back))
      setLoyalty(toStr(existing.loyalty))
      setCplBulloch(toStr(existing.cpl_bulloch))
      setExemptedTax(toStr(existing.exempted_tax))
      setSuccess(null)
      setError(null)
    }
  }, [existing])

  const updateSite = (newSite: string) =>
    navigate({ search: (prev: CashSummarySearch) => ({ ...prev, site: newSite }) })

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/,/g, '')))
  const toStr = (v: number | undefined) => (v == null ? '' : String(v))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!shiftNumber.trim()) {
      setError('Shift number required')
      setSubmitting(false)
      return
    }
    if (!date) {
      setError('Date required')
      setSubmitting(false)
      return
    }

    const toLocalMidnightISO = (dateStr: string) => {
      const [yy, mm, dd] = dateStr.split('-').map(Number)
      return new Date(yy, mm - 1, dd, 0, 0, 0, 0).toISOString()
    }

    const payload = {
      site: site || undefined,
      shift_number: shiftNumber.trim(),
      date: toLocalMidnightISO(date),
      canadian_cash_collected: num(canadianCashCollected),
      item_sales: num(itemSales),
      cash_back: num(cashBack),
      loyalty: num(loyalty),
      cpl_bulloch: num(cplBulloch),
      exempted_tax: num(exemptedTax),
    }

    try {
      const res = await fetch(id ? `/api/cash-summary/${id}` : '/api/cash-summary', {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())

      await res.json()

      if (!id) {
        navigate({ to: '/cash-summary/list', search: { site } })
        return
      }

      setSuccess('Updated')
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNew = () => {
    navigate({ search: { site, id: undefined } })
    setShiftNumber('')
    setDate(todayISO())
    setCanadianCashCollected('')
    setItemSales('')
    setCashBack('')
    setLoyalty('')
    setCplBulloch('')
    setExemptedTax('')
    setSuccess(null)
    setError(null)
  }

  return (
    <div className="pt-16 flex flex-col items-center w-full">
      <div className="w-full max-w-2xl space-y-6 p-4">
        <SitePicker
          value={site}
          onValueChange={updateSite}
          placeholder="Pick a site"
          label="Site"
          className="w-[220px]"
        />

        <form onSubmit={handleSubmit} className="space-y-5 border rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">
              {id ? `Edit Cash Summary (${shiftNumber || id})` : 'New Cash Summary'}
            </h2>
            {id && (
              <button
                type="button"
                onClick={handleNew}
                className="text-xs px-2 py-1 border rounded hover:bg-muted"
              >
                New
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shift Number *">
              <input
                value={shiftNumber}
                onChange={(e) => setShiftNumber(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </Field>
            <Field label="Date *">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </Field>
            <Field label="Canadian Cash Collected">
              <input
                value={canadianCashCollected}
                onChange={(e) => setCanadianCashCollected(e.target.value)}
                className="w-full border rounded px-3 py-2"
                inputMode="decimal"
              />
            </Field>
            
            <Field label="Infonet Exempted Tax">
              <input
                value={exemptedTax}
                onChange={(e) => setExemptedTax(e.target.value)}
                className="w-full border rounded px-3 py-2"
                inputMode="decimal"
              />
            </Field>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              {submitting ? (id ? 'Updating…' : 'Saving…') : id ? 'Update' : 'Save'}
            </button>
            {error && <span className="text-red-600 text-sm">Error: {error}</span>}
            {success && <span className="text-green-600 text-sm">{success}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  )
}