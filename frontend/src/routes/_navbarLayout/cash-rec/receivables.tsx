import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { Button } from '@/components/ui/button'
import type { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from 'react'

type PO = {
  _id: string
  stationName?: string
  date: string
  productCode?: string
  description?: string
  quantity: number
  amount: number
  fleetCardNumber?: string
  customerName?: string
  driverName?: string
  vehicleMakeModel?: string
  poNumber?: string
  receipt?: string
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/receivables')({
  validateSearch: (search: Record<string, any>) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
      site: typeof search.site === 'string' ? search.site : '',
      date: typeof search.date === 'string' ? search.date : today,
    }
  },
  loaderDeps: ({ search }) => ({ site: search.site, date: search.date }),
  loader: async ({ deps }) => {
    const day = deps.date
    const params: Record<string, string> = { startDate: day, endDate: day }
    if (deps.site) params.stationName = deps.site
    const qs = new URLSearchParams(params).toString()

    const resp = await fetch(`/api/purchase-orders?${qs}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    const rows: PO[] = resp.ok ? await resp.json() : []

    const totalAmount = rows.reduce((a, r) => a + (r.amount || 0), 0)
    const totalQuantity = rows.reduce((a, r) => a + (r.quantity || 0), 0)

    return { site: deps.site, date: day, rows, totalAmount, totalQuantity }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, date, rows, totalAmount, totalQuantity } = useLoaderData({ from: Route.id })
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id })

  const toLocalDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const dateObj = toLocalDate(date)

  return (
    <div className="p-2 flex flex-col gap-6 max-w-6xl">
      <div className="flex flex-wrap gap-4 items-end">
        <SitePicker
          value={site}
          onValueChange={(val) =>
            navigate({
              to: '/cash-rec/receivables',
              search: { ...search, site: val },
            })
          }
          className="min-w-[220px]"
        />
        <DatePicker
          date={dateObj}
          setDate={(val) => {
            const next = typeof val === 'function' ? val(dateObj) : val
            if (next) {
              navigate({
                to: '/cash-rec/receivables',
                search: { ...search, date: format(next, 'yyyy-MM-dd') },
              })
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate({
              to: '/cash-rec/receivables',
              search: { site: site || '', date: format(new Date(), 'yyyy-MM-dd') },
            })
          }
        >
          Reset to Today
        </Button>
      </div>

      <div className="border rounded-md p-4 bg-card grid gap-1 text-sm">
        <div>Site: <span className="font-medium">{site || '—'}</span></div>
        <div>Date: <span className="font-medium">{date}</span></div>
        <div>Total Quantity: <span className="font-medium">{totalQuantity}</span></div>
        <div>Total Amount: <span className="font-medium">${totalAmount.toFixed(2)}</span></div>
        <div className="text-xs text-muted-foreground">
          {rows.length} receivable{rows.length === 1 ? '' : 's'}.
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">PO #</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-left">Fleet Card</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: { _id: Key | null | undefined; poNumber: any; customerName: any; driverName: any; fleetCardNumber: any; description: any; productCode: any; quantity: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; amount: number; date: string | number | Date }) => (
              <tr key={r._id} className="border-t">
                <td className="px-3 py-2">{r.poNumber || '—'}</td>
                <td className="px-3 py-2">{r.customerName || '—'}</td>
                <td className="px-3 py-2">{r.driverName || '—'}</td>
                <td className="px-3 py-2">{r.fleetCardNumber || '—'}</td>
                <td className="px-3 py-2">{r.description || r.productCode || '—'}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2 text-right">${r.amount.toFixed(2)}</td>
                <td className="px-3 py-2">{new Date(r.date).toLocaleString()}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No receivables found.
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