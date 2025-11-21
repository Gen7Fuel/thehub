import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { DatePicker } from '@/components/custom/datePicker'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'
import type { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from 'react'

type Payable = {
  _id: string
  vendorName: string
  amount: number
  paymentMethod: string
  notes?: string
  createdAt: string
  location?: { stationName?: string; csoCode?: string }
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/payouts')({
  validateSearch: (search: Record<string, any>) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
      site: typeof search.site === 'string' ? search.site : '',
      date: typeof search.date === 'string' ? search.date : today,
    }
  },
  loaderDeps: ({ search }) => ({ site: search.site, date: search.date }),
  loader: async ({ deps }) => {
    const dateIso = deps.date || format(new Date(), 'yyyy-MM-dd')
    // fetch all payables for day
    const qs = new URLSearchParams({
      from: dateIso,
      to: dateIso,
    }).toString()
    const resp = await fetch(`/api/payables?${qs}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    const all: Payable[] = resp.ok ? await resp.json() : []
    // filter by site name (stationName) if provided
    const filtered = deps.site
      ? all.filter(p => p.location?.stationName === deps.site)
      : all
    // aggregate total
    const totalAmount = filtered.reduce((a, p) => a + (p.amount || 0), 0)
    return { date: dateIso, site: deps.site || '', payables: filtered, totalAmount }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { date, site, payables } = useLoaderData({ from: Route.id })
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id })

  const ymdToLocalDate = (ymd: string) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const dateObj = ymdToLocalDate(date)

  return (
    <div className="p-2 flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-2">
          <SitePicker
            value={site}
            onValueChange={(val) =>
              navigate({
                to: '/cash-rec/payouts',
                search: { ...search, site: val },
              })
            }
            className="min-w-[220px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <DatePicker
            date={dateObj}
            setDate={(val) => {
              const next = typeof val === 'function' ? val(dateObj) : val
              if (next) {
                navigate({
                  to: '/cash-rec/payouts',
                  search: { ...search, date: format(next, 'yyyy-MM-dd') },
                })
              }
            }}
          />
        </div>
        <div>
          <Button
            onClick={() =>
              navigate({
                to: '/cash-rec/payouts',
                search: {
                  site: site || '',
                  date: format(new Date(), 'yyyy-MM-dd'),
                },
              })
            }
            variant="outline"
            size="sm"
          >
            Reset to Today
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Vendor</th>
              <th className="text-left px-3 py-2">Payment</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Notes</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {payables.map((p: { _id: Key | null | undefined; vendorName: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; paymentMethod: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; amount: number; notes: string | undefined; createdAt: string | number | Date }) => (
              <tr key={p._id} className="border-t">
                <td className="px-3 py-2">{p.vendorName}</td>
                <td className="px-3 py-2">{p.paymentMethod}</td>
                <td className="px-3 py-2 text-right">${p.amount.toFixed(2)}</td>
                <td className="px-3 py-2 max-w-[220px] truncate" title={p.notes}>{p.notes || '—'}</td>
                <td className="px-3 py-2">{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!payables.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No payables for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RouteComponent