// import { useEffect, useMemo, useRef } from 'react'
// import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
// import { Button } from '@/components/ui/button'
// import { useFormStore } from '@/store'
// import { DatePicker } from '@/components/custom/datePicker'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { useAuth } from '@/context/AuthContext'
// import { Info } from 'lucide-react' // Or your preferred icon library
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog"

// const InfoDialog = ({ title, imageName }: { title: string; imageName: string }) => {
//   return (
//     <Dialog>
//       <DialogTrigger asChild>
//         <button className="ml-2 inline-flex items-center text-blue-500 hover:text-blue-700 transition-colors">
//           <Info size={16} />
//         </button>
//       </DialogTrigger>
//       {/* Changed max-w-md to max-w-4xl for a much larger viewing area */}
//       <DialogContent className="max-w-4xl w-[90vw] overflow-y-auto max-h-[90vh]">
//         <DialogHeader>
//           <DialogTitle>{title} Reference</DialogTitle>
//         </DialogHeader>
//         <div className="flex flex-col items-center gap-6 py-4">
//           <div className="border rounded-lg shadow-sm overflow-hidden bg-white w-full">
//             <img
//               // Note: If you moved files to public, the path should usually be 
//               // `/lotto_max_reports/${imageName}.png` (omit the word 'public')
//               src={`/public/lotto_max_reports/${imageName}.png`}
//               alt={title}
//               className="w-full h-auto object-contain"
//             />
//           </div>
//           <p className="text-base text-center text-muted-foreground font-medium bg-slate-50 p-4 rounded-md border w-full">
//             Please follow the image and fill in the values from the above mentioned sections for this field.
//           </p>
//         </div>
//       </DialogContent>
//     </Dialog>
//   )
// }

// type LotterySearch = {
//   site: string
//   date?: string // YYYY-MM-DD
// }

// type LoaderData = {
//   sellsLottery: boolean | null
//   totals: Record<string, number> | null
//   rows: any[]
//   count: number
//   status: number | null
//   error: string | null
// }

// const toYmd = (d?: Date) => {
//   if (!d) return ''
//   const y = d.getFullYear()
//   const m = String(d.getMonth() + 1).padStart(2, '0')
//   const day = String(d.getDate()).padStart(2, '0')
//   return `${y}-${m}-${day}`
// }

// const parseYmdToDate = (ymd?: string): Date | undefined => {
//   if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined
//   const [y, m, d] = ymd.split('-').map(Number)
//   return new Date(y, m - 1, d) // local midnight
// }

// export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): LotterySearch => ({
//     site: (search.site as string) || '',
//     date: (search.date as string) || undefined,
//   }),
//   loaderDeps: ({ search: { site, date } }) => ({ site: site || '', date: date || '' }),
//   loader: async ({ deps: { site, date } }): Promise<LoaderData> => {
//     if (!site || !date) return { sellsLottery: null, totals: null, rows: [], count: 0, status: null, error: null }

//     try {
//       const token = localStorage.getItem('token') || ''

//       // 1) Check if site sells lottery
//       let sellsLottery: boolean | null = null
//       try {
//         const locResp = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`, {
//           headers: token ? { Authorization: `Bearer ${token}` } : {},
//         })
//         if (locResp.ok) {
//           const loc = await locResp.json()
//           sellsLottery = Boolean(loc?.sellsLottery)
//           if (!sellsLottery) {
//             return { sellsLottery, totals: null, rows: [], count: 0, status: 200, error: null }
//           }
//         }
//       } catch {
//         sellsLottery = null
//       }

//       // 2) Fetch lottery + Bullock totals
//       const resp = await fetch(
//         `/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
//         {
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//             'X-Required-Permission': 'accounting.cashSummary.lottery',
//           },
//         },
//       )

//       if (resp.status === 403) {
//         return { sellsLottery, totals: null, rows: [], count: 0, status: 403, error: 'forbidden' }
//       }
//       if (!resp.ok) {
//         return { sellsLottery, totals: null, rows: [], count: 0, status: resp.status, error: `HTTP ${resp.status}` }
//       }

