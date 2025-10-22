import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
import type { DateRange } from "react-day-picker"
import { LocationPicker } from '@/components/custom/locationPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getStartAndEndOfToday, toUTC } from '@/lib/utils'
import { domain } from '@/lib/constants'
import { Eye, Trash2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import axios from "axios"
import { useAuth } from "@/context/AuthContext";

interface Payable {
  _id: string
  vendorName: string
  location: {
    _id: string
    stationName: string
    csoCode: string
  }
  notes: string
  paymentMethod: string
  amount: number
  images: string[]
  createdAt: string
}

export const Route = createFileRoute('/_navbarLayout/payables/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const { start, end } = getStartAndEndOfToday()
  const [date, setDate] = useState<DateRange | undefined>({
    from: start,
    to: end,
  })
  const { user } = useAuth()
  const access = user?.access || '{}'
  
  const [location, setLocation] = useState<string>(user?.location || "")
  const [timezone, setTimezone] = useState<string>(user?.timezone || "America/Toronto")
  const [payables, setPayables] = useState<Payable[]>([])
  const [loading, setLoading] = useState(false)

  // Image modal state
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    images: string[]
    currentIndex: number
  }>({
    isOpen: false,
    images: [],
    currentIndex: 0
  })

  timezone

  const fetchPayables = async () => {
    if (!date?.from || !date?.to || !location) return

    setLoading(true)
    try {
      // Get location ID from location name

      // add authorization header with bearer token
      const token = localStorage.getItem('token')
      const locationsResponse = await axios.get(`${domain}/api/locations`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const locations = locationsResponse.data
      const selectedLocation = locations.find((loc: any) => loc.stationName === location)

      if (!selectedLocation) {
        console.error('Location not found:', location)
        setPayables([])
        return
      }

      const queryParams = new URLSearchParams({
        location: selectedLocation._id,
        date: toUTC(date.from).toISOString().split('T')[0]
      })

      console.log('Fetching payables with params:', queryParams.toString())

      // add authorization header with bearer token
      const response = await axios.get(`${domain}/api/payables?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const data = response.data

      console.log('API response:', data)

      if (Array.isArray(data)) {
        setPayables(data)
      } else {
        console.error('API returned non-array data:', data)
        setPayables([])
      }
    } catch (error) {
      console.error("Error fetching payables:", error)
      setPayables([])
    } finally {
      setLoading(false)
    }
  }

  const deletePayable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payable?')) return

    try {
      // add authorization header with bearer token
      const token = localStorage.getItem('token')
      const response = await axios.delete(`${domain}/api/payables/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (response.status === 200) {
        setPayables(payables.filter(p => p._id !== id))
      } else {
        alert('Error deleting payable')
      }
    } catch (error) {
      console.error("Error deleting payable:", error)
      alert('Error deleting payable')
    }
  }

  const viewImages = (images: string[]) => {
    if (images.length === 0) {
      alert('No images attached')
      return
    }
    
    setImageModal({
      isOpen: true,
      images,
      currentIndex: 0
    })
  }

  const closeModal = () => {
    setImageModal({
      isOpen: false,
      images: [],
      currentIndex: 0
    })
  }

  const nextImage = () => {
    setImageModal(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.images.length
    }))
  }

  const prevImage = () => {
    setImageModal(prev => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1
    }))
  }

  const paymentMethodLabels = {
    safe: 'Safe',
    till: 'Till',
    cheque: 'Cheque',
    on_account: 'On Account',
    other: 'Other'
  }

  useEffect(() => {
    fetchPayables()
  }, [date, location])

  const totalAmount = Array.isArray(payables) ? payables.reduce((sum, payable) => sum + payable.amount, 0) : 0

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md">
      <h2 className="text-lg font-bold mb-2">Payables List</h2>

      <div className="flex justify-around gap-4 border-t border-dashed border-gray-300 mt-4 pt-4">
        <DatePickerWithRange date={date} setDate={setDate} />
        <LocationPicker
          setStationName={setLocation}
          setTimezone={setTimezone}
          value="stationName"
          disabled={!access.component_payables_list_location_filter}
        />
      </div>

      {/* Summary */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Entries: {payables.length}</span>
          <span className="font-semibold">Total Amount: ${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <table className="table-auto w-full border-collapse border-0 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Date</th>
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Vendor</th>
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Payment Method</th>
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount</th>
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Images</th>
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payables.length > 0 ? (
              payables.map((payable) => (
                <tr key={payable._id} className="hover:bg-gray-50">
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    {new Date(payable.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    {payable.vendorName}
                  </td>
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    {paymentMethodLabels[payable.paymentMethod as keyof typeof paymentMethodLabels]}
                  </td>
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    ${payable.amount.toFixed(2)}
                  </td>
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    {payable.images.length} image(s)
                  </td>
                  <td className="border-dashed border-t border-gray-300 px-4 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewImages(payable.images)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deletePayable(payable._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border-dashed border-t border-gray-300 px-4 py-2 text-center">
                  No payables found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            {/* Image Container */}
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
              <img 
                src={`${domain}/cdn/download/${imageModal.images[imageModal.currentIndex]}`}
                alt={`Payable document ${imageModal.currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            
            {/* Navigation Controls */}
            {imageModal.images.length > 1 && (
              <div className="flex items-center gap-4">
                <Button onClick={prevImage} variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  {imageModal.currentIndex + 1} / {imageModal.images.length}
                </span>
                <Button onClick={nextImage} variant="outline" size="sm">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={() => window.open(`${domain}/cdn/download/${imageModal.images[imageModal.currentIndex]}`, '_blank')}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
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