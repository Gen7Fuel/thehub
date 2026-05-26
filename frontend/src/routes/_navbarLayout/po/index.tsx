import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { useFormStore } from '@/store'
import axios from 'axios'
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import { domain } from '@/lib/constants'
import { Camera, ExternalLink } from 'lucide-react'

interface Product {
  _id: string
  code: string
  description: string
}

interface ArCustomer {
  _id: string
  name: string
}

async function loader() {
  try {
    // add authorization header with bearer token
    const token = localStorage.getItem('token')
    const response = await axios.get(`${domain}/api/products`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const products: Product[] = response.data

    return { products }
  } catch (error) {
    return { products: [] }
  }
}

export const Route = createFileRoute('/_navbarLayout/po/')({
  loader,
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const [numberType, setNumberType] = useState<'fleet' | 'po'>('po') // dropdown selection

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber)
  const setFleetCardNumber = useFormStore((state) => state.setFleetCardNumber)

  const date = useFormStore((state) => state.date)
  const setDate = useFormStore((state) => state.setDate)

  // Removed LocationPicker and stationName state
  const poNumber = useFormStore((state) => state.poNumber) // new state for PO number
  const setPoNumber = useFormStore((state) => state.setPoNumber)

  const customerName = useFormStore((state) => state.customerName)
  const setCustomerName = useFormStore((state) => state.setCustomerName)

  const driverName = useFormStore((state) => state.driverName)
  const setDriverName = useFormStore((state) => state.setDriverName)

  const vehicleInfo = useFormStore((state) => state.vehicleInfo)
  const setVehicleInfo = useFormStore((state) => state.setVehicleInfo)

  const quantity = useFormStore((state) => state.quantity)
  const setQuantity = useFormStore((state) => state.setQuantity)

  const amount = useFormStore((state) => state.amount)
  const setAmount = useFormStore((state) => state.setAmount)

  const fuelType = useFormStore((state) => state.fuelType)
  const setFuelType = useFormStore((state) => state.setFuelType)

  const receipt = useFormStore((state) => state.receipt)
  const setReceipt = useFormStore((state) => state.setReceipt)

  const data = Route.useLoaderData()
  const stationName = useFormStore((state) => state.stationName)
  const setStationName = useFormStore((state) => state.setStationName)

  const [poError, setPoError] = useState<string>('')
  const [cardStatus, setCardStatus] = useState<string | null>(null)
  const [arCustomers, setArCustomers] = useState<ArCustomer[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerNameRef = useRef<HTMLDivElement>(null)

  const statusConfig: Record<string, { label: string; className: string }> = {
    active:    { label: 'Active',         className: 'text-green-600' },
    inactive:  { label: 'Inactive',       className: 'text-orange-500' },
    lost:      { label: 'Lost',           className: 'text-red-600' },
    stolen:    { label: 'Stolen',         className: 'text-red-600' },
    cancelled: { label: 'Cancelled',      className: 'text-gray-500' },
    not_found: { label: 'Card not found', className: 'text-red-600' },
  }

  const handleBlur = async () => {
    if (numberType !== 'fleet') return // only for fleet cards

    const token = localStorage.getItem('token')
    const response = await axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { stationName },
    })
    const data = response.data

    if (data.message) {
      setCustomerName('')
      setDriverName('')
      setVehicleInfo('')
    } else {
      setCustomerName(data.customerName)
      setDriverName(data.driverName)
      setVehicleInfo(data.vehicleMakeModel)
    }
  }

  useEffect(() => {
    const site = selectedSite || user?.location
    if (site) setStationName(site)
    // Set default fuel type to 'Regular' if not already set
    if (!fuelType && data.products && data.products.length > 0) {
      const regular = data.products.find((p: { description: string }) => p.description.toLowerCase().includes('regular'));
      if (regular) setFuelType(regular.code);
    }
  }, [selectedSite, user?.location, setStationName, fuelType, setFuelType, data.products]);

  useEffect(() => {
    const token = localStorage.getItem('token')
    Promise.resolve(
      axios.get(`${domain}/api/ar-customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then((res) => {
      if (Array.isArray(res?.data)) setArCustomers(res.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerNameRef.current && !customerNameRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Helpers for 5-digit numeric PO input
  const toFiveDigits = (s: string) => {
    // keep only digits, max length 5 without regex to avoid parser quirks
    let out = ''
    for (let i = 0; i < s.length && out.length < 5; i++) {
      const ch = s[i]
      const code = ch.charCodeAt(0)
      if (code >= 48 && code <= 57) out += ch
    }
    return out
  }
  const padFive = (s: string) => {
    const d = toFiveDigits(s)
    if (d.length >= 5) return d.slice(0, 5)
    return ('00000' + d).slice(-5)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceipt(reader.result as string);
        navigate({ to: '/po/receipt' });
      };
      reader.readAsDataURL(file);
    }
  };

  // Only show number type and PO/fleet fields if not Charlie's
  const isCharlies = stationName && stationName.trim().toLowerCase() === "charlies";

  const customerSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase()
    if (!q || !Array.isArray(arCustomers)) return []
    return arCustomers.filter((c) => c.name?.toLowerCase().includes(q))
  }, [customerName, arCustomers])

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Location Picker */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Select Site</h2>
        <LocationPicker
          setStationName={(value) => setStationName(typeof value === 'string' ? value : '')}
          value="stationName"
        />
      </div>

      {/* Only show number type and PO/fleet fields if not Charlie's */}
      {!isCharlies && (
        <>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Select Number Type</h2>
            <Select value={numberType} onValueChange={(value) => setNumberType(value as 'fleet' | 'po')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Number Type</SelectLabel>
                  <SelectItem value="fleet">Fleet Card Number</SelectItem>
                  <SelectItem value="po">PO Number</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {/* Conditional Number Input */}
          {numberType === 'fleet' ? (
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Fleet Card Number</h2>
              <InputOTP
                maxLength={16}
                name="fleetCardNumber"
                value={fleetCardNumber}
                onChange={async (value) => {
                  setFleetCardNumber(value)
                  if (value.length === 16) {
                    try {
                      const token = localStorage.getItem('token')
                      const res = await axios.get(`${domain}/api/fleet/verify/${value}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      setCardStatus(res.data.reason || res.data.status || 'not_found')
                    } catch {
                      setCardStatus('not_found')
                    }
                  } else {
                    setCardStatus(null)
                  }
                }}
                onBlur={handleBlur}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[4, 5, 6, 7].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[8, 9, 10, 11].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {[12, 13, 14, 15].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {cardStatus && (() => {
                const cfg = statusConfig[cardStatus] ?? { label: cardStatus, className: 'text-gray-500' }
                return <div className={`text-xs text-right ${cfg.className}`}>{cfg.label}</div>
              })()}
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-bold">PO Number</h2>
              <InputOTP
                maxLength={5}
                name="poNumber"
                value={toFiveDigits(poNumber)}
                onChange={(value) => {
                  setPoNumber(toFiveDigits(value))
                  if (poError) setPoError('')
                }}
                onBlur={async () => {
                  const padded = padFive(poNumber)
                  setPoNumber(padded)
                  if (!stationName || !padded) return
                  try {
                    const res = await axios.get('/api/purchase-orders/unique', {
                      params: { stationName, poNumber: padded },
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                        'X-Required-Permission': 'po',
                      },
                    })
                    if (res.data && res.data.unique === false) {
                      setPoError('This PO number has already been used for this site.')
                    } else {
                      setPoError('')
                    }
                  } catch (e: any) {
                    // non-fatal; show message and allow save to handle server-side conflict
                    setPoError(e?.response?.data?.message || 'Could not validate PO number uniqueness')
                  }
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {poError && (
                <div className="text-xs text-red-600">{poError}</div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-row items-end gap-4">
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Date</h2>
          <DatePicker
            date={date}
            setDate={(value) => {
              if (typeof value === 'function') {
                const newDate = value(date);
                if (newDate) setDate(newDate);
              } else {
                setDate(value);
              }
            }}
          />
        </div>
      </div>

      {/* Customer and Driver Info */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Customer and Driver Information</h2>
        <div ref={customerNameRef} className="relative">
          <Input
            type="text"
            name="customerName"
            placeholder="Customer Name"
            value={customerName}
            autoComplete="off"
            onChange={(e) => {
              setCustomerName(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && customerSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
              {customerSuggestions.map((c) => (
                <li
                  key={c._id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  onMouseDown={() => {
                    setCustomerName(c.name)
                    setShowSuggestions(false)
                  }}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Input
          type="text"
          name="driverName"
          placeholder="Driver Name"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
        />
        <Input
          type="text"
          name="vehicleInfo"
          placeholder="Vehicle Info"
          value={vehicleInfo}
          onChange={(e) => setVehicleInfo(e.target.value)}
        />
      </div>

      {/* Fuel Type */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Fuel Type</h2>
        <Select name="fuelType" value={fuelType} onValueChange={(value) => setFuelType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fuel Grades</SelectLabel>
              {data.products.map((product: Product) => (
                <SelectItem key={product._id} value={product.code}>
                  {product.description}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Quantity & Amount */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Quantity and Amount</h2>
        <Input
          type="number"
          name="quantity"
          placeholder="Quantity (Liters)"
          value={quantity === 0 ? '' : quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        <Input
          type="number"
          name="amount"
          placeholder="Amount (CAD)"
          value={amount === 0 ? '' : amount}
          onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </div>

      {/* Navigation
      <div className="flex justify-end">
        <Link to="/po/receipt">
          <Button
            variant="outline"
            onClick={() => {
              if (!isCharlies) setPoNumber(padFive(poNumber));
            }}
            disabled={!isCharlies && !!poError}
          >
            Next
          </Button>
        </Link>
      </div> */}
      <div className="flex justify-end">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleCapture}
        />

        {receipt ? (
          // If image exists, just go to preview
          <Link to="/po/receipt">
            <Button className="bg-slate-800 hover:bg-slate-900 text-white">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Captured Receipt
            </Button>
          </Link>
        ) : (
          // If no image, trigger camera
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              if (!isCharlies) setPoNumber(padFive(poNumber));
              fileInputRef.current?.click();
            }}
            disabled={(!isCharlies && !!poError) || !customerName || !driverName || quantity === 0}
          >
            <Camera className="mr-2 h-4 w-4" />
            Upload Receipt
          </Button>
        )}
      </div>
    </div>
  )
}