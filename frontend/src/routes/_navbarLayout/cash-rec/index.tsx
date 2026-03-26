import * as React from 'react'
import { createFileRoute, useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { format } from 'date-fns'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import '@/styles/typewriter.css'

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
  giftCertificates?: number
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
      const startOfDay = new Date(`${date}T00:00:00`)
      const endOfDay = new Date(`${date}T23:59:59.999`)
      const qs = new URLSearchParams({ from: startOfDay.toISOString(), to: endOfDay.toISOString() }).toString()
      const resp = await fetch(`/api/payables?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      if (resp.ok) {
        const all: Array<{ amount?: number; paymentMethod?: string; location?: { stationName?: string } }> = await resp.json()
        const filtered = all
          .filter(p => !site || p.location?.stationName === site)
          .filter(p => p.paymentMethod === 'till')
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

  const [merchantFeesEdit, setMerchantFeesEdit] = React.useState<boolean>(false)
  const [merchantFeesValue, setMerchantFeesValue] = React.useState<string>('')
  const [merchantFeesSaved, setMerchantFeesSaved] = React.useState<number | null>(null)

  const copyCell = (e: React.MouseEvent<HTMLTableCellElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const raw = e.currentTarget.textContent?.trim() ?? ''
    if (!raw || raw === '-') return
    let val = raw.replace(/\$/g, '').replace(/,/g, '')
    if (val.startsWith('(') && val.endsWith(')')) val = '-' + val.slice(1, -1)
    navigator.clipboard.writeText(val)
    const td = e.currentTarget
    td.classList.remove('copy-flash')
    void td.offsetWidth // force reflow so re-clicks restart the animation
    td.classList.add('copy-flash')
    td.addEventListener('animationend', () => td.classList.remove('copy-flash'), { once: true })
  }

  const dateObj = React.useMemo(() => parseYmd(date), [date])
  const setDate: React.Dispatch<React.SetStateAction<Date | undefined>> = (next) => {
    const current = dateObj
    const d = typeof next === 'function' ? (next as any)(current) : next
    if (!d) return
    navigate({ search: (prev: any) => ({ ...prev, date: ymd(d) }) })
  }

  return (
    <div className="px-4 space-y-6 w-full max-w-[100vw] overflow-x-hidden flex flex-col">
      <style>{`
        @page { margin: 0; }
        @page { margin-top: 2cm; }
        @media print {
          .cash-rec-no-print { display: none !important; }
          .cash-rec-p1 { break-after: page; }
          .sticky { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      <div className="relative flex w-full flex-col sm:flex-row items-center justify-center gap-4 cash-rec-no-print">
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
        {site && data && (
          <button
            onClick={() => window.print()}
            className="sm:absolute sm:right-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 shadow-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export PDF
          </button>
        )}
      </div>

      {!site && <div className="text-xs text-muted-foreground cash-rec-no-print">Pick a site to view report.</div>}

      {site && data && (
        <div className="space-y-6">

          <div className="space-y-6 cash-rec-p1">
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
            const loyaltyCoupons = num(totals.couponsAccepted) + num(totals.giftCertificates)

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

            // Totals from AR and Payables for the final calculation
            const arTotal = (
              (Array.isArray(data.kardpollEntriesRows)
                ? data.kardpollEntriesRows.reduce((a, r) => a + (Number(r.amount) || 0), 0)
                : 0) +
              (Array.isArray(data.receivablesRows)
                ? data.receivablesRows.reduce((a: number, r: any) => a + (Number(r?.amount) || 0), 0)
                : 0)
            )
            const payTotal = Array.isArray(data.payablesRows)
              ? data.payablesRows.reduce((a: number, p: any) => a + (Number(p?.amount) || 0), 0)
              : 0

            // Sum of misc debits whose description contains "debit" (case-insensitive)
            // const miscDebitDescTotal = Array.isArray(data.bank?.miscDebits)
            //   ? data.bank!.miscDebits.reduce((sum, tx) => {
            //       const desc = typeof tx.description === 'string' ? tx.description : ''
            //       return desc.toLowerCase().includes('debit') ? sum + (Number(tx.amount) || 0) : sum
            //     }, 0)
            //   : 0

            // Sum of misc credits whose description contains "credit" or "tns" (case-insensitive)
            const miscCreditDescTotal = Array.isArray((data.bank as any)?.miscCredits)
              ? (data.bank as any).miscCredits.reduce((sum: number, tx: any) => {
                  const desc = typeof tx.description === 'string' ? tx.description.toLowerCase() : ''
                  const match = site === 'Couchiching'
                    ? desc.includes('tns')
                    : desc.includes('deposit') || desc.includes('tns')
                  return match ? sum + (Number(tx.amount) || 0) : sum
                }, 0)
              : 0

            const dayOfWeek = dateObj ? dateObj.getDay() : -1  // 5 = Friday, 6 = Saturday
            const finalTotal = (dayOfWeek === 5 || dayOfWeek === 6)
              ? bankRec
              : totalDollarSales - cashSafeDeposited + tillOverShort - gcRedemption - loyalty - unsettledPrepays + bankRec - arTotal - payTotal + miscCreditDescTotal

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 typewriter-font">
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Sales Summary</span>
                  </div>
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">GBL/Moneris Fuel Sales (40010)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(gblMonerisFuelSales)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">Canadian Cash (40010)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(canadianCash)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">Kardpoll Sales (40010)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(kardpollSales)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">Store Sales (40200)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(storeSales)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">Lottery Sales (20440)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(lotterySales)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-emerald-50">
                        <td className="px-4 py-2.5 text-gray-600">Lottery Payouts (20440)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(lotteryPayouts)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2.5 font-semibold text-gray-900">Total Dollar Sales</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(totalDollarSales)}</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-gray-600">HH Debit</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(hhDebit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Deduction Summary</span>
                  </div>
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100 bg-red-50">
                        <td className="px-4 py-2.5 text-gray-600">Cash Safe Deposited (10011)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(cashSafeDeposited)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50">
                        <td className="px-4 py-2.5 text-gray-600">Till Over/Short (55050)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(tillOverShort)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-red-50">
                        <td className="px-4 py-2.5 text-gray-600">GiftCard Redemption (52250)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(gcRedemption)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-red-50">
                        <td className="px-4 py-2.5 text-gray-600">Loyalty (52175)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(loyalty)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50">
                        <td className="px-4 py-2.5 text-gray-600">Unsettled Prepays (40010)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(unsettledPrepays === 0 ? 0 : -unsettledPrepays)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50">
                        <td className="px-4 py-2.5 text-gray-600">Bank Rec (55050)</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(bankRec)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50">
                        <td className="px-4 py-2.5 text-gray-600">Balance Check</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(balanceCheck)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2.5 font-semibold text-gray-900">Total</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(finalTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
          </div>

          <div className="space-y-6 cash-rec-p1">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 typewriter-font">
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">AR Transactions</span>
                  </div>
                  {arRows.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No AR transactions found.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/50">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fleet Card / PO #</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-4 py-2.5 text-gray-700">{row.customer || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-700">{row.poNumber || '-'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(row.amount)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2.5 font-semibold text-gray-900" colSpan={2}>Total</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(arTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Payables</span>
                  </div>
                  {payRows.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No payables found.</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/50">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-4 py-2.5 text-gray-700">{row.vendor || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-700">{row.type || '-'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(row.amount)}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.notes || ''}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2.5 font-semibold text-gray-900" colSpan={2}>Total</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(payTotal)}</td>
                          <td className="px-4 py-2.5" />
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          })()}
          </div>

          {(() => {
            const fmt2 = (v: number) =>
              Number.isFinite(v)
                ? (v < 0
                    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                : ''
            const bankMerchantFees = typeof data.bank?.merchantFees === 'number' ? data.bank.merchantFees : null
            const displayFees = merchantFeesSaved !== null ? merchantFeesSaved : bankMerchantFees

            const startEdit = () => {
              setMerchantFeesValue(displayFees !== null ? String(displayFees) : '')
              setMerchantFeesEdit(true)
            }

            const saveFees = async () => {
              const parsed = parseFloat(merchantFeesValue)
              if (!Number.isFinite(parsed)) { setMerchantFeesEdit(false); return }
              try {
                await fetch('/api/cash-rec/bank-statement/merchant-fees', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
                  },
                  body: JSON.stringify({ site, date, merchantFees: parsed }),
                })
                setMerchantFeesSaved(parsed)
              } catch (e) {
                console.error('Failed to save merchant fees', e)
              }
              setMerchantFeesEdit(false)
            }

            return (
              <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden typewriter-font">
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="px-4 py-2.5 text-gray-600">Merchant Fees</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>
                        {merchantFeesEdit ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            value={merchantFeesValue}
                            onChange={e => setMerchantFeesValue(e.target.value)}
                            onBlur={saveFees}
                            onKeyDown={e => { if (e.key === 'Enter') saveFees(); if (e.key === 'Escape') setMerchantFeesEdit(false) }}
                            className="w-28 text-right border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span
                            onDoubleClick={startEdit}
                            title="Double-click to edit"
                            className="cursor-pointer hover:bg-blue-50 rounded px-1"
                          >
                            {displayFees !== null ? `$${fmt2(displayFees)}` : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden typewriter-font">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Bank Statement Details</span>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-400">No bank statement found.</div>
                </div>
              )
            }

            const openingBalance = Number(bank.balanceForward) || 0
            const miscDebits = Array.isArray(bank.miscDebits) ? bank.miscDebits : []
            const miscCredits = Array.isArray((bank as any).miscCredits) ? (bank as any).miscCredits : []

            return (
              <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden typewriter-font">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Bank Statement Details</span>
                </div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500">—</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">Opening Balance</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(openingBalance)}</td>
                    </tr>

                    <tr className="border-t border-gray-200 bg-gray-50/50">
                      <td className="px-4 py-2" colSpan={3}>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Misc Debits</span>
                      </td>
                    </tr>
                    {miscDebits.length === 0 ? (
                      <tr>
                        <td className="px-4 py-2.5 text-gray-400" colSpan={3}>None</td>
                      </tr>
                    ) : (
                      miscDebits.map((d, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-4 py-2.5 text-gray-600">{d.date || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-700">{d.description || '-'}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(Number(d.amount) || 0)}</td>
                        </tr>
                      ))
                    )}

                    <tr className="border-t border-gray-200 bg-gray-50/50">
                      <td className="px-4 py-2" colSpan={3}>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Misc Credits</span>
                      </td>
                    </tr>
                    {miscCredits.length === 0 ? (
                      <tr>
                        <td className="px-4 py-2.5 text-gray-400" colSpan={3}>None</td>
                      </tr>
                    ) : (
                      miscCredits.map((c: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-4 py-2.5 text-gray-600">{c.date || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-700">{c.description || '-'}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 cursor-copy" onClick={copyCell}>${fmt2(Number(c.amount) || 0)}</td>
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
