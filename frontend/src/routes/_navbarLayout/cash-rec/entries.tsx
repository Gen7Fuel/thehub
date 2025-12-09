import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'

type Search = { site: string; date: string }
type KardpollResponse = {
  _id: string
  site: string
  date: string
  litresSold: number
  sales: number
  ar: number
  ar_rows: { customer: string; card: string; amount: number; quantity: number; price_per_litre: number }[]
  createdAt?: string
  updatedAt?: string
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/entries')({
  // Default date to today (yyyy-MM-dd), mirror payouts.tsx behavior
  validateSearch: (search: Record<string, any>) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
      site: typeof search.site === 'string' ? search.site : '',
      date: typeof search.date === 'string' ? search.date : today,
    } as Search
  },
  loaderDeps: ({ search }) => ({ site: search.site, date: search.date }),
  loader: async ({ deps }) => {
    const dateIso = deps.date || format(new Date(), 'yyyy-MM-dd')
    if (!deps.site || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return { site: deps.site || '', date: dateIso, data: null }
    }
    const resp = await fetch(
      `/api/cash-rec/entries?site=${encodeURIComponent(deps.site)}&date=${encodeURIComponent(dateIso)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    const data: KardpollResponse | null = resp.ok ? await resp.json() : null
    return { site: deps.site, date: dateIso, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, date, data } = useLoaderData({ from: Route.id }) as {
    site: string
    date: string
    data: KardpollResponse | null
  }
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id })

  const ymdToLocalDate = (ymd: string) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const dateObj = ymdToLocalDate(date)

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(val) =>
            navigate({
              to: '/cash-rec/entries',
              search: { ...search, site: val },
            })
          }
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePicker
          date={dateObj}
          setDate={(val) => {
            const next = typeof val === 'function' ? val(dateObj) : val
            if (next) {
              navigate({
                to: '/cash-rec/entries',
                search: { ...search, date: format(next, 'yyyy-MM-dd') },
              })
            }
          }}
        />
      </div>

      {!site && <div className="text-xs text-muted-foreground">Pick a site to view entries.</div>}

      {data === null ? (
        <div className="text-sm text-muted-foreground">No data for this selection.</div>
      ) : (
        <div className="space-y-3">
          <div className="border rounded p-3">
            <div className="font-semibold">Summary</div>
            <div className="text-sm">Site: {data.site}</div>
            <div className="text-sm">Date: {data.date}</div>
            <div className="text-sm">Litres Sold: {data.litresSold}</div>
            <div className="text-sm">Sales: {data.sales}</div>
            <div className="text-sm">AR: {data.ar}</div>
          </div>

          <div className="border rounded p-3">
            <div className="font-semibold mb-2">AR Rows</div>
            {data.ar_rows?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="px-2 py-1">Customer</th>
                      <th className="px-2 py-1">Card</th>
                      <th className="px-2 py-1">Amount</th>
                      <th className="px-2 py-1">Quantity</th>
                      <th className="px-2 py-1">Price/Litre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ar_rows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.customer}</td>
                        <td className="px-2 py-1">{r.card}</td>
                        <td className="px-2 py-1">{r.amount}</td>
                        <td className="px-2 py-1">{r.quantity}</td>
                        <td className="px-2 py-1">{r.price_per_litre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No AR rows</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}