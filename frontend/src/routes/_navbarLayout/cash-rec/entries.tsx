import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import '@/styles/tableGrid.css'
import type { DateRange } from 'react-day-picker'
import '@/styles/typewriter.css'

type Search = { site: string; from: string; to?: string; date?: string }

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
  // Optional fields present in backend for additional calculations
  gblDebits?: BankMiscDebit[]
  merchantFees?: number
  createdAt?: string
  updatedAt?: string
  unsettledPrepays?: number
  handheldDebit?: number
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
  afdGiftCard?: number
  kioskCredit: number
  kioskDebit: number
  kioskGiftCard: number
  totalPos: number
  arIncurred: number
  grandTotal: number
  missedCpl?: number
  couponsAccepted: number
  canadianCash: number
  cashOnHand: number
  parsedCashBack: number
  parsedPayouts: number
  safedropsCount: number
  safedropsAmount: number
  // Lotto fields
  onlineLottoTotal?: number
  instantLottTotal?: number
  lottoPayout?: number
}

type CashSummaryAgg = {
  site: string
  date: string
  shiftCount: number
  unsettledPrepays: number
  handheldDebit: number
  totals: CashSummaryTotals
}

type EntriesResponse = {
  kardpoll: KardpollReport | null
  bank: BankStatementResp | null
  cashSummary: CashSummaryAgg
  totalReceivablesAmount?: number
  bankStmtTrans?: number
  bankRec?: number
  balanceCheck?: number
}

type EntriesRow = { date: string; data: EntriesResponse | null }

