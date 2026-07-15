import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import type { DateRange } from 'react-day-picker'
import { LocationPicker } from '@/components/custom/locationPicker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getStartAndEndOfToday } from '@/lib/utils'
import { format } from 'date-fns'
import { domain } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { Plus, ImageIcon } from 'lucide-react'
import axios from 'axios'

interface ATMRecord {
  _id: string
  date: string
  amount: number
  source: 'till' | 'safe'
  image: string | null
  stationName: string
  site?: string
  createdBy: string
  createdAt: string
}

export const Route = createFileRoute('/_navbarLayout/atm/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const { start, end } = getStartAndEndOfToday()
  const { user } = useAuth()
  const { selectedSite } = useSite()

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: start, to: end })
  const [location, setLocation] = useState<string>(selectedSite || user?.location || '')
  const [records, setRecords] = useState<ATMRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [imageModal, setImageModal] = useState<{ open: boolean; src: string }>({
    open: false,
    src: '',
  })

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params: Record<string, string> = {}
      if (location) params.stationName = location
      if (dateRange?.from) params.startDate = format(dateRange.from, 'yyyy-MM-dd')
      if (dateRange?.to) params.endDate = format(dateRange.to, 'yyyy-MM-dd')

      const res = await axios.get(`${domain}/api/atm`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      setRecords(res.data)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [location, dateRange])

  useEffect(() => {
    const site = selectedSite || user?.location
    if (site) setLocation(site)
  }, [selectedSite, user?.location])

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        <LocationPicker
          setStationName={setLocation as React.Dispatch<React.SetStateAction<string>>}
          value="stationName"
        />
        <Link to="/atm">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Record
          </Button>
        </Link>
      </div>

      {/* Summary */}
      {records.length > 0 && (
        <div className="text-sm text-gray-600">
          {records.length} record{records.length !== 1 ? 's' : ''} — Total loaded:{' '}
          <span className="font-semibold text-gray-900">
            ${totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Station</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Source</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Recorded By</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Doc</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center px-4 py-8 text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center px-4 py-8 text-gray-400">
                  No records found.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{record.date}</td>
                  <td className="px-4 py-3">{record.site ?? record.stationName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        record.source === 'safe'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {record.source === 'safe' ? 'Safe' : 'Till'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${record.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{record.createdBy || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {record.image ? (
                      <button
                        onClick={() =>
                          setImageModal({ open: true, src: `/cdn/download/${record.image}` })
                        }
                        className="text-blue-600 hover:text-blue-800"
                        title="View document"
                      >
                        <ImageIcon className="h-4 w-4 mx-auto" />
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Image modal */}
      <Dialog open={imageModal.open} onOpenChange={(open) => setImageModal({ open, src: '' })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supporting Document</DialogTitle>
          </DialogHeader>
          <img
            src={imageModal.src}
            alt="Supporting document"
            className="w-full rounded-md object-contain max-h-[70vh]"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
