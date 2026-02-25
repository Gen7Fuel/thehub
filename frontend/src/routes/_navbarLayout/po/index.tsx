import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { useFormStore } from '@/store'
import axios from 'axios'
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import { domain } from '@/lib/constants'

interface Product {
  _id: string
  code: string
  description: string
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

  const data = Route.useLoaderData()
  const stationName = useFormStore((state) => state.stationName)
  const setStationName = useFormStore((state) => state.setStationName)

  const [poError, setPoError] = useState<string>('')

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
    if (!stationName && user?.location) {
      setStationName(user.location);
    }
    // Set default fuel type to 'Regular' if not already set
    if (!fuelType && data.products && data.products.length > 0) {
      const regular = data.products.find((p: { description: string }) => p.description.toLowerCase().includes('regular'));
      if (regular) setFuelType(regular.code);
    }
  }, [stationName, user?.location, setStationName, fuelType, setFuelType, data.products]);

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


  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Location Picker */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Select Site</h2>
        <LocationPicker
          setStationName={(value) => setStationName(typeof value === 'string' ? value : '')}
          value="stationName"
            defaultValue={user?.location}
        />
      </div>

      {/* Number Type Dropdown */}
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
            onChange={(value) => setFleetCardNumber(value)}
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
        <Input
          type="text"
          name="customerName"
          placeholder="Customer Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
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

      {/* Navigation */}
      <div className="flex justify-end">
        <Link to="/po/receipt">
          <Button
            variant="outline"
            onClick={() => setPoNumber(padFive(poNumber))}
            disabled={!!poError}
          >
            Next
          </Button>
        </Link>
      </div>
    </div>
  )
}