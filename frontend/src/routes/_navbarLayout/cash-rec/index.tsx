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
  receivablesRows?: Array<{ amount?: number; quantity?: number; [key: string]: any }>
  totalPayablesAmount?: number
  payablesRows?: Array<{ amount?: number; paymentMethod?: string; vendorName?: string; createdAt?: string; location?: { stationName?: string } ; [key: string]: any }>
  kardpollEntriesRows?: Array<{ customer?: string; card?: string; amount?: number; quantity?: number; price_per_litre?: number; [key: string]: any }>
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

    // Also fetch receivables for the same site/date like receivables.tsx
    let receivablesRows: Array<{ amount?: number; quantity?: number }> | undefined
    let totalReceivablesAmount: number | undefined
    try {
      const params: Record<string, string> = { startDate: date, endDate: date }
      if (site) params.stationName = site
      const qs = new URLSearchParams(params).toString()
      const rcv = await fetch(`/api/purchase-orders?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      if (rcv.ok) {
        const rows: Array<{ amount?: number; quantity?: number }> = await rcv.json()
        receivablesRows = rows
        totalReceivablesAmount = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
      }
    } catch (_) {
      // Ignore receivables fetch errors; still return base data
    }

    // Also fetch payables (payouts) for the same date, filter by site
    let payablesRows: Array<{ amount?: number; paymentMethod?: string; vendorName?: string; createdAt?: string; location?: { stationName?: string } }> | undefined
    let totalPayablesAmount: number | undefined
    try {
      const qs = new URLSearchParams({ from: date, to: date }).toString()
      const resp = await fetch(`/api/payables?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      if (resp.ok) {
        const all: Array<{ amount?: number; location?: { stationName?: string } }> = await resp.json()
        const filtered = site ? all.filter(p => p.location?.stationName === site) : all
        payablesRows = filtered
        totalPayablesAmount = filtered.reduce((a, p) => a + (Number(p.amount) || 0), 0)
      }
    } catch (_) {
      // Ignore payables fetch errors
    }

    // Fetch Kardpoll entries (ar_rows) for site+date
    let kardpollEntriesRows: Array<{ customer?: string; card?: string; amount?: number; quantity?: number; price_per_litre?: number }> | undefined
    try {
      const resp = await fetch(`/api/cash-rec/kardpoll-entries?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      if (resp.ok) {
        const doc = await resp.json()
        const rows = Array.isArray(doc?.ar_rows) ? doc.ar_rows : []
        kardpollEntriesRows = rows
      }
    } catch (_) {
      // Ignore kardpoll fetch errors
    }

    return {
      site,
      date,
      data: {
        ...data,
        ...(totalReceivablesAmount != null ? { totalReceivablesAmount } : {}),
        ...(receivablesRows ? { receivablesRows } : {}),
        ...(totalPayablesAmount != null ? { totalPayablesAmount } : {}),
        ...(payablesRows ? { payablesRows } : {}),
        ...(kardpollEntriesRows ? { kardpollEntriesRows } : {}),
      },
    }
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

          {(() => {
            const arFromKardpoll = Array.isArray(data.kardpollEntriesRows)
              ? data.kardpollEntriesRows.map((r) => ({
                  source: 'Kardpoll',
                  customer: (r.customer as string) || (r.customerName as string) || '-',
                  poNumber: (r.card as string) || '-',
                  amount: Number(r.amount) || 0,
                }))
              : []
            const arFromPO = Array.isArray(data.receivablesRows)
              ? data.receivablesRows.map((r: any) => ({
                  source: 'Purchase Order',
                  customer: (r.customerName as string) || '-',
                  poNumber: (r.poNumber as string) || '-',
                  amount: Number(r.amount) || 0,
                }))
              : []
            const arRows = [...arFromKardpoll, ...arFromPO]
            const arTotal = arRows.reduce((a, r) => a + (Number(r.amount) || 0), 0)

            const payRows = Array.isArray(data.payablesRows)
              ? data.payablesRows.map((p: any) => ({
                  vendor: (p.vendorName as string) || (p.vendor as string) || '-',
                  type: (p.paymentMethod as string) || (p.transactionType as string) || '-',
                  amount: Number(p.amount) || 0,
                  notes: (p.notes as string) || (p.description as string) || '',
                }))
              : []
            const payTotal = payRows.reduce((a, r) => a + (Number(r.amount) || 0), 0)

            const fmt2 = (v: number) =>
              Number.isFinite(v)
                ? (v < 0
                    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                : ''

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b">AR Transactions</div>
                  {arRows.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">No AR transactions found.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">PO Number</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arRows.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="px-3 py-2">{row.customer || '-'}</td>
                            <td className="px-3 py-2">{row.poNumber || '-'}</td>
                            <td className="px-3 py-2 text-right">${fmt2(row.amount)}</td>
                          </tr>
                        ))}
                        <tr className="border-t">
                          <td className="px-3 py-2 font-medium" colSpan={2}>Total</td>
                          <td className="px-3 py-2 text-right font-medium">${fmt2(arTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b">Payables</div>
                  {payRows.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">No payables found.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left">Vendor</th>
                          <th className="px-3 py-2 text-left">Transaction Type</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payRows.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="px-3 py-2">{row.vendor || '-'}</td>
                            <td className="px-3 py-2">{row.type || '-'}</td>
                            <td className="px-3 py-2 text-right">${fmt2(row.amount)}</td>
                            <td className="px-3 py-2">{row.notes || ''}</td>
                          </tr>
                        ))}
                        <tr className="border-t">
                          <td className="px-3 py-2 font-medium" colSpan={2}>Total</td>
                          <td className="px-3 py-2 text-right font-medium">${fmt2(payTotal)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          })()}

          {(() => {
            const bank = data.bank
            const fmt2 = (v: number) =>
              Number.isFinite(v)
                ? (v < 0
                    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                : ''

            if (!bank) {
              return (
                <div className="border rounded">
                  <div className="px-3 py-2 font-semibold border-b">Bank Statement Details</div>
                  <div className="px-3 py-3 text-sm text-muted-foreground">No bank statement found.</div>
                </div>
              )
            }

            const openingBalance = Number(bank.balanceForward) || 0
            const miscDebits = Array.isArray(bank.miscDebits) ? bank.miscDebits : []
            const miscCredits = Array.isArray((bank as any).miscCredits) ? (bank as any).miscCredits : []

            return (
              <div className="border rounded">
                <div className="px-3 py-2 font-semibold border-b">Bank Statement Details</div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2 font-medium">Opening Balance</td>
                      <td className="px-3 py-2 text-right">${fmt2(openingBalance)}</td>
                    </tr>

                    <tr className="border-t">
                      <td className="px-3 py-2" colSpan={3}><span className="font-medium">Misc Debits</span></td>
                    </tr>
                    {miscDebits.length === 0 ? (
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground" colSpan={3}>None</td>
                      </tr>
                    ) : (
                      miscDebits.map((d, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2">{d.date || '-'}</td>
                          <td className="px-3 py-2">{d.description || '-'}</td>
                          <td className="px-3 py-2 text-right">${fmt2(Number(d.amount) || 0)}</td>
                        </tr>
                      ))
                    )}

                    <tr className="border-t">
                      <td className="px-3 py-2" colSpan={3}><span className="font-medium">Misc Credits</span></td>
                    </tr>
                    {miscCredits.length === 0 ? (
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground" colSpan={3}>None</td>
                      </tr>
                    ) : (
                      miscCredits.map((c: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2">{c.date || '-'}</td>
                          <td className="px-3 py-2">{c.description || '-'}</td>
                          <td className="px-3 py-2 text-right">${fmt2(Number(c.amount) || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