//       const data = await resp.json()
//       const totals = data?.totals ?? null
//       const rows = Array.isArray(data?.rows) ? data.rows : []
//       const count = Number((data?.totals?.count ?? rows.length) || 0)

//       return { sellsLottery, totals, rows, count, status: 200, error: null }
//     } catch {
//       return { sellsLottery: null, totals: null, rows: [], count: 0, status: null, error: 'network' }
//     }
//   },
// })

// function RouteComponent() {
//   const { user } = useAuth()
//   const navigate = useNavigate({ from: Route.fullPath })

//   const { site: siteFromUrl, date: dateFromUrl } = Route.useSearch()
//   const { sellsLottery, totals, rows, count, status, error } = Route.useLoaderData() as LoaderData
//   // Global store
//   const date = useFormStore((s) => s.date)
//   const setDate = useFormStore((s) => s.setDate)
//   const lotteryValues = useFormStore((s) => s.lotteryValues)
//   const setLotteryValues = useFormStore((s) => s.setLotteryValues)
//   const setLotterySite = useFormStore((s) => s.setLotterySite)
//   const setLotteryImages = useFormStore((s) => s.setLotteryImages)

//   useEffect(() => {
//     if (status === 403) {
//       navigate({ to: "/no-access" })
//     }
//   }, [status, navigate])

//   // Default site/date via search once when missing
//   useEffect(() => {
//     const next: Partial<LotterySearch> = {}
//     let changed = false

//     if (!siteFromUrl && user?.location) {
//       next.site = user.location
//       changed = true
//     }
//     if (!dateFromUrl) {
//       next.date = toYmd(new Date())
//       changed = true
//     }

//     if (changed) {
//       navigate({
//         search: (prev: LotterySearch) => ({ ...prev, ...next }),
//         replace: true,
//       })
//     }
//   }, [siteFromUrl, dateFromUrl, user?.location, navigate])

//   // Sync global store date from search (guard to avoid loops)
//   const dateAsDate = parseYmdToDate(dateFromUrl)
//   useEffect(() => {
//     if (dateAsDate && (!date || date.getTime() !== dateAsDate.getTime())) {
//       setDate(dateAsDate)
//     }
//   }, [dateAsDate, date, setDate])

//   // Persist selected site into global store for next page
//   useEffect(() => {
//     if (siteFromUrl) setLotterySite(siteFromUrl)
//   }, [siteFromUrl, setLotterySite])

//   // Initialize store values/images only once per site+date so inputs stay editable
//   const initKeyRef = useRef<string>('')
//   useEffect(() => {
//     const key = `${siteFromUrl || ''}|${dateFromUrl || ''}`
//     if (!key) return
//     if (key === initKeyRef.current) return
//     initKeyRef.current = key

//     const found =
//       Array.isArray(rows) &&
//       rows.find(
//         (r: any) =>
//           r?.lottoPayout != null ||
//           r?.onlineLottoTotal != null ||
//           r?.instantLottTotal != null,
//       )

//     const nextValues = found
//       ? {
//         onlineSales: Number(found.onlineLottoTotal ?? 0),
//         onlineCancellations: Number(found.onlineCancellations ?? 0),
//         onlineDiscounts: Number(found.onlineDiscounts ?? 0),
//         scratchSales: Number(found.instantLottTotal ?? 0),
//         payouts: Number(found.lottoPayout ?? 0),
//         datawaveValue: Number(found.dataWave ?? 0),
//         datawaveFee: Number(found.feeDataWave ?? 0),
//         scratchFreeTickets: Number(found.scratchFreeTickets ?? 0),
//         oldScratchTickets: Number(found.oldScratchTickets ?? 0),
//         onDemandFreeTickets: Number(found.onDemandFreeTickets ?? 0),
//         onDemandCashPayout: Number(found.onDemandCashPayout ?? 0),
//         scratchCashPayout: Number(found.scratchCashPayout ?? 0),
//       }
//       : {
//         onlineSales: 0,
//         onlineCancellations: 0,
//         onlineDiscounts: 0,
//         scratchSales: 0,
//         scratchFreeTickets: 0,
//         payouts: 0,
//         onDemandFreeTickets: 0,
//         onDemandCashPayout: 0,
//         scratchCashPayout: 0,
//         datawaveValue: 0,
//         datawaveFee: 0,
//         oldScratchTickets: 0,
//       }

