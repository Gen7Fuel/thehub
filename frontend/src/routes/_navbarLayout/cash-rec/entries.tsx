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
    <div className="px-4 pb-0 space-y-4 w-full max-w-[100vw] overflow-x-hidden flex flex-col">
      <div className="flex w-full flex-col sm:flex-row items-center justify-center gap-4 rounded">
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
        <div className="p-0 flex flex-col">
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto overscroll-contain border h-[calc(72vh)]">
            <div className="block min-w-max h-full">
              <table className="text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-1 py-1 text-center align-bottom h-24">Date</th>
                  {/* Kardpoll group */}
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">Litres Sold</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">Sales</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">AR</th>
                  {/* Bank group (no bank date shown) */}
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Balance Forward</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Night Deposit</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Transfer To</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Ending Balance</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Misc Debits Total</th>
                  {/* Cash Summary group */}
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Shift Count</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Canadian Cash Collected</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Item Sales</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Cash Back</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Loyalty</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">CPL Bulloch</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Exempted Tax</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Report Canadian Cash</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Payouts</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Fuel Sales</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">DealGroup CPL Discounts</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Fuel Price Overrides</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Parsed Item Sales</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Deposit Total</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Penny Rounding</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Total Sales</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">AFD Credit</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">AFD Debit</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Kiosk Credit</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Kiosk Debit</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Kiosk Gift Card</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Total POS</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">AR Incurred</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Grand Total</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Coupons Accepted</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Canadian Cash</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Cash On Hand</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Parsed Cash Back</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Parsed Payouts</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Safedrops Count</th>
                  <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Safedrops Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
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
        </div>
      )}
    </div>
  )
}