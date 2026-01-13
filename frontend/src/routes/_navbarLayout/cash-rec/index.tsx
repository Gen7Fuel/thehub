import * as React from 'react'
import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'

type Search = { site: string; date: string }

// Mirror the shape used by /api/cash-rec/entries
type KardpollReport = {
  _id?: string
  site: string
  date: string
  litresSold: number
  sales: number
  ar: number
  createdAt?: string
  updatedAt?: string
}

type BankMiscDebit = { date: string; description: string; amount: number }

type BankStatementResp = {
  _id?: string
  site: string
  date: string
  balanceForward: number
  nightDeposit: number
  transferTo: number
  endingBalance: number
  miscDebits: BankMiscDebit[]
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
  cashSummary: CashSummaryAgg | null
  totalReceivablesAmount?: number
  bankStmtTrans?: number
  bankRec?: number
  balanceCheck?: number
}

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const parseYmd = (s?: string) => {
  if (!s || !isYmd(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const Route = createFileRoute('/_navbarLayout/cash-rec/')({
  validateSearch: (search: Record<string, any>) => {
    const today = ymd(new Date())
    return {
      site: typeof search.site === 'string' ? search.site : '',
      date: typeof search.date === 'string' ? search.date : today,
    } as Search
  },
  loaderDeps: ({ search }) => ({ site: search.site, date: search.date }),
  loader: async ({ deps }) => {
    const site = String((deps as any).site || '')
    const date = String((deps as any).date || ymd(new Date()))
    if (!site || !isYmd(date)) {
      return { site, date, data: null as EntriesResponse | null }
    }
    const res = await fetch(
      `/api/cash-rec/entries?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }
    )
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as EntriesResponse
    return { site, date, data }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, date, data } = useLoaderData({ from: Route.id }) as {
    site: string
    date: string
    data: EntriesResponse | null
  }
  const navigate = useNavigate({ from: Route.fullPath })
  const search = useSearch({ from: Route.id }) as Search

  const dateObj = React.useMemo(() => parseYmd(date), [date])
  const setDate: React.Dispatch<React.SetStateAction<Date | undefined>> = (next) => {
    const current = dateObj
    const d = typeof next === 'function' ? (next as any)(current) : next
    if (!d) return
    navigate({ search: (prev: any) => ({ ...prev, date: ymd(d) }) })
  }

  return (
    <div className="px-4 space-y-4 w-full max-w-[100vw] overflow-x-hidden flex flex-col">
      <div className="flex w-full flex-col sm:flex-row items-center justify-center gap-4 rounded">
        <SitePicker
          value={site}
          onValueChange={(val) =>
            navigate({
              search: { ...search, site: val },
            })
          }
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePicker date={dateObj} setDate={setDate} />
      </div>

      {!site && <div className="text-xs text-muted-foreground">Pick a site to view report.</div>}

      {site && data && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Report for {site} on {date}</div>

          {(() => {
            const totals = data.cashSummary?.totals || ({} as any)
            const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
            const fmt2 = (v: number) =>
              Number.isFinite(v)
                ? (v < 0
                    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                : ''

            const totalSales = num(totals.totalSales)
            const itemSales = num(totals.item_sales)
            const reportedCanadianCash = num(totals.report_canadian_cash)
            const missedCpl = num(totals.missedCpl)
            const kardpollSales = num(data.kardpoll?.sales)
            const hhDebit = num(data.cashSummary?.handheldDebit)
            const unsettledPrepays = num(data.cashSummary?.unsettledPrepays)
            const canadianCashCollected = num(totals.canadian_cash_collected)
            const afdGiftCard = num(totals.afdGiftCard)
            const kioskGiftCard = num(totals.kioskGiftCard)
            const loyaltyCoupons = num(totals.couponsAccepted)

            const gblMonerisFuelSales = totalSales - itemSales - reportedCanadianCash - missedCpl
            const storeSales = itemSales
            const canadianCash = reportedCanadianCash
            const lotterySales = 0
            const lotteryPayouts = 0
            const totalDollarSales = gblMonerisFuelSales + canadianCash + kardpollSales + storeSales + lotterySales + lotteryPayouts

            const cashSafeDeposited = canadianCashCollected
            const tillOverShort = canadianCashCollected - reportedCanadianCash + hhDebit + unsettledPrepays
            const gcRedemption = afdGiftCard + kioskGiftCard
            const loyalty = loyaltyCoupons
            const bankRec = data.bankRec || 0
            const balanceCheck = data.balanceCheck ?? 0

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b">Sales Summary</div>
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="px-3 py-2">GBL/Moneris Fuel Sales (40010)</td>
                        <td className="px-3 py-2 text-right">${fmt2(gblMonerisFuelSales)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Canadian Cash (40010)</td>
                        <td className="px-3 py-2 text-right">${fmt2(canadianCash)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Kardpoll Sales (40010)</td>
                        <td className="px-3 py-2 text-right">${fmt2(kardpollSales)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Store Sales (40200)</td>
                        <td className="px-3 py-2 text-right">${fmt2(storeSales)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Lottery Sales (20440)</td>
                        <td className="px-3 py-2 text-right">${fmt2(lotterySales)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Lottery Payouts (20440)</td>
                        <td className="px-3 py-2 text-right">${fmt2(lotteryPayouts)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2 font-medium">Total Dollar Sales</td>
                        <td className="px-3 py-2 text-right font-medium">${fmt2(totalDollarSales)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">HH Debit</td>
                        <td className="px-3 py-2 text-right">${fmt2(hhDebit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b">Deduction Summary</div>
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="px-3 py-2">Cash Safe Deposited (10011)</td>
                        <td className="px-3 py-2 text-right">${fmt2(cashSafeDeposited)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Till Over/Short (55501)</td>
                        <td className="px-3 py-2 text-right">${fmt2(tillOverShort)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">GiftCard Redemption (2250)</td>
                        <td className="px-3 py-2 text-right">${fmt2(gcRedemption)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Loyalty (52175)</td>
                        <td className="px-3 py-2 text-right">${fmt2(loyalty)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Unsettled Prepays (40010)</td>
                        <td className="px-3 py-2 text-right">${fmt2(unsettledPrepays)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Bank Rec (45500)</td>
                        <td className="px-3 py-2 text-right">${fmt2(bankRec)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">Balance Check</td>
                        <td className="px-3 py-2 text-right">${fmt2(balanceCheck)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