//     setLotteryValues(nextValues)

//     const nextImages = (found && Array.isArray(found.images)) ? found.images : []
//     setLotteryImages(nextImages)
//   }, [rows, siteFromUrl, dateFromUrl, setLotteryValues, setLotteryImages])

//   // Derive Bullock totals and count directly from loader
//   const totalsCount = count ?? 0
//   const bullock = {
//     onlineSales: Number(totals?.onlineSales || 0),
//     scratchSales: Number(totals?.scratchSales || 0),
//     payouts: Number(totals?.payouts || 0),
//     datawaveValue: Number((totals?.dataWave ?? totals?.datawaveValue) || 0),
//     datawaveFee: Number((totals?.dataWaveFee ?? totals?.datawaveFee) || 0),
//   }

//   // Over/Short calculation helpers
//   const overShort = useMemo(() => {
//     return {
//       onlineSales:
//         (bullock.onlineSales || 0) -
//         ((lotteryValues.onlineSales || 0) -
//           (lotteryValues.onlineCancellations || 0) -
//           (lotteryValues.onlineDiscounts || 0)),
//       scratchSales:
//         (bullock.scratchSales || 0) -
//         ((lotteryValues.scratchSales || 0) +
//           (lotteryValues.scratchFreeTickets || 0) +
//           (lotteryValues.oldScratchTickets || 0)),
//       payouts: (bullock.payouts || 0) -
//         ((lotteryValues.payouts || 0)),
//       datawaveValue:
//         (bullock.datawaveValue || 0) - (lotteryValues.datawaveValue || 0),
//       datawaveFee:
//         (bullock.datawaveFee || 0) - (lotteryValues.datawaveFee || 0),
//     }
//   }, [lotteryValues, bullock])

//   const onSiteChange = (newSite: string) => {
//     navigate({
//       search: (prev: LotterySearch) => ({
//         ...prev,
//         site: newSite,
//       }),
//     })
//     // Reset init key to allow re-init on site change
//     initKeyRef.current = ''
//   }

//   if (status === 403) {
//     return null
//   }

//   return (
//     <div className="p-4">
//       <h2 className="text-lg font-bold mb-4">Lottery Reconciliation</h2>

//       <div className="mb-4">
//         <div className="grid grid-cols-2 gap-4 items-end">
//           <div>
//             <h3 className="text-sm font-semibold mb-2">Site</h3>
//             <SitePicker
//               value={siteFromUrl || ''}
//               onValueChange={onSiteChange}
//               placeholder="Select site"
//             />
//           </div>
//           <div>
//             <h3 className="text-sm font-semibold mb-2">Date</h3>
//             <DatePicker
//               date={parseYmdToDate(dateFromUrl)}
//               setDate={(value) => {
//                 const current = parseYmdToDate(dateFromUrl)
//                 const next = typeof value === 'function' ? value(current) : value
//                 navigate({
//                   search: (prev: LotterySearch) => ({
//                     ...prev,
//                     date: next ? toYmd(next) : undefined,
//                   }),
//                 })
//                 // Reset init key to allow re-init on date change
//                 initKeyRef.current = ''
//               }}
//             />
//           </div>
//         </div>
//       </div>

