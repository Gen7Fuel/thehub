import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DatePicker } from '@/components/custom/datePicker'
import { SitePicker } from '@/components/custom/sitePicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { domain } from '@/lib/constants'
import { Eye, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery-list')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [site, setSite] = useState<string>(user?.location || '')
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [loading, setLoading] = useState(false)
  const [lottery, setLottery] = useState<any | null>(null)
  const [bullock, setBullock] = useState<Record<string, number> | null>(null)

  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    images: string[]
    currentIndex: number
  }>({ isOpen: false, images: [], currentIndex: 0 })

  const toYmd = (d?: Date) => {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  useEffect(() => {
    if (!user?.location) return
    setSite(user.location)
  }, [user])

  useEffect(() => {
    const ymd = toYmd(date)
    if (!site || !ymd) return

    const controller = new AbortController()
    ;(async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(ymd)}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (resp.status === 403) {
          navigate({ to: '/no-access' })
          return
        }

        if (!resp.ok) {
          setLottery(null)
          return
        }

        const data = await resp.json()
        setLottery(data?.lottery ?? null)
        setBullock(data?.totals ?? null)
      } catch (e) {
        if ((e as any).name !== 'AbortError') console.warn('Lottery list fetch failed', e)
        setLottery(null)
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [site, date, navigate])

  const viewImages = (images: string[]) => {
    if (!images || images.length === 0) {
      alert('No images attached')
      return
    }

    setImageModal({ isOpen: true, images, currentIndex: 0 })
  }

  const closeModal = () => setImageModal({ isOpen: false, images: [], currentIndex: 0 })
  const nextImage = () => setImageModal(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length }))
  const prevImage = () => setImageModal(prev => ({ ...prev, currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1 }))

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Saved Lottery Entries</h2>

      <div className="grid grid-cols-2 gap-4 items-end mb-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Site</h3>
          <SitePicker value={site} onValueChange={(v) => setSite(v)} placeholder="Select site" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Date</h3>
          <DatePicker
            date={date}
            setDate={(value) => {
              if (typeof value === 'function') {
                const newDate = value(date)
                if (newDate) setDate(newDate)
              } else {
                setDate(value)
              }
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : lottery ? (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Lottery Value</th>
                  <th className="px-4 py-2 text-left">Bullock Value</th>
                </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-2">Online Sales</td>
                <td className="px-4 py-2">${Number(lottery.onlineLottoTotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.onlineSales || 0).toFixed(2)}` : '-'}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Scratch Sales</td>
                <td className="px-4 py-2">${Number(lottery.instantLottTotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.scratchSales || 0).toFixed(2)}` : '-'}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Scratch Free Tickets</td>
                <td className="px-4 py-2">{lottery.scratchFreeTickets != null ? `$${Number(lottery.scratchFreeTickets).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-2">-</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Payouts</td>
                <td className="px-4 py-2">${Number(lottery.lottoPayout ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.payouts || 0).toFixed(2)}` : '-'}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Datawave Value</td>
                <td className="px-4 py-2">${Number(lottery.dataWave ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWave || 0).toFixed(2)}` : '-'}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Datawave Fee</td>
                <td className="px-4 py-2">${Number(lottery.feeDataWave ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{bullock ? `$${Number(bullock.dataWaveFee || 0).toFixed(2)}` : '-'}</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Images</td>
                <td className="px-4 py-2">
                  {Array.isArray(lottery.images) ? lottery.images.length : 0} image(s)
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2">Actions</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => viewImages(lottery.images || [])}>
                      <Eye className="h-4 w-4" /> View Images
                    </Button>
                    {Array.isArray(lottery.images) && lottery.images.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => window.open(`${domain}/cdn/download/${encodeURIComponent(lottery.images[0])}`, '_blank')}>
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
        <div className="p-4 bg-gray-50 rounded-md">No saved lottery entry found for this site/date.</div>
      )}

      {/* Image Modal */}
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
                <span className="text-sm text-gray-600">{imageModal.currentIndex + 1} / {imageModal.images.length}</span>
                <Button onClick={nextImage} variant="outline" size="sm">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => window.open(`${domain}/cdn/download/${encodeURIComponent(imageModal.images[imageModal.currentIndex])}`, '_blank')} variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" /> Open in New Tab
              </Button>
              <Button onClick={closeModal} variant="secondary" size="sm">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
