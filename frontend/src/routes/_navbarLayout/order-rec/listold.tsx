import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { DatePicker } from '@/components/custom/datePicker'
import { LocationPicker } from '@/components/custom/locationPicker'
import { VendorPicker } from '@/components/custom/vendorPicker'
import { Button } from '@/components/ui/button'
import { toUTC } from '@/lib/utils'

export const Route = createFileRoute('/_navbarLayout/order-rec/listold')({
  component: RouteComponent,
})

async function fetchOrderRecs(location: string, vendor: string, date: Date | undefined, setOrderRecs: (data: any[]) => void, setError: (msg: string) => void, setLoading: (loading: boolean) => void) {
  setLoading(true)
  try {
    const params: any = { site: location }
    if (vendor) params.vendor = vendor
    if (date) params.date = toUTC(date).toISOString().split('T')[0]
    // add authorization header with bearer token
    const token = localStorage.getItem('token')
    const res = await axios.get('/api/order-rec', {
      params,
      headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      },
    })
    setOrderRecs(res.data)
  } catch (err) {
    setError('Failed to fetch order recs')
  } finally {
    setLoading(false)
  }
}

function RouteComponent() {
  const [orderRecs, setOrderRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [location, setLocation] = useState<string>(localStorage.getItem('location') || '')
  const [vendor, setVendor] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (location) {
      fetchOrderRecs(location, showAdvanced ? vendor : '', showAdvanced ? date : undefined, setOrderRecs, setError, setLoading)
    }
  }, [date, location, vendor, showAdvanced])

  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Order Reconciliation Files</h1>
        <Button
          variant={showAdvanced ? "default" : "outline"}
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? "Hide Advanced Filter" : "Advanced Filter"}
        </Button>
      </div>
      <div className="mb-4 flex gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">Site</label>
          <LocationPicker value='stationName' setStationName={setLocation} />
        </div>
        {showAdvanced && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <DatePicker date={date} setDate={setDate} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vendor</label>
              <VendorPicker value={vendor} setVendor={setVendor} />
            </div>
          </>
        )}
      </div>
      {orderRecs.length === 0 ? (
        <div>No order reconciliation files found.</div>
      ) : (
        <ul className="space-y-4">
          {orderRecs.map(rec => (
            <li key={rec._id} className="border rounded p-0 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between">
              <Link
                to="/order-rec/$id"
                params={{ id: rec._id }}
                className="block p-4 flex-1"
                style={{ textDecoration: 'none' }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{rec.filename}</div>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs font-semibold
                      ${rec.completed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'}
                    `}
                  >
                    {rec.completed ? 'Completed' : 'Incomplete'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Uploaded: {new Date(rec.createdAt).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Uploaded by: {rec.email || "Unknown"}
                </div>
                <div className="text-sm">Categories: {rec.categories.length}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}