//       {status === 403 ? (
//         <div className="p-4 bg-red-50 text-red-700 rounded-md">
//           You don’t have access to view lottery.
//         </div>
//       ) : sellsLottery === false ? (
//         <div className="p-4 text-sm text-muted-foreground border rounded-md">
//           This store does not sell lottery.
//         </div>
//       ) : totalsCount === 0 ? (
//         <div className="p-4 text-sm text-muted-foreground border rounded-md">
//           Please enter the shift details to fill in the lottery.
//         </div>
//       ) : error ? (
//         <div className="p-4 text-sm text-red-600 border rounded-md">
//           Failed to load lottery data.
//         </div>
//       ) : (
//         <div className="overflow-x-auto border rounded-md">
//           <table className="min-w-full table-auto">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-4 py-2 text-left">Description</th>
//                 <th className="px-4 py-2 text-left">Lottery Report</th>
//                 <th className="px-4 py-2 text-left">Bulloch Report</th>
//                 <th className="px-4 py-2 text-left">Over / Short</th>
//               </tr>
//             </thead>
//             <tbody>
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2 flex items-center">
//                   Online Sales
//                   <InfoDialog title="Online Sales" imageName="online_sales" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-40 p-2 border rounded"
//                     value={(lotteryValues as any).onlineSales ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         onlineSales: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).onlineSales ?? '-'}</td>
//                 <td className="px-4 py-2">
//                   {((overShort as any).onlineSales ?? 0).toFixed
//                     ? `$${Number((overShort as any).onlineSales).toFixed(2)}`
//                     : (overShort as any).onlineSales}
//                 </td>
//               </tr>

//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   Lotto Cancellations
//                   <InfoDialog title="Lotto Cancellations" imageName="cancellations" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).onlineCancellations ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         onlineCancellations: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//               </tr>

//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   Lotto Discounts
//                   <InfoDialog title="Lotto Discounts" imageName="discounts" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).onlineDiscounts ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         onlineDiscounts: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//               </tr>

//               {/* --- SCRATCH SALES SECTION --- */}
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2 flex items-center">
//                   Scratch Sales
//                   <InfoDialog title="Scratch Sales" imageName="scratch_sales" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-40 p-2 border rounded"
//                     value={(lotteryValues as any).scratchSales ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         scratchSales: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).scratchSales ?? '-'}</td>
//                 <td className="px-4 py-2">
//                   {((overShort as any).scratchSales ?? 0).toFixed
//                     ? `$${Number((overShort as any).scratchSales).toFixed(2)}`
//                     : (overShort as any).scratchSales}
//                 </td>
//               </tr>

//               {/* Shared SNW Free Tickets Input in Sales Section */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   SNW Free Tickets
//                   <InfoDialog title="SNW Free Tickets" imageName="scratch_ft_sales" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).scratchFreeTickets ?? 0}
//                     onChange={(e) => {
//                       const val = Number(e.target.value || 0);
//                       const cur = lotteryValues as any;
//                       useFormStore.getState().setLotteryValues({
//                         scratchFreeTickets: val,
//                         // Recalculate Payouts: OnDemandFree + OnDemandCash + SNWCash + NEW SNWFree
//                         payouts: (cur.onDemandCashPayout || 0) + (cur.scratchCashPayout || 0) + val
//                       });
//                     }}
//                   />
//                 </td>
//                 <td colSpan={2} />
//               </tr>

//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Old Scratch Tickets</td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).oldScratchTickets ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         oldScratchTickets: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//               </tr>

//               {/* --- PAYOUTS SECTION --- */}
//               <tr className="border-t font-semibold bg-blue-50/30">
//                 <td className="px-4 py-2">Total Payouts (Calculated)</td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     readOnly
//                     className="w-40 p-2 border rounded bg-gray-100 cursor-not-allowed"
//                     value={(lotteryValues as any).payouts ?? 0}
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).payouts ?? '-'}</td>
//                 <td className="px-4 py-2">
//                   {((overShort as any).payouts ?? 0).toFixed
//                     ? `$${Number((overShort as any).payouts).toFixed(2)}`
//                     : (overShort as any).payouts}
//                 </td>
//               </tr>

//               {/* On Demand Free Tickets (Informational only) */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   On Demand Free Tickets
//                   <InfoDialog title="On Demand Free Tickets" imageName="online_ft_sales" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded border-dashed"
//                     value={(lotteryValues as any).onDemandFreeTickets ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         onDemandFreeTickets: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td colSpan={2} />
//               </tr>

//               {/* On Demand Cash Payout */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   On Demand Cash Payout
//                   <InfoDialog title="On Demand Cash Payout" imageName="online_cash_payout" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).onDemandCashPayout ?? 0}
//                     onChange={(e) => {
//                       const val = Number(e.target.value || 0);
//                       const current = lotteryValues as any;
//                       useFormStore.getState().setLotteryValues({
//                         onDemandCashPayout: val,
//                         payouts: val + (current.scratchCashPayout || 0) + (current.scratchFreeTickets || 0)
//                       });
//                     }}
//                   />
//                 </td>
//                 <td colSpan={2} />
//               </tr>

