import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'

type Search = { site: string; date: string }

type KardpollReport = {
  _id?: string
  site: string
  date: string
  litresSold: number
  sales: number
  ar: number
  // AR rows exist in backend but should not be displayed here
  ar_rows?: never
  createdAt?: string
  updatedAt?: string
}

type BankMiscDebit = {
  date: string
  description: string
  amount: number
}

type BankStatementResp = {
  _id?: string
  site: string
  // Backend returns bank date as next day; we will not display this column
  date: string
  balanceForward: number
  nightDeposit: number
  transferTo: number
  endingBalance: number
  miscDebits: BankMiscDebit[]
  createdAt?: string
  updatedAt?: string
}

type CashSummaryTotals = {
  shiftCount?: number
  canadian_cash_collected: number
  item_sales: number
  cash_back: number
  loyalty: number
  cpl_bulloch: number
  exempted_tax: number
  report_canadian_cash: number
  payouts: number
  fuelSales: number
  dealGroupCplDiscounts: number
  fuelPriceOverrides: number
  parsedItemSales: number
  depositTotal: number
  pennyRounding: number
  totalSales: number
  afdCredit: number
  afdDebit: number
  kioskCredit: number
  kioskDebit: number
  kioskGiftCard: number
  totalPos: number
  arIncurred: number
  grandTotal: number
  couponsAccepted: number
  canadianCash: number
  cashOnHand: number
  parsedCashBack: number
  parsedPayouts: number
  safedropsCount: number
  safedropsAmount: number
}

type CashSummaryAgg = {
  site: string
  date: string
  shiftCount: number
  totals: CashSummaryTotals
}

