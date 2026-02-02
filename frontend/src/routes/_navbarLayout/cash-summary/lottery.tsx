// import { useEffect, useMemo, useState } from 'react'
// import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
// import { Button } from '@/components/ui/button'
// import { useFormStore } from '@/store'
// import { DatePicker } from '@/components/custom/datePicker'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { useAuth } from '@/context/AuthContext'

// type LotterySearch = {
//   site: string
//   date?: string
// }

// export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): LotterySearch => ({
//     site: (search.site as string) || '',
//     date: (search.date as string) || undefined,
//   }),
// })


// // const ROWS = [
// //   { key: 'onlineSales', label: 'Online Sales' },
// //   { key: 'scratchSales', label: 'Scratch Sales' },
// //   { key: 'payouts', label: 'Payouts' },
// //   { key: 'datawaveValue', label: 'Datawave Value' },
// //   { key: 'datawaveFee', label: 'Datawave Fee' },
// // ] as const

// function RouteComponent() {
//   const { user } = useAuth()
//   const { site: siteFromUrl } = Route.useSearch()
//   const [site, setSite] = useState(siteFromUrl)


//   const date = useFormStore((s) => s.date)
//   const setDate = useFormStore((s) => s.setDate)
//   const lotteryValues = useFormStore((s) => s.lotteryValues)
//   const setLotteryValues = useFormStore((s) => s.setLotteryValues)
//   const setLotterySite = useFormStore((s) => s.setLotterySite)

//   const navigate = useNavigate({ from: Route.fullPath })

//   // images are stored in the store and used on the images page
//   // const lotteryImages = useFormStore((s) => s.lotteryImages)
//   const setLotteryImages = useFormStore((s) => s.setLotteryImages)

//   // Bullock report totals fetched from backend for selected site+date
//   const [bullock, setBullock] = useState<Record<string, number>>({})
//   // const [site, setSite] = useState<string>(user?.location || '')
//   const [_, setExistingEntry] = useState(false)
//   const [sellsLottery, setSellsLottery] = useState<boolean | null>(null)
//   const [totalsCount, setTotalsCount] = useState<number | null>(null)

//   useEffect(() => {
//     if (siteFromUrl && siteFromUrl !== site) {
//       setSite(siteFromUrl)
//     }
//   }, [siteFromUrl])

//   const updateSite = (newSite: string) => {
//     setSite(newSite)

//     navigate({
//       search: (prev: LotterySearch) => ({
//         ...prev,
//         site: newSite,
//       }),
//     })
//   }

//   useEffect(() => {
//     if (!siteFromUrl && user?.location) {
//       navigate({
//         search: (prev: LotterySearch) => ({
//           ...prev,
//           site: user.location,
//         }),
//         replace: true,
//       })
//     }
//   }, [siteFromUrl, user])



//   useEffect(() => {
//     // persist selected site into global store so images page can access it
//     setLotterySite(site)
//   }, [site, setLotterySite])

//   const toYmd = (d?: Date) => {
//     if (!d) return ''
//     const y = d.getFullYear()
//     const m = String(d.getMonth() + 1).padStart(2, '0')
//     const day = String(d.getDate()).padStart(2, '0')
//     return `${y}-${m}-${day}`
//   }

//   useEffect(() => {
//     const ymd = toYmd(date)
//     if (!site || !ymd) return

//     const controller = new AbortController()
//       ; (async () => {
//         try {
//           const token = localStorage.getItem('token')

//           // 1) Check location sellsLottery flag
//           try {
//             const locResp = await fetch(`/api/locations?stationName=${encodeURIComponent(site)}`, {
//               signal: controller.signal,
//               headers: token ? { Authorization: `Bearer ${token}` } : {},
//             })
//             if (locResp.ok) {
//               const loc = await locResp.json()
//               setSellsLottery(Boolean(loc?.sellsLottery))
//               if (!loc?.sellsLottery) {
//                 // site does not sell lottery — clear state and stop
//                 setBullock({})
//                 setExistingEntry(false)
//                 setTotalsCount(0)
//                 return
//               }
//             }
//           } catch (le) {
//             console.warn('Location check failed', le)
//             // proceed — default to allowing lottery
//             setSellsLottery(null)
//           }