//               {/* Shared SNW Free Tickets Input in Payouts Section */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   SNW Free Tickets
//                   <InfoDialog title="SNW Free Tickets" imageName="scratch_ft_sales" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).scratchFreeTickets ?? 0}
//                     onChange={(e) => {
//                       const val = Number(e.target.value || 0);
//                       const cur = lotteryValues as any;
//                       useFormStore.getState().setLotteryValues({
//                         scratchFreeTickets: val,
//                         // Recalculate Payouts: OnDemandFree + OnDemandCash + SNWCash + NEW SNWFree
//                         payouts: (cur.onDemandCashPayout || 0) + (cur.scratchCashPayout || 0) + val
//                       });
//                     }}
//                   />
//                 </td>
//                 <td colSpan={2} />
//               </tr>

//               {/* SNW Cash Payout (scratchCashPayout) */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8 flex items-center">
//                   SNW Cash Payout
//                   <InfoDialog title="SNW Cash Payout" imageName="scratch_cash_payout" />
//                 </td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-36 p-2 border rounded"
//                     value={(lotteryValues as any).scratchCashPayout ?? 0}
//                     onChange={(e) => {
//                       const val = Number(e.target.value || 0);
//                       const current = lotteryValues as any;
//                       useFormStore.getState().setLotteryValues({
//                         scratchCashPayout: val,
//                         payouts: (current.onDemandCashPayout || 0) + val + (current.scratchFreeTickets || 0)
//                       });
//                     }}
//                   />
//                 </td>
//                 <td colSpan={2} />
//               </tr>

//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Datawave Value</td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-40 p-2 border rounded"
//                     value={(lotteryValues as any).datawaveValue ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         datawaveValue: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).datawaveValue ?? '-'}</td>
//                 <td className="px-4 py-2">
//                   {((overShort as any).datawaveValue ?? 0).toFixed
//                     ? `$${Number((overShort as any).datawaveValue).toFixed(2)}`
//                     : (overShort as any).datawaveValue}
//                 </td>
//               </tr>

//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Datawave Fee</td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-40 p-2 border rounded"
//                     value={(lotteryValues as any).datawaveFee ?? 0}
//                     onChange={(e) =>
//                       useFormStore.getState().setLotteryValues({
//                         datawaveFee: Number(e.target.value || 0),
//                       })
//                     }
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).datawaveFee ?? '-'}</td>
//                 <td className="px-4 py-2">
//                   {((overShort as any).datawaveFee ?? 0).toFixed
//                     ? `$${Number((overShort as any).datawaveFee).toFixed(2)}`
//                     : (overShort as any).datawaveFee}
//                 </td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       )}

//       {sellsLottery !== false && totalsCount !== 0 && (
//         <div className="flex justify-between mt-4">
//           <div />
//           <Link
//             to="/cash-summary/lottery-images"
//             search={(prev: any) => ({ ...prev })}
//           // search={(prev: any) => {
//           //   const { id, ...rest } = prev || {}
//           //   return { ...rest, site: rest?.site, date: rest?.date }
//           // }}
//           >
//             <Button>Next</Button>
//           </Link>
//         </div>
//       )}
//     </div>
//   )
// }
import { useEffect, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useFormStore } from '@/store'
import { DatePicker } from '@/components/custom/datePicker'
import { SitePicker } from '@/components/custom/sitePicker'
import { useAuth } from '@/context/AuthContext'
import { LotteryComparisonTable } from '@/components/custom/LotteryComparisionTable'

type LotterySearch = {
  site: string
  date?: string // YYYY-MM-DD
}

type LoaderData = {
  sellsLottery: boolean | null
  totals: Record<string, number> | null
  rows: any[]
  count: number
  status: number | null
  error: string | null
}