type EntriesResponse = {
  kardpoll: KardpollReport | null
  bank: BankStatementResp | null
  cashSummary: CashSummaryAgg
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
      return { site: deps.site || '', date: dateIso, data: null as EntriesResponse | null }
    }
    const resp = await fetch(
      `/api/cash-rec/entries?site=${encodeURIComponent(deps.site)}&date=${encodeURIComponent(dateIso)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    const data: EntriesResponse | null = resp.ok ? await resp.json() : null
    return { site: deps.site, date: dateIso, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, date, data } = useLoaderData({ from: Route.id }) as {
    site: string
    date: string
    data: EntriesResponse | null
  }
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id })

  const ymdToLocalDate = (ymd: string) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const dateObj = ymdToLocalDate(date)

  const fmt2 = (v: number | undefined | null) =>
    typeof v === 'number' && Number.isFinite(v)
      ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
  const fmt0 = (v: number | undefined | null) =>
    typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : ''

  const miscDebitsTotal = (data?.bank?.miscDebits || []).reduce((sum, x) => sum + (x?.amount || 0), 0)
  const displayDate = data?.kardpoll?.date || data?.cashSummary?.date || date

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
          <div className="overflow-x-auto border rounded">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-2 py-2 text-left">Site</th>
                  <th className="px-2 py-2 text-left">Date</th>
                  {/* Kardpoll group */}
                  <th className="px-2 py-2 text-left">Kardpoll: Litres Sold</th>
                  <th className="px-2 py-2 text-left">Kardpoll: Sales</th>
                  <th className="px-2 py-2 text-left">Kardpoll: AR</th>
                  {/* Bank group (no bank date shown) */}
                  <th className="px-2 py-2 text-left">Bank: Balance Forward</th>
                  <th className="px-2 py-2 text-left">Bank: Night Deposit</th>
                  <th className="px-2 py-2 text-left">Bank: Transfer To</th>
                  <th className="px-2 py-2 text-left">Bank: Ending Balance</th>
                  <th className="px-2 py-2 text-left">Bank: Misc Debits Total</th>
                  {/* Cash Summary group */}
                  <th className="px-2 py-2 text-left">Cash: Shift Count</th>
                  <th className="px-2 py-2 text-left">Cash: Canadian Cash Collected</th>
                  <th className="px-2 py-2 text-left">Cash: Item Sales</th>
                  <th className="px-2 py-2 text-left">Cash: Cash Back</th>
                  <th className="px-2 py-2 text-left">Cash: Loyalty</th>
                  <th className="px-2 py-2 text-left">Cash: CPL Bulloch</th>
                  <th className="px-2 py-2 text-left">Cash: Exempted Tax</th>
                  <th className="px-2 py-2 text-left">Cash: Report Canadian Cash</th>
                  <th className="px-2 py-2 text-left">Cash: Payouts</th>
                  <th className="px-2 py-2 text-left">Cash: Fuel Sales</th>
                  <th className="px-2 py-2 text-left">Cash: DealGroup CPL Discounts</th>
                  <th className="px-2 py-2 text-left">Cash: Fuel Price Overrides</th>
                  <th className="px-2 py-2 text-left">Cash: Parsed Item Sales</th>
                  <th className="px-2 py-2 text-left">Cash: Deposit Total</th>
                  <th className="px-2 py-2 text-left">Cash: Penny Rounding</th>
                  <th className="px-2 py-2 text-left">Cash: Total Sales</th>
                  <th className="px-2 py-2 text-left">Cash: AFD Credit</th>
                  <th className="px-2 py-2 text-left">Cash: AFD Debit</th>
                  <th className="px-2 py-2 text-left">Cash: Kiosk Credit</th>
                  <th className="px-2 py-2 text-left">Cash: Kiosk Debit</th>
                  <th className="px-2 py-2 text-left">Cash: Kiosk Gift Card</th>
                  <th className="px-2 py-2 text-left">Cash: Total POS</th>
                  <th className="px-2 py-2 text-left">Cash: AR Incurred</th>
                  <th className="px-2 py-2 text-left">Cash: Grand Total</th>
                  <th className="px-2 py-2 text-left">Cash: Coupons Accepted</th>
                  <th className="px-2 py-2 text-left">Cash: Canadian Cash</th>
                  <th className="px-2 py-2 text-left">Cash: Cash On Hand</th>
                  <th className="px-2 py-2 text-left">Cash: Parsed Cash Back</th>
                  <th className="px-2 py-2 text-left">Cash: Parsed Payouts</th>
                  <th className="px-2 py-2 text-left">Cash: Safedrops Count</th>
                  <th className="px-2 py-2 text-left">Cash: Safedrops Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-2 py-2">{site}</td>
                  <td className="px-2 py-2">{displayDate}</td>
                  {/* Kardpoll values */}
                  <td className="px-2 py-2">{fmt2(data.kardpoll?.litresSold)}</td>
                  <td className="px-2 py-2">{fmt2(data.kardpoll?.sales)}</td>
                  <td className="px-2 py-2">{fmt2(data.kardpoll?.ar)}</td>
                  {/* Bank values (no bank date) */}
                  <td className="px-2 py-2">{fmt2(data.bank?.balanceForward)}</td>
                  <td className="px-2 py-2">{fmt2(data.bank?.nightDeposit)}</td>
                  <td className="px-2 py-2">{fmt2(data.bank?.transferTo)}</td>
                  <td className="px-2 py-2">{fmt2(data.bank?.endingBalance)}</td>
                  <td className="px-2 py-2">{fmt2(miscDebitsTotal)}</td>
                  {/* Cash Summary totals */}
                  <td className="px-2 py-2">{fmt0(data.cashSummary?.shiftCount)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.canadian_cash_collected)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.item_sales)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.cash_back)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.loyalty)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.cpl_bulloch)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.exempted_tax)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.report_canadian_cash)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.payouts)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.fuelSales)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.dealGroupCplDiscounts)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.fuelPriceOverrides)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.parsedItemSales)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.depositTotal)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.pennyRounding)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.totalSales)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.afdCredit)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.afdDebit)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.kioskCredit)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.kioskDebit)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.kioskGiftCard)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.totalPos)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.arIncurred)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.grandTotal)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.couponsAccepted)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.canadianCash)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.cashOnHand)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.parsedCashBack)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.parsedPayouts)}</td>
                  <td className="px-2 py-2">{fmt0(data.cashSummary?.totals.safedropsCount)}</td>
                  <td className="px-2 py-2">{fmt2(data.cashSummary?.totals.safedropsAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}