//           // 2) Fetch lottery/bullock totals
//           const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(ymd)}`, {
//             signal: controller.signal,
//             headers: token ? { Authorization: `Bearer ${token}`, "X-Required-Permission": "accounting.lottery" } : {},
//           })
//           if (resp.status === 403) {
//             navigate({ to: "/no-access" })
//             return
//           }
//           if (!resp.ok) {
//             console.warn('Lottery fetch returned', resp.status, await resp.text().catch(() => ''))
//             setBullock({})
//             setExistingEntry(false)
//             setTotalsCount(0)
//             return
//           }
//           const data = await resp.json()

//           const t = data?.totals || {}
//           setBullock({
//             onlineSales: Number(t.onlineSales || 0),
//             scratchSales: Number(t.scratchSales || 0),
//             // scratchFreeTickets is not provided by Bullock; leave undefined so UI shows '-'
//             payouts: Number(t.payouts || 0),
//             datawaveValue: Number(t.dataWave || 0),
//             datawaveFee: Number(t.dataWaveFee || 0),
//           })

//           setTotalsCount(Number(t.count || 0))

//           const rows = Array.isArray(data?.rows) ? data.rows : []
//           const found = rows.find((r: any) => (r.lottoPayout != null) || (r.onlineLottoTotal != null) || (r.instantLottTotal != null))
//           if (found) {
//             setExistingEntry(true)
//             setLotteryValues({
//               onlineSales: Number(found.onlineLottoTotal ?? 0),
//               onlineCancellations: Number(found.onlineCancellations ?? 0),
//               onlineDiscounts: Number(found.onlineDiscounts ?? 0),
//               scratchSales: Number(found.instantLottTotal ?? 0),
//               payouts: Number(found.lottoPayout ?? 0),
//               datawaveValue: Number(found.dataWave ?? 0),
//               datawaveFee: Number(found.feeDataWave ?? 0),
//               scratchFreeTickets: Number(found.scratchFreeTickets ?? 0),
//             })
//             if (Array.isArray(found.images) && found.images.length) setLotteryImages(found.images)
//           } else {
//             setExistingEntry(false)
//             setLotteryValues({
//               onlineSales: 0,
//               onlineCancellations: 0,
//               onlineDiscounts: 0,
//               scratchSales: 0,
//               scratchFreeTickets: 0,
//               payouts: 0,
//               datawaveValue: 0,
//               datawaveFee: 0,
//             })
//             setLotteryImages([])
//           }
//         } catch (e) {
//           if ((e as any).name !== 'AbortError') console.warn('Lottery totals fetch failed', e)
//         }
//       })()

//     return () => controller.abort()
//   }, [site, date, setLotteryValues, setLotteryImages, user, navigate])

//   // Over/Short calculation helpers
//   const overShort = useMemo(() => {
//     return {
//       onlineSales:
//         (lotteryValues.onlineSales || 0) -
//         ((bullock.onlineSales || 0) + (lotteryValues.onlineCancellations || 0) + (lotteryValues.onlineDiscounts || 0)),
//       // Scratch over/short is based on scratch sales + scratch free tickets vs bullock scratch sales
//       scratchSales:
//         ((lotteryValues.scratchSales || 0) + (lotteryValues.scratchFreeTickets || 0)) -
//         (bullock.scratchSales || 0),
//       payouts: (lotteryValues.payouts || 0) - (bullock.payouts || 0),
//       datawaveValue: (lotteryValues.datawaveValue || 0) - (bullock.datawaveValue || 0),
//       datawaveFee: (lotteryValues.datawaveFee || 0) - (bullock.datawaveFee || 0),
//     }
//   }, [lotteryValues, bullock])

//   const handleChange = (key: string, value: string) => {
//     const num = Number(value || 0)
//     if (key === 'datawaveValue') setLotteryValues({ datawaveValue: num })
//     else if (key === 'datawaveFee') setLotteryValues({ datawaveFee: num })
//     else setLotteryValues({ [key]: num } as any)
//   }

//   return (
//     <div className="p-4">
//       <h2 className="text-lg font-bold mb-4">Lottery Reconciliation</h2>
//       <div className="mb-4">
//         <div className="grid grid-cols-2 gap-4 items-end">
//           <div>
//             <h3 className="text-sm font-semibold mb-2">Site</h3>
//             <SitePicker
//               value={site}
//               onValueChange={updateSite}
//               placeholder="Select site"
//             />
//           </div>
//           <div>
//             <h3 className="text-sm font-semibold mb-2">Date</h3>
//             <DatePicker
//               date={date}
//               setDate={(value) => {
//                 if (typeof value === 'function') {
//                   const newDate = value(date);
//                   if (newDate) setDate(newDate);
//                 } else {
//                   setDate(value);
//                 }
//               }}
//             />
//           </div>
//         </div>
//         {/* {existingEntry && <div className="mt-2 text-sm text-muted-foreground">Existing lottery entry found for this site/date — values and images populated.</div>} */}
//       </div>

//       {sellsLottery === false ? (
//         <div className="p-4 text-sm text-muted-foreground border rounded-md">This store does not sell lottery.</div>
//       ) : totalsCount === 0 ? (
//         <div className="p-4 text-sm text-muted-foreground border rounded-md">Please enter the shift details to fill in the lottery.</div>
//       ) : (
//         <div className="overflow-x-auto border rounded-md">
//           <table className="min-w-full table-auto">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-4 py-2 text-left">Description</th>
//                 <th className="px-4 py-2 text-left">Lottery Report</th>
//                 <th className="px-4 py-2 text-left">Bullock Report</th>
//                 <th className="px-4 py-2 text-left">Over / Short</th>
//               </tr>
//             </thead>
//             <tbody>
//               {/* Online Sales main row */}
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Online Sales</td>
//                 <td className="px-4 py-2">
//                   <input
//                     type="number"
//                     className="w-40 p-2 border rounded"
//                     value={(lotteryValues as any).onlineSales ?? 0}
//                     onChange={(e) => handleChange('onlineSales', e.target.value)}
//                   />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).onlineSales ?? '-'}</td>
//                 <td className="px-4 py-2">{((overShort as any).onlineSales ?? 0).toFixed ? `$${Number((overShort as any).onlineSales).toFixed(2)}` : (overShort as any).onlineSales}</td>
//               </tr>
//               {/* Online sub-rows: Cancellations & Discounts (user-entered, no bullock values) */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Lotto Cancellations</td>
//                 <td className="px-4 py-2">
//                   <input type="number" className="w-36 p-2 border rounded" value={(lotteryValues as any).onlineCancellations ?? 0} onChange={(e) => handleChange('onlineCancellations', e.target.value)} />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Lotto Discounts</td>
//                 <td className="px-4 py-2">
//                   <input type="number" className="w-36 p-2 border rounded" value={(lotteryValues as any).onlineDiscounts ?? 0} onChange={(e) => handleChange('onlineDiscounts', e.target.value)} />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//               </tr>

//               {/* Scratch Sales main row (over/short uses scratch + free tickets) */}
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Scratch Sales</td>
//                 <td className="px-4 py-2">
//                   <input type="number" className="w-40 p-2 border rounded" value={(lotteryValues as any).scratchSales ?? 0} onChange={(e) => handleChange('scratchSales', e.target.value)} />
//                 </td>
//                 <td className="px-4 py-2">{(bullock as any).scratchSales ?? '-'}</td>
//                 <td className="px-4 py-2">{((overShort as any).scratchSales ?? 0).toFixed ? `$${Number((overShort as any).scratchSales).toFixed(2)}` : (overShort as any).scratchSales}</td>
//               </tr>
//               {/* Scratch sub-row: Free Tickets */}
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Scratch Free Tickets</td>
//                 <td className="px-4 py-2">
//                   <input type="number" className="w-36 p-2 border rounded" value={(lotteryValues as any).scratchFreeTickets ?? 0} onChange={(e) => handleChange('scratchFreeTickets', e.target.value)} />
//                 </td>
//                 <td className="px-4 py-2">—</td>
//                 <td className="px-4 py-2">—</td>
//                 {/* <td className="px-4 py-2">{((overShort as any).scratchSales ?? 0).toFixed ? `$${Number((overShort as any).scratchSales).toFixed(2)}` : (overShort as any).scratchSales}</td> */}
//               </tr>

//               {/* Remaining rows: payouts, datawave, fee */}
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Payouts</td>
//                 <td className="px-4 py-2"><input type="number" className="w-40 p-2 border rounded" value={(lotteryValues as any).payouts ?? 0} onChange={(e) => handleChange('payouts', e.target.value)} /></td>
//                 <td className="px-4 py-2">{(bullock as any).payouts ?? '-'}</td>
//                 <td className="px-4 py-2">{((overShort as any).payouts ?? 0).toFixed ? `$${Number((overShort as any).payouts).toFixed(2)}` : (overShort as any).payouts}</td>
//               </tr>
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Datawave Value</td>
//                 <td className="px-4 py-2"><input type="number" className="w-40 p-2 border rounded" value={(lotteryValues as any).datawaveValue ?? 0} onChange={(e) => handleChange('datawaveValue', e.target.value)} /></td>
//                 <td className="px-4 py-2">{(bullock as any).datawaveValue ?? '-'}</td>
//                 <td className="px-4 py-2">{((overShort as any).datawaveValue ?? 0).toFixed ? `$${Number((overShort as any).datawaveValue).toFixed(2)}` : (overShort as any).datawaveValue}</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Datawave Fee</td>
//                 <td className="px-4 py-2"><input type="number" className="w-40 p-2 border rounded" value={(lotteryValues as any).datawaveFee ?? 0} onChange={(e) => handleChange('datawaveFee', e.target.value)} /></td>
//                 <td className="px-4 py-2">{(bullock as any).datawaveFee ?? '-'}</td>
//                 <td className="px-4 py-2">{((overShort as any).datawaveFee ?? 0).toFixed ? `$${Number((overShort as any).datawaveFee).toFixed(2)}` : (overShort as any).datawaveFee}</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       )}

//       {sellsLottery !== false && totalsCount !== 0 && (
//         <div className="flex justify-between mt-4">
//           <div />
//           <Link to="/cash-summary/lottery-images">
//             <Button>Next</Button>
//           </Link>
//         </div>
//       )}
//     </div>
//   )
// }

import { useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useFormStore } from '@/store'
import { DatePicker } from '@/components/custom/datePicker'
import { SitePicker } from '@/components/custom/sitePicker'
import { useAuth } from '@/context/AuthContext'

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
        datawaveValue: Number(found.dataWave ?? 0),
        datawaveFee: Number(found.feeDataWave ?? 0),
        scratchFreeTickets: Number(found.scratchFreeTickets ?? 0),
        oldScratchTickets: Number(found.oldScratchTickets ?? 0),
      }
      : {
        onlineSales: 0,
        onlineCancellations: 0,
        onlineDiscounts: 0,
        scratchSales: 0,
        scratchFreeTickets: 0,
        payouts: 0,
        datawaveValue: 0,
        datawaveFee: 0,
        oldScratchTickets: 0,
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
    datawaveValue: Number((totals?.dataWave ?? totals?.datawaveValue) || 0),
    datawaveFee: Number((totals?.dataWaveFee ?? totals?.datawaveFee) || 0),
  }

  // Over/Short calculation helpers
  const overShort = useMemo(() => {
    return {
      onlineSales:
        (bullock.onlineSales || 0) -
        ((lotteryValues.onlineSales || 0) -
          (lotteryValues.onlineCancellations || 0) -
          (lotteryValues.onlineDiscounts || 0)),
      scratchSales:
        (bullock.scratchSales || 0) -
        ((lotteryValues.scratchSales || 0) +
          (lotteryValues.scratchFreeTickets || 0) +
          (lotteryValues.oldScratchTickets || 0)),
      payouts: (bullock.payouts || 0) -
        ((lotteryValues.payouts || 0) +
          (lotteryValues.scratchFreeTickets || 0)),
      datawaveValue:
        (bullock.datawaveValue || 0) - (lotteryValues.datawaveValue || 0),
      datawaveFee:
        (bullock.datawaveFee || 0) - (lotteryValues.datawaveFee || 0),
    }
  }, [lotteryValues, bullock])

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
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Lottery Report</th>
                <th className="px-4 py-2 text-left">Bulloch Report</th>
                <th className="px-4 py-2 text-left">Over / Short</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Online Sales</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any).onlineSales ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        onlineSales: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any).onlineSales ?? '-'}</td>
                <td className="px-4 py-2">
                  {((overShort as any).onlineSales ?? 0).toFixed
                    ? `$${Number((overShort as any).onlineSales).toFixed(2)}`
                    : (overShort as any).onlineSales}
                </td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Lotto Cancellations</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-36 p-2 border rounded"
                    value={(lotteryValues as any).onlineCancellations ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        onlineCancellations: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Lotto Discounts</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-36 p-2 border rounded"
                    value={(lotteryValues as any).onlineDiscounts ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        onlineDiscounts: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>

              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Scratch Sales</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any).scratchSales ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        scratchSales: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any).scratchSales ?? '-'}</td>
                <td className="px-4 py-2">
                  {((overShort as any).scratchSales ?? 0).toFixed
                    ? `$${Number((overShort as any).scratchSales).toFixed(2)}`
                    : (overShort as any).scratchSales}
                </td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Scratch Free Tickets</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-36 p-2 border rounded"
                    value={(lotteryValues as any).scratchFreeTickets ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        scratchFreeTickets: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Old Scratch Tickets</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-36 p-2 border rounded"
                    value={(lotteryValues as any).oldScratchTickets ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        oldScratchTickets: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>

              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Payouts</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any).payouts ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        payouts: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any).payouts ?? '-'}</td>
                <td className="px-4 py-2">
                  {((overShort as any).payouts ?? 0).toFixed
                    ? `$${Number((overShort as any).payouts).toFixed(2)}`
                    : (overShort as any).payouts}
                </td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Scratch Free Tickets Payouts</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-36 p-2 border rounded"
                    value={(lotteryValues as any).scratchFreeTickets ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        scratchFreeTickets: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>

              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Datawave Value</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any).datawaveValue ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        datawaveValue: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any).datawaveValue ?? '-'}</td>
                <td className="px-4 py-2">
                  {((overShort as any).datawaveValue ?? 0).toFixed
                    ? `$${Number((overShort as any).datawaveValue).toFixed(2)}`
                    : (overShort as any).datawaveValue}
                </td>
              </tr>

              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Datawave Fee</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-40 p-2 border rounded"
                    value={(lotteryValues as any).datawaveFee ?? 0}
                    onChange={(e) =>
                      useFormStore.getState().setLotteryValues({
                        datawaveFee: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="px-4 py-2">{(bullock as any).datawaveFee ?? '-'}</td>
                <td className="px-4 py-2">
                  {((overShort as any).datawaveFee ?? 0).toFixed
                    ? `$${Number((overShort as any).datawaveFee).toFixed(2)}`
                    : (overShort as any).datawaveFee}
                </td>
              </tr>
            </tbody>
          </table>
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