const toYmd = (d?: Date) => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const parseYmdToDate = (ymd?: string): Date | undefined => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d) // local midnight
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): LotterySearch => ({
    site: (search.site as string) || '',
    date: (search.date as string) || undefined,
  }),
  loaderDeps: ({ search: { site, date } }) => ({ site: site || '', date: date || '' }),
  loader: async ({ deps: { site, date } }): Promise<LoaderData> => {
    if (!site || !date) return { sellsLottery: null, totals: null, rows: [], count: 0, status: null, error: null }

    try {
      const token = localStorage.getItem('token') || ''

      // 1) Check if site sells lottery
      let sellsLottery: boolean | null = null
      try {
        const locResp = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (locResp.ok) {
          const loc = await locResp.json()
          sellsLottery = Boolean(loc?.sellsLottery)
          if (!sellsLottery) {
            return { sellsLottery, totals: null, rows: [], count: 0, status: 200, error: null }
          }
        }
      } catch {
        sellsLottery = null
      }

      // 2) Fetch lottery + Bullock totals
      const resp = await fetch(
        `/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Required-Permission': 'accounting.cashSummary.lottery',
          },
        },
      )

      if (resp.status === 403) {
        return { sellsLottery, totals: null, rows: [], count: 0, status: 403, error: 'forbidden' }
      }
      if (!resp.ok) {
        return { sellsLottery, totals: null, rows: [], count: 0, status: resp.status, error: `HTTP ${resp.status}` }
      }

      const data = await resp.json()
      const totals = data?.totals ?? null
      const rows = Array.isArray(data?.rows) ? data.rows : []
      const count = Number((data?.totals?.count ?? rows.length) || 0)

      return { sellsLottery, totals, rows, count, status: 200, error: null }
    } catch {
      return { sellsLottery: null, totals: null, rows: [], count: 0, status: null, error: 'network' }
    }
  },
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })

  const { site: siteFromUrl, date: dateFromUrl } = Route.useSearch()
  const { sellsLottery, totals, rows, count, status, error } = Route.useLoaderData() as LoaderData
  // Global store
  const date = useFormStore((s) => s.date)
  const setDate = useFormStore((s) => s.setDate)
  const lotteryValues = useFormStore((s) => s.lotteryValues)
  const setLotteryValues = useFormStore((s) => s.setLotteryValues)
  const setLotterySite = useFormStore((s) => s.setLotterySite)
  const setLotteryImages = useFormStore((s) => s.setLotteryImages)

  useEffect(() => {
    if (status === 403) {
      navigate({ to: "/no-access" })
    }
  }, [status, navigate])

  // Default site/date via search once when missing
  useEffect(() => {
    const next: Partial<LotterySearch> = {}
    let changed = false

    if (!siteFromUrl && user?.location) {
      next.site = user.location
      changed = true
    }
    if (!dateFromUrl) {
      next.date = toYmd(new Date())
      changed = true
    }

    if (changed) {
      navigate({
        search: (prev: LotterySearch) => ({ ...prev, ...next }),
        replace: true,
      })
    }
  }, [siteFromUrl, dateFromUrl, user?.location, navigate])

  // Sync global store date from search (guard to avoid loops)
  const dateAsDate = parseYmdToDate(dateFromUrl)
  useEffect(() => {
    if (dateAsDate && (!date || date.getTime() !== dateAsDate.getTime())) {
      setDate(dateAsDate)
    }
  }, [dateAsDate, date, setDate])

  // Persist selected site into global store for next page
  useEffect(() => {
    if (siteFromUrl) setLotterySite(siteFromUrl)
  }, [siteFromUrl, setLotterySite])

  // Initialize store values/images only once per site+date so inputs stay editable
  const initKeyRef = useRef<string>('')
  useEffect(() => {
    const key = `${siteFromUrl || ''}|${dateFromUrl || ''}`
    if (!key) return
    if (key === initKeyRef.current) return
    initKeyRef.current = key

    const found =
      Array.isArray(rows) &&
      rows.find(
        (r: any) =>
          r?.lottoPayout != null ||
          r?.onlineLottoTotal != null ||
          r?.instantLottTotal != null,
      )

    const nextValues = found
      ? {
        onlineSales: Number(found.onlineLottoTotal ?? 0),
        onlineCancellations: Number(found.onlineCancellations ?? 0),
        onlineDiscounts: Number(found.onlineDiscounts ?? 0),
        scratchSales: Number(found.instantLottTotal ?? 0),
        payouts: Number(found.lottoPayout ?? 0),
        dataWave: Number(found.dataWave ?? 0),
        feeDataWave: Number(found.feeDataWave ?? 0),
        scratchFreeTickets: Number(found.scratchFreeTickets ?? 0),
        oldScratchTickets: Number(found.oldScratchTickets ?? 0),
        onDemandFreeTickets: Number(found.onDemandFreeTickets ?? 0),
        onDemandCashPayout: Number(found.onDemandCashPayout ?? 0),
        scratchCashPayout: Number(found.scratchCashPayout ?? 0),
        vouchersRedeemed: Number(found.vouchersRedeemed ?? 0),
      }
      : {
        onlineSales: 0,
        onlineCancellations: 0,
        onlineDiscounts: 0,
        scratchSales: 0,
        scratchFreeTickets: 0,
        payouts: 0,
        onDemandFreeTickets: 0,
        onDemandCashPayout: 0,
        scratchCashPayout: 0,
        dataWave: 0,
        feeDataWave: 0,
        oldScratchTickets: 0,
        vouchersRedeemed: 0,
      }

    setLotteryValues(nextValues)

    const nextImages = (found && Array.isArray(found.images)) ? found.images : []
    setLotteryImages(nextImages)
  }, [rows, siteFromUrl, dateFromUrl, setLotteryValues, setLotteryImages])

  // Derive Bullock totals and count directly from loader
  const totalsCount = count ?? 0
  const bullock = {
    onlineSales: Number(totals?.onlineSales || 0),
    scratchSales: Number(totals?.scratchSales || 0),
    payouts: Number(totals?.payouts || 0),
    dataWave: Number((totals?.dataWave ?? totals?.datawaveValue) || 0),
    feeDataWave: Number((totals?.dataWaveFee ?? totals?.datawaveFee) || 0),
  }

  const onSiteChange = (newSite: string) => {
    navigate({
      search: (prev: LotterySearch) => ({
        ...prev,
        site: newSite,
      }),
    })
    // Reset init key to allow re-init on site change
    initKeyRef.current = ''
  }

  if (status === 403) {
    return null
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Lottery Reconciliation</h2>

      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <h3 className="text-sm font-semibold mb-2">Site</h3>
            <SitePicker
              value={siteFromUrl || ''}
              onValueChange={onSiteChange}
              placeholder="Select site"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Date</h3>
            <DatePicker
              date={parseYmdToDate(dateFromUrl)}
              setDate={(value) => {
                const current = parseYmdToDate(dateFromUrl)
                const next = typeof value === 'function' ? value(current) : value
                navigate({
                  search: (prev: LotterySearch) => ({
                    ...prev,
                    date: next ? toYmd(next) : undefined,
                  }),
                })
                // Reset init key to allow re-init on date change
                initKeyRef.current = ''
              }}
            />
          </div>
        </div>
      </div>

      {status === 403 ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          You don’t have access to view lottery.
        </div>
      ) : sellsLottery === false ? (
        <div className="p-4 text-sm text-muted-foreground border rounded-md">
          This store does not sell lottery.
        </div>
      ) : totalsCount === 0 ? (
        <div className="p-4 text-sm text-muted-foreground border rounded-md">
          Please enter the shift details to fill in the lottery.
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-red-600 border rounded-md">
          Failed to load lottery data.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <LotteryComparisonTable
            lotteryData={lotteryValues}
            bullockData={bullock}
            isReadOnly={false}
          />
        </div>
      )}

      {sellsLottery !== false && totalsCount !== 0 && (
        <div className="flex justify-between mt-4">
          <div />
          <Link
            to="/cash-summary/lottery-images"
            search={(prev: any) => ({ ...prev })}
          // search={(prev: any) => {
          //   const { id, ...rest } = prev || {}
          //   return { ...rest, site: rest?.site, date: rest?.date }
          // }}
          >
            <Button>Next</Button>
          </Link>
        </div>
      )}
    </div>
  )
}