export const Route = createFileRoute('/_navbarLayout/cash-rec/entries')({
  // Default date to today (yyyy-MM-dd), mirror payouts.tsx behavior
  validateSearch: (search: Record<string, any>) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    // Back-compat: if `date` is provided, treat it as both from/to
    const incomingDate = typeof search.date === 'string' ? search.date : undefined
    const from = typeof search.from === 'string' ? search.from : incomingDate || today
    const to = typeof search.to === 'string' ? search.to : incomingDate || from
    return {
      site: typeof search.site === 'string' ? search.site : '',
      from,
      to,
    } as Search
  },
  loaderDeps: ({ search }) => ({ site: search.site, from: search.from, to: search.to }),
  loader: async ({ deps }) => {
    const fromIso = deps.from || format(new Date(), 'yyyy-MM-dd')
    const toIso = deps.to || fromIso
    const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
    if (!deps.site || !isYmd(fromIso) || !isYmd(toIso)) {
      return { site: deps.site || '', from: fromIso, to: toIso, rows: [] as EntriesRow[] }
    }

    const parseYmd = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number)
      return new Date(y, (m || 1) - 1, d || 1)
    }
    const ymd = (d: Date) => format(d, 'yyyy-MM-dd')

    // Normalize order and generate inclusive date list
    let start = parseYmd(fromIso)
    let end = parseYmd(toIso)
    if (start > end) {
      const t = start
      start = end
      end = t
    }
    const dates: string[] = []
    const MAX_DAYS = 60
    for (let dt = new Date(start); dt <= end && dates.length < MAX_DAYS; dt.setDate(dt.getDate() + 1)) {
      dates.push(ymd(dt))
    }

    const token = localStorage.getItem('token') || ''
    const rows: EntriesRow[] = await Promise.all(
      dates.map(async (day) => {
        try {
          const resp = await fetch(
            `/api/cash-rec/entries?site=${encodeURIComponent(deps.site)}&date=${encodeURIComponent(day)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const data: EntriesResponse | null = resp.ok ? await resp.json() : null
          return { date: day, data }
        } catch {
          return { date: day, data: null }
        }
      })
    )

    return { site: deps.site, from: fromIso, to: toIso, rows }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, from, to, rows } = useLoaderData({ from: Route.id }) as {
    site: string
    from: string
    to?: string
    rows: EntriesRow[]
  }
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id }) as Search

  const ymdToLocalDate = (ymd: string) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const fromObj = ymdToLocalDate(from)
  const toObj = ymdToLocalDate(to || from)

  const fmt2 = (v: number | undefined | null) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v < 0) {
        return `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
      }
      return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '';
  }
  // const fmt0 = (v: number | undefined | null) =>
  //   typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : ''

  // Column visibility based on site
  const showLottery = site === 'Oliver' || site === 'Osoyoos'
  const showKardpoll = !(site === 'Sarnia' || site === 'Walpole')

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
        <DatePickerWithRange
          date={{ from: fromObj, to: toObj } as DateRange}
          setDate={(next: React.SetStateAction<DateRange | undefined>) => {
            const current = { from: fromObj, to: toObj } as DateRange | undefined
            const range = typeof next === 'function' ? next(current) : next
            if (!range?.from && !range?.to) return
            const fromYmd = range?.from ? format(range.from, 'yyyy-MM-dd') : from
            const toYmd = range?.to ? format(range.to, 'yyyy-MM-dd') : fromYmd
            navigate({
              to: '/cash-rec/entries',
              search: { ...search, from: fromYmd, to: toYmd },
            })
          }}
        />
      </div>

      {!site && <div className="text-xs text-muted-foreground">Pick a site to view entries.</div>}
      <div className="p-0 flex flex-col">
        <div className="w-full max-w-full overflow-x-auto overflow-y-auto overscroll-contain border h-[calc(72vh)]">
          <div className="block min-w-max h-full">
              <table className="table-grid typewriter-font text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-1 py-1 text-center align-bottom h-24">Date</th>
                {/* Kardpoll group */}
                {showKardpoll && (
                  <>
                    <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">Litres Sold</th>
                    <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">Sales</th>
                    <th className="px-1 py-1 text-center align-bottom h-24 bg-emerald-50">AR</th>
                  </>
                )}
                {/* Cash Summary group */}
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">DealGroup CPL Discounts</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Unsettled Prepays</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Item Sales</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Total Sales</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Fuel Sales</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">AFD GC</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Total POS</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Kiosk GC</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">AR Incurred</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Payouts</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Missed CPL</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Coupons</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">Cash Back</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-violet-50">CDN Cash</th>

                {/* Lottery before Handheld Debit (only for Oliver/Osoyoos) */}
                {showLottery && (
                  <>
                    <th className="px-1 py-1 text-center align-bottom h-24 bg-amber-50">Lottery Sales</th>
                    <th className="px-1 py-1 text-center align-bottom h-24 bg-amber-50">Lottery Payouts</th>
                  </>
                )}

                <th className="px-1 py-1 text-center align-bottom h-24 bg-amber-50">Handheld Debit</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-amber-50">Bank Slip</th>

                <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Daily Bank Stmt Balance</th>
                {/* <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Cash Deposited Date</th> */}
                <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Till</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Balance Check</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Bank Stmt Trans</th>
                <th className="px-1 py-1 text-center align-bottom h-24 bg-sky-50">Bank Rec</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ date, data }) => {
                const displayDate = data?.kardpoll?.date || data?.cashSummary?.date || date
                // const miscDebitsTotal = (data?.bank?.miscDebits || []).reduce((sum, x) => sum + (x?.amount || 0), 0)
                return (
                  <tr className="border-t odd:bg-gray-50 even:bg-white" key={date}>
                    <td className="px-2 py-2">{displayDate}</td>
                    {/* Kardpoll values */}
                    {showKardpoll && (
                      <>
                        <td className="px-2 py-2 text-right">{fmt2(data?.kardpoll?.litresSold)}</td>
                        <td className="px-2 py-2 text-right">{fmt2(data?.kardpoll?.sales)}</td>
                        <td className="px-2 py-2 text-right">{fmt2(data?.kardpoll?.ar)}</td>
                      </>
                    )}
                    {/* Cash Summary totals */}
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.dealGroupCplDiscounts)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.unsettledPrepays)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.item_sales)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.totalSales)}</td>
                    <td className="px-2 py-2 text-right">{fmt2((data?.cashSummary?.totals.totalSales ?? 0) - (data?.cashSummary?.totals.item_sales ?? 0))}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.afdGiftCard)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.totalPos)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.kioskGiftCard)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.arIncurred)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.payouts)}</td>
                    {/* <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.cpl_bulloch)}</td> */}
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.missedCpl)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.couponsAccepted)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.cash_back)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.report_canadian_cash)}</td>

                    {/* Lottery moved before Handheld Debit (only for Oliver/Osoyoos) */}
                    {showLottery && (
                      <>
                        <td className="px-2 py-2 text-right">
                          {fmt2(
                            (data?.cashSummary?.totals.onlineLottoTotal ?? 0) +
                            (data?.cashSummary?.totals.instantLottTotal ?? 0)
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.lottoPayout)}</td>
                      </>
                    )}

                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.handheldDebit)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.cashSummary?.totals.canadian_cash_collected)}</td>

                    <td className="px-2 py-2 text-right">{fmt2(data?.bank?.endingBalance)}</td>
                    {/* <td className="px-2 py-2"></td> */}
                    <td className="px-2 py-2">
                      {fmt2(
                        (data?.cashSummary?.totals.canadian_cash_collected ?? 0) -
                        (data?.cashSummary?.totals.report_canadian_cash ?? 0) +
                        (data?.cashSummary?.handheldDebit ?? 0) +
                        (data?.cashSummary?.unsettledPrepays ?? 0)
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.balanceCheck)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.bankStmtTrans)}</td>
                    <td className="px-2 py-2 text-right">{fmt2(data?.bankRec)}</td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}