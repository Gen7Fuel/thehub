// import { useEffect, useState } from 'react'
// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { DatePicker } from '@/components/custom/datePicker'
// import { SitePicker } from '@/components/custom/sitePicker'
// import { Button } from '@/components/ui/button'
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
// import { domain } from '@/lib/constants'
// import { Eye, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
// import { useAuth } from '@/context/AuthContext'

// type LotteryListSearch = {
//   site?: string
// }

// export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery-list')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>): LotteryListSearch => ({
//     site: search.site as string | undefined,
//   }),
// })


// function RouteComponent() {
//   const navigate = useNavigate({ from: Route.fullPath })
//   const { user } = useAuth()

//   const { site: siteFromUrl } = Route.useSearch()

//   const [site, setSite] = useState<string>(siteFromUrl || '')

//   const [date, setDate] = useState<Date | undefined>(new Date())
//   const [loading, setLoading] = useState(false)
//   const [lottery, setLottery] = useState<any | null>(null)
//   const [bullock, setBullock] = useState<Record<string, number> | null>(null)

//   const [imageModal, setImageModal] = useState<{
//     isOpen: boolean
//     images: string[]
//     currentIndex: number
//   }>({ isOpen: false, images: [], currentIndex: 0 })

//   const toYmd = (d?: Date) => {
//     if (!d) return ''
//     const y = d.getFullYear()
//     const m = String(d.getMonth() + 1).padStart(2, '0')
//     const day = String(d.getDate()).padStart(2, '0')
//     return `${y}-${m}-${day}`
//   }

//   useEffect(() => {
//     if (!siteFromUrl && user?.location) {
//       navigate({
//         search: (prev: LotteryListSearch) => ({
//           ...prev,
//           site: user.location,
//         }),
//         replace: true,
//       })
//     }
//   }, [siteFromUrl, user])



//   useEffect(() => {
//     if (siteFromUrl && siteFromUrl !== site) {
//       setSite(siteFromUrl)
//     }
//   }, [siteFromUrl])


//   useEffect(() => {
//     const ymd = toYmd(date)
//     if (!site || !ymd) return

//     const controller = new AbortController()
//       ; (async () => {
//         setLoading(true)
//         try {
//           const token = localStorage.getItem('token')
//           const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(ymd)}`, {
//             signal: controller.signal,
//             headers: token ? { Authorization: `Bearer ${token}`, "X-Required-Permission": "accounting.lotteryList" } : {},
//           })

//           if (resp.status === 403) {
//             navigate({ to: '/no-access' })
//             return
//           }

//           if (!resp.ok) {
//             setLottery(null)
//             return
//           }

//           const data = await resp.json()
//           setLottery(data?.lottery ?? null)
//           setBullock(data?.totals ?? null)
//         } catch (e) {
//           if ((e as any).name !== 'AbortError') console.warn('Lottery list fetch failed', e)
//           setLottery(null)
//         } finally {
//           setLoading(false)
//         }
//       })()

//     return () => controller.abort()
//   }, [site, date, navigate])

//   const viewImages = (images: string[]) => {
//     if (!images || images.length === 0) {
//       alert('No images attached')
//       return
//     }

//     setImageModal({ isOpen: true, images, currentIndex: 0 })
//   }

//   const closeModal = () => setImageModal({ isOpen: false, images: [], currentIndex: 0 })
//   const nextImage = () => setImageModal(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }))
//   const prevImage = () => setImageModal(prev => ({ ...prev, currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1 }))

//   return (
//     <div className="p-4">
//       <h2 className="text-lg font-bold mb-4">Saved Lottery Entries</h2>

//       <div className="grid grid-cols-2 gap-4 items-end mb-4">
//         <div>
//           <h3 className="text-sm font-semibold mb-2">Site</h3>
//           <SitePicker
//             value={site}
//             placeholder="Select site"
//             onValueChange={(newSite) => {
//               setSite(newSite)

//               navigate({
//                 search: (prev: LotteryListSearch) => ({
//                   ...prev,
//                   site: newSite,
//                 }),
//               })
//             }}
//           />
//         </div>
//         <div>
//           <h3 className="text-sm font-semibold mb-2">Date</h3>
//           <DatePicker
//             date={date}
//             setDate={(value) => {
//               if (typeof value === 'function') {
//                 const newDate = value(date)
//                 if (newDate) setDate(newDate)
//               } else {
//                 setDate(value)
//               }
//             }}
//           />
//         </div>
//       </div>

//       {loading ? (
//         <div className="text-center py-8">Loading...</div>
//       ) : lottery ? (
//         <div className="overflow-x-auto border rounded-md">
//           <table className="min-w-full table-auto">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-4 py-2 text-left">Description</th>
//                 <th className="px-4 py-2 text-left">Lottery Value</th>
//                 <th className="px-4 py-2 text-left">Bullock Value</th>
//                 <th className="px-4 py-2 text-left">Over / Short</th>
//               </tr>
//             </thead>
//             <tbody>
//               <tr className="border-t">
//                 <td className="px-4 py-2 font-semibold">Online Sales</td>
//                 <td className="px-4 py-2">${Number(lottery.onlineLottoTotal ?? 0).toFixed(2)}</td>
//                 <td className="px-4 py-2">{bullock ? `$${Number(bullock.onlineSales || 0).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">{bullock ? <span className={`${((lottery.onlineLottoTotal ?? 0) - ((bullock.onlineSales || 0) + (lottery.onlineCancellations || 0) + (lottery.onlineDiscounts || 0))) > 0 ? 'text-green-600' : ((lottery.onlineLottoTotal ?? 0) - ((bullock.onlineSales || 0) + (lottery.onlineCancellations || 0) + (lottery.onlineDiscounts || 0))) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number((lottery.onlineLottoTotal ?? 0) - ((bullock.onlineSales || 0) + (lottery.onlineCancellations || 0) + (lottery.onlineDiscounts || 0))).toFixed(2)}</span> : '-'}</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Lotto Cancellations</td>
//                 <td className="px-4 py-2">{lottery.onlineCancellations != null ? `$${Number(lottery.onlineCancellations).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">-</td>
//                 <td className="px-4 py-2">-</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Lotto Discounts</td>
//                 <td className="px-4 py-2">{lottery.onlineDiscounts != null ? `$${Number(lottery.onlineDiscounts).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">-</td>
//                 <td className="px-4 py-2">-</td>
//               </tr>
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Scratch Sales</td>
//                 <td className="px-4 py-2">${Number(lottery.instantLottTotal ?? 0).toFixed(2)}</td>
//                 <td className="px-4 py-2">{bullock ? `$${Number(bullock.scratchSales || 0).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">{bullock ? <span className={`${(((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)) > 0 ? 'text-green-600' : (((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number(((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)).toFixed(2)}</span> : '-'}</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Scratch Free Tickets</td>
//                 <td className="px-4 py-2">{lottery.scratchFreeTickets != null ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">-</td>
//                 <td className="px-4 py-2">-</td>
//                 {/* <td className="px-4 py-2">{bullock ? <span className={`${(((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)) > 0 ? 'text-green-600' : (((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number(((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0)) - (bullock.scratchSales || 0)).toFixed(2)}</span> : '-'}</td> */}
//               </tr>
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Payouts</td>
//                 <td className="px-4 py-2">${Number(lottery.lottoPayout ?? 0).toFixed(2)}</td>
//                 <td className="px-4 py-2">{bullock ? `$${Number(bullock.payouts || 0).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">{bullock ? <span className={`${((lottery.lottoPayout ?? 0) - (bullock.payouts || 0)) > 0 ? 'text-green-600' : ((lottery.lottoPayout ?? 0) - (bullock.payouts || 0)) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number((lottery.lottoPayout ?? 0) - (bullock.payouts || 0)).toFixed(2)}</span> : '-'}</td>
//               </tr>
//               <tr className="border-t font-semibold">
//                 <td className="px-4 py-2">Datawave Value</td>
//                 <td className="px-4 py-2">${Number(lottery.dataWave ?? 0).toFixed(2)}</td>
//                 <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWave || 0).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">{bullock ? <span className={`${((lottery.dataWave ?? 0) - (bullock.dataWave || 0)) > 0 ? 'text-green-600' : ((lottery.dataWave ?? 0) - (bullock.dataWave || 0)) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number((lottery.dataWave ?? 0) - (bullock.dataWave || 0)).toFixed(2)}</span> : '-'}</td>
//               </tr>
//               <tr className="border-t bg-gray-50">
//                 <td className="px-4 py-2 pl-8">Datawave Fee</td>
//                 <td className="px-4 py-2">${Number(lottery.feeDataWave ?? 0).toFixed(2)}</td>
//                 <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWaveFee || 0).toFixed(2)}` : '-'}</td>
//                 <td className="px-4 py-2">{bullock ? <span className={`${((lottery.feeDataWave ?? 0) - (bullock.dataWaveFee || 0)) > 0 ? 'text-green-600' : ((lottery.feeDataWave ?? 0) - (bullock.dataWaveFee || 0)) < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>${Number((lottery.feeDataWave ?? 0) - (bullock.dataWaveFee || 0)).toFixed(2)}</span> : '-'}</td>
//               </tr>
//               <tr className="border-t">
//                 <td className="px-4 py-2 font-semibold">Images</td>
//                 <td className="px-4 py-2">
//                   {Array.isArray(lottery.images) ? lottery.images.length : 0} image(s)
//                 </td>
//               </tr>
//               <tr className="border-t">
//                 <td className="px-4 py-2 font-semibold">Actions</td>
//                 <td className="px-4 py-2">
//                   <div className="flex gap-2">
//                     <Button size="sm" variant="outline" onClick={() => viewImages(lottery.images || [])}>
//                       <Eye className="h-4 w-4" /> View Images
//                     </Button>
//                     {Array.isArray(lottery.images) && lottery.images.length > 0 && (
//                       <Button size="sm" variant="outline" onClick={() => window.open(`${domain}/cdn/download/${encodeURIComponent(lottery.images[0])}`, '_blank')}>
//                         <ExternalLink className="h-4 w-4 mr-1" /> Open First
//                       </Button>
//                     )}
//                   </div>
//                 </td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       ) : (
//         <div className="p-4 bg-gray-50 rounded-md">No saved lottery entry found for this site/date.</div>
//       )}

//       {/* Image Modal */}
//       <Dialog open={imageModal.isOpen} onOpenChange={closeModal}>
//         <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
//           <DialogHeader>
//             <DialogTitle>
//               Image {imageModal.currentIndex + 1} of {imageModal.images.length}
//             </DialogTitle>
//           </DialogHeader>
//           <div className="flex flex-col items-center space-y-4 overflow-hidden">
//             <div className="relative w-full h-[60vh] flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
//               <img
//                 src={`${domain}/cdn/download/${encodeURIComponent(imageModal.images[imageModal.currentIndex])}`}
//                 alt={`Lottery image ${imageModal.currentIndex + 1}`}
//                 className="max-w-full max-h-full object-contain"
//               />
//             </div>

//             {imageModal.images.length > 1 && (
//               <div className="flex items-center gap-4">
//                 <Button onClick={prevImage} variant="outline" size="sm">
//                   <ChevronLeft className="h-4 w-4" /> Previous
//                 </Button>
//                 <span className="text-sm text-gray-600">{imageModal.currentIndex + 1} / {imageModal.images.length}</span>
//                 <Button onClick={nextImage} variant="outline" size="sm">
//                   Next <ChevronRight className="h-4 w-4" />
//                 </Button>
//               </div>
//             )}

//             <div className="flex gap-2">
//               <Button onClick={() => window.open(`${domain}/cdn/download/${encodeURIComponent(imageModal.images[imageModal.currentIndex])}`, '_blank')} variant="outline" size="sm">
//                 <ExternalLink className="h-4 w-4 mr-1" /> Open in New Tab
//               </Button>
//               <Button onClick={closeModal} variant="secondary" size="sm">Close</Button>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DatePicker } from '@/components/custom/datePicker'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { domain } from '@/lib/constants'
import { Eye, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type LotteryListSearch = {
  site?: string
  date?: string // YYYY-MM-DD
}

type LoaderData = {
  lottery: any | null
  totals: Record<string, number> | null
  error?: string | null
  status?: number | null
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
  // Interpret as local date at midnight to avoid TZ shifts in picker
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery-list')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): LotteryListSearch => ({
    site: search.site as string | undefined,
    date: typeof search.date === 'string' ? (search.date as string) : undefined,
  }),
  loaderDeps: ({ search: { site, date } }) => ({ site: site || '', date: date || '' }),
  loader: async ({ deps: { site, date } }): Promise<LoaderData> => {
    if (!site || !date) return { lottery: null, totals: null, error: null, status: null }
    try {
      const token = localStorage.getItem('token') || ''
      const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Required-Permission': 'accounting.lotteryList',
        },
      })

      if (resp.status === 403) {
        return { lottery: null, totals: null, error: 'forbidden', status: 403 }
      }

      if (!resp.ok) {
        return { lottery: null, totals: null, error: `HTTP ${resp.status}`, status: resp.status }
      }

      const data = await resp.json()
      return {
        lottery: data?.lottery ?? null,
        totals: data?.totals ?? null,
        error: null,
        status: 200,
      }
    } catch (e) {
      return { lottery: null, totals: null, error: 'network', status: null }
    }
  },
})

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { user } = useAuth()

  const { site: siteFromUrl, date: dateFromUrl } = Route.useSearch()
  const { lottery, totals: bullock, error, status } = Route.useLoaderData() as LoaderData

  // Default site from user.location if missing
  useEffect(() => {
    if (!siteFromUrl && user?.location) {
      navigate({
        search: (prev: LotteryListSearch) => ({
          ...prev,
          site: user.location,
        }),
        replace: true,
      })
    }
  }, [siteFromUrl, user, navigate])

  // Default date to today if missing
  useEffect(() => {
    if (!dateFromUrl) {
      navigate({
        search: (prev: LotteryListSearch) => ({
          ...prev,
          date: toYmd(new Date()),
        }),
        replace: true,
      })
    }
  }, [dateFromUrl, navigate])

  const dateAsDate = parseYmdToDate(dateFromUrl)

  // Image modal state
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    images: string[]
    currentIndex: number
  }>({ isOpen: false, images: [], currentIndex: 0 })

  const viewImages = (images: string[]) => {
    if (!images || images.length === 0) {
      alert('No images attached')
      return
    }
    setImageModal({ isOpen: true, images, currentIndex: 0 })
  }

  const closeModal = () => setImageModal({ isOpen: false, images: [], currentIndex: 0 })
  const nextImage = () =>
    setImageModal((prev) => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }))
  const prevImage = () =>
    setImageModal((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1,
    }))

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Saved Lottery Entries</h2>

      <div className="grid grid-cols-2 gap-4 items-end mb-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Site</h3>
          <SitePicker
            value={siteFromUrl || ''}
            placeholder="Select site"
            onValueChange={(newSite) => {
              navigate({
                search: (prev: LotteryListSearch) => ({
                  ...prev,
                  site: newSite,
                }),
              })
            }}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Date</h3>
          <DatePicker
            date={dateAsDate}
            setDate={(value) => {
              const next =
                typeof value === 'function' ? value(dateAsDate) : value
              navigate({
                search: (prev: LotteryListSearch) => ({
                  ...prev,
                  date: next ? toYmd(next) : undefined,
                }),
              })
            }}
          />
        </div>
      </div>

      {status === 403 ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          You don’t have access to view lottery entries.
        </div>
      ) : lottery ? (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Lottery Value</th>
                <th className="px-4 py-2 text-left">Bulloch Value</th>
                <th className="px-4 py-2 text-left">Over / Short</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t  font-semibold">
                <td className="px-4 py-2">Online Sales</td>
                <td className="px-4 py-2">${Number(lottery.onlineLottoTotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.onlineSales || 0).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">
                  {bullock ? (
                    <span
                      className={`${(((bullock.onlineSales || 0) - ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations || 0) - (lottery.onlineDiscounts || 0)))) > 0
                        ? 'text-green-600'
                        : (((bullock.onlineSales || 0) - ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations || 0) - (lottery.onlineDiscounts || 0)))) < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                        }`}
                    >
                      $
                      {Number(
                        (((bullock.onlineSales || 0) - ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations || 0) - (lottery.onlineDiscounts || 0))))
                      ).toFixed(2)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Lotto Cancellations</td>
                <td className="px-4 py-2">
                  {lottery.onlineCancellations != null ? `$${Number(lottery.onlineCancellations).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2">-</td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Lotto Discounts</td>
                <td className="px-4 py-2">
                  {lottery.onlineDiscounts != null ? `$${Number(lottery.onlineDiscounts).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2">-</td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Scratch Sales</td>
                <td className="px-4 py-2">${Number(lottery.instantLottTotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.scratchSales || 0).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">
                  {bullock ? (
                    <span
                      className={`${((bullock.scratchSales || 0) - ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0))) > 0
                        ? 'text-green-600'
                        : ((bullock.scratchSales || 0) - ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0))) < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                        }`}
                    >
                      $
                      {Number(
                        ((bullock.scratchSales || 0) - ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0))),
                      ).toFixed(2)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Scratch Free Tickets</td>
                <td className="px-4 py-2">
                  {lottery.scratchFreeTickets != null ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2">-</td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Payouts</td>
                <td className="px-4 py-2">${Number(lottery.lottoPayout ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.payouts || 0).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">
                  {bullock ? (
                    <span
                      className={`${((bullock.payouts || 0) - ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets ?? 0))) > 0
                        ? 'text-green-600'
                        : ((bullock.payouts || 0) - ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets ?? 0))) < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                        }`}
                    >
                      ${Number((bullock.payouts || 0) - ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets ?? 0))).toFixed(2)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Scratch Free Tickets Payouts</td>
                <td className="px-4 py-2">
                  {lottery.scratchFreeTickets != null ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2">-</td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="px-4 py-2">Datawave Value</td>
                <td className="px-4 py-2">${Number(lottery.dataWave ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWave || 0).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">
                  {bullock ? (
                    <span
                      className={`${((bullock.dataWave || 0) - (lottery.dataWave ?? 0)) > 0
                        ? 'text-green-600'
                        : ((bullock.dataWave || 0) - (lottery.dataWave ?? 0)) < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                        }`}
                    >
                      ${Number((bullock.dataWave || 0) - (lottery.dataWave ?? 0)).toFixed(2)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="px-4 py-2 pl-8">Datawave Fee</td>
                <td className="px-4 py-2">${Number(lottery.feeDataWave ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWaveFee || 0).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">
                  {bullock ? (
                    <span
                      className={`${((bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0)) > 0
                        ? 'text-green-600'
                        : ((bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0)) < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                        }`}
                    >
                      ${Number((bullock.dataWaveFee || 0) - (lottery.feeDataWave ?? 0)).toFixed(2)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-semibold">Images</td>
                <td className="px-4 py-2">
                  {Array.isArray(lottery.images) ? lottery.images.length : 0} image(s)
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-semibold">Actions</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => viewImages(lottery.images || [])}>
                      <Eye className="h-4 w-4" /> View Images
                    </Button>
                    {Array.isArray(lottery.images) && lottery.images.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(
                            `${domain}/cdn/download/${encodeURIComponent(lottery.images[0])}`,
                            '_blank',
                          )
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open First
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-md">
          {error ? 'Failed to load lottery entry.' : 'No saved lottery entry found for this site/date.'}
        </div>
      )}

      <Dialog open={imageModal.isOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Image {imageModal.currentIndex + 1} of {imageModal.images.length}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 overflow-hidden">
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
              <img
                src={`${domain}/cdn/download/${encodeURIComponent(imageModal.images[imageModal.currentIndex])}`}
                alt={`Lottery image ${imageModal.currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {imageModal.images.length > 1 && (
              <div className="flex items-center gap-4">
                <Button onClick={prevImage} variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-gray-600">
                  {imageModal.currentIndex + 1} / {imageModal.images.length}
                </span>
                <Button onClick={nextImage} variant="outline" size="sm">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() =>
                  window.open(`${domain}/cdn/download/${encodeURIComponent(imageModal.images[imageModal.currentIndex])}`, '_blank')
                }
                variant="outline"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-1" /> Open in New Tab
              </Button>
              <Button onClick={closeModal} variant="secondary" size="sm">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}