import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface QuickSelectCustomer {
  _id: string
  name: string
  fleetCardNumber: string
  label?: string
  order: number
}

const PRODUCTS_CACHE_KEY = 'po_cachedProducts'

// Sites with no PO Number / Fleet Card concept — the Number section is hidden
// entirely and neither field is submitted with the purchase order.
const NO_PO_NUMBER_SITES = ['Rankin', 'Sarnia', 'Walpole', 'Jocko Point']

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
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products))

    return { products }
  } catch (error) {
    // Offline (or request failed) — fall back to whatever we last fetched
    // successfully, so the fuel grade dropdown isn't empty while offline.
    try {
      const cached = localStorage.getItem(PRODUCTS_CACHE_KEY)
      return { products: cached ? JSON.parse(cached) : [] }
    } catch {
      return { products: [] }
    }
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

  const licensePlate = useFormStore((state) => state.licensePlate)
  const setLicensePlate = useFormStore((state) => state.setLicensePlate)

  const quantity = useFormStore((state) => state.quantity)
  const setQuantity = useFormStore((state) => state.setQuantity)

  const amount = useFormStore((state) => state.amount)
  const setAmount = useFormStore((state) => state.setAmount)

  const fuelType = useFormStore((state) => state.fuelType)
  const setFuelType = useFormStore((state) => state.setFuelType)

  const purchaseType = useFormStore((state) => state.purchaseType)
  const setPurchaseType = useFormStore((state) => state.setPurchaseType)

  const itemsDescription = useFormStore((state) => state.itemsDescription)
  const setItemsDescription = useFormStore((state) => state.setItemsDescription)

  const receipt = useFormStore((state) => state.receipt)
  const setReceipt = useFormStore((state) => state.setReceipt)

  const data = Route.useLoaderData()
  const stationName = useFormStore((state) => state.stationName)
  const setStationName = useFormStore((state) => state.setStationName)
  const isNoPoNumberSite = NO_PO_NUMBER_SITES.includes(stationName)

  const [poError, setPoError] = useState<string>('')
  const [cardStatus, setCardStatus] = useState<string | null>(null)
  const [arCustomers, setArCustomers] = useState<ArCustomer[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const customerNameRef = useRef<HTMLDivElement>(null)
  const [quickSelectCustomers, setQuickSelectCustomers] = useState<QuickSelectCustomer[]>([])
  const [selectedQuickCustomerId, setSelectedQuickCustomerId] = useState<string | null>(null)

  const statusConfig: Record<string, { label: string; className: string }> = {
    active:    { label: 'Active',         className: 'text-green-600' },
    inactive:  { label: 'Inactive',       className: 'text-orange-500' },
    lost:      { label: 'Lost',           className: 'text-red-600' },
    stolen:    { label: 'Stolen',         className: 'text-red-600' },
    cancelled: { label: 'Cancelled',      className: 'text-gray-500' },
    not_found: { label: 'Card not found', className: 'text-red-600' },
    offline:   { label: 'Offline — will verify when synced', className: 'text-amber-600' },
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
      setLicensePlate('')
    } else {
      setCustomerName(data.customerName)
      setDriverName(data.driverName)
      setVehicleInfo(data.vehicleMakeModel)
      setLicensePlate(data.numberPlate ?? '')
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
    if (!stationName) { setQuickSelectCustomers([]); return }
    const token = localStorage.getItem('token')
    axios.get(`${domain}/api/ar-customers/quick-select`, {
      params: { stationName },
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (Array.isArray(res?.data)) setQuickSelectCustomers(res.data)
    }).catch(() => setQuickSelectCustomers([]))
  }, [stationName])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerNameRef.current && !customerNameRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (numberType === 'fleet') {
      if (!fleetCardNumber) {
        setFleetCardNumber('777689000000')
        setCardStatus(null)
      }
      // else: already populated (e.g. by a quick-select tap) — leave it and its status alone
    } else {
      setFleetCardNumber('')
      setCardStatus(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberType])

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

  const resetNumberSection = () => {
    setSelectedQuickCustomerId(null)
    setNumberType('po')
    setFleetCardNumber('')
    setCardStatus(null)
  }

  // NO_PO_NUMBER_SITES have no PO Number / Fleet Card concept. The store persists
  // across client-side nav, so force-clear stale values the instant the active
  // site becomes one of them (e.g. user typed something on another site, then switched).
  useEffect(() => {
    if (isNoPoNumberSite) {
      resetNumberSection()
      setPoNumber('')
      setPoError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNoPoNumberSite])

  const handleQuickCustomerTap = (qc: QuickSelectCustomer) => {
    if (selectedQuickCustomerId === qc._id) {
      resetNumberSection()
      setCustomerName('')
      return
    }
    setCustomerName(qc.name)
    setSelectedQuickCustomerId(qc._id)
    setShowSuggestions(false)
    if (qc.fleetCardNumber && !isNoPoNumberSite) {
      setNumberType('fleet')
      setFleetCardNumber(qc.fleetCardNumber)
      setCardStatus('active') // trust admin-curated data; bypasses the live verify call by design
    } else {
      setNumberType('po')
      setFleetCardNumber('')
      setCardStatus(null)
    }
  }

  const customerSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase()
    if (!q || !Array.isArray(arCustomers)) return []
    return arCustomers.filter((c) => c.name?.toLowerCase().includes(q))
  }, [customerName, arCustomers])

  const toggleClass = (active: boolean, extra = '') =>
    `px-4 py-2 text-sm font-medium transition-colors ${extra} ${
      active ? 'bg-slate-800 text-white' : 'bg-background text-slate-700 hover:bg-slate-50'
    }`

  // Quick-select buttons default to showing only the first word of the customer's
  // full name (e.g. "Batchewana" for "Batchewana Frist Nation of Ojibways") to keep
  // the row compact — a custom `label` (set in Settings > Quick-Select Customers)
  // overrides this when the first word alone doesn't read well.
  const firstWord = (name: string) => name.trim().split(' ')[0] || name
  const quickSelectLabel = (qc: QuickSelectCustomer) => qc.label || firstWord(qc.name)

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Site + Purchase Type on the same row */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Select Site</h2>
          <LocationPicker
            setStationName={(value) => setStationName(typeof value === 'string' ? value : '')}
            value="stationName"
          />
        </div>
        <div className="space-y-2 text-right">
          <h2 className="text-lg font-bold">Purchase Type</h2>
          <div className="flex rounded-md border border-input overflow-hidden w-fit ml-auto">
            <button type="button" onClick={() => setPurchaseType('fuel')} className={toggleClass(purchaseType === 'fuel')}>
              Fuel
            </button>
            <button type="button" onClick={() => setPurchaseType('non-fuel')} className={toggleClass(purchaseType === 'non-fuel', 'border-l border-input')}>
              Non-Fuel
            </button>
          </div>
        </div>
      </div>

      {/* Number + Date on the same row */}
      <div className="flex items-start justify-between gap-4">
        <div className={`space-y-3 transition-opacity duration-500 ${selectedQuickCustomerId ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {/* NO_PO_NUMBER_SITES have no PO Number / Fleet Card entry */}
          {!isNoPoNumberSite && (
            <>
              <h2 className="text-lg font-bold">Number</h2>
              <div className="flex rounded-md border border-input overflow-hidden w-fit">
                <button type="button" onClick={() => { setNumberType('po'); setSelectedQuickCustomerId(null) }} className={toggleClass(numberType === 'po')}>
                  PO Number
                </button>
                <button type="button" onClick={() => { setNumberType('fleet'); setSelectedQuickCustomerId(null) }} className={toggleClass(numberType === 'fleet', 'border-l border-input')}>
                  Fleet Card
                </button>
              </div>

              {numberType === 'fleet' ? (
                <div className="space-y-1">
                  <InputOTP
                    maxLength={16}
                    name="fleetCardNumber"
                    value={fleetCardNumber}
                    onChange={async (value) => {
                      setFleetCardNumber(value)
                      setSelectedQuickCustomerId(null)
                      if (value.length === 16) {
                        try {
                          const token = localStorage.getItem('token')
                          const res = await axios.get(`${domain}/api/fleet/verify/${value}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          setCardStatus(res.data.reason || res.data.status || 'not_found')
                        } catch (e) {
                          // No response at all means we couldn't reach the server (offline) —
                          // don't permanently block the form; the backend upserts/validates
                          // the fleet card again when this PO is created/synced.
                          setCardStatus(axios.isAxiosError(e) && !e.response ? 'offline' : 'not_found')
                        }
                      } else {
                        setCardStatus(null)
                      }
                    }}
                    onBlur={handleBlur}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      {[4, 5, 6, 7].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      {[8, 9, 10, 11].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      {[12, 13, 14, 15].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                  {cardStatus && (() => {
                    const cfg = statusConfig[cardStatus] ?? { label: cardStatus, className: 'text-gray-500' }
                    return <div className={`text-xs text-right ${cfg.className}`}>{cfg.label}</div>
                  })()}
                </div>
              ) : (
                <div className="space-y-1">
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
                        // No response at all means we're offline — can't validate uniqueness
                        // right now, so don't block; the backend still enforces it on submit/sync.
                        if (axios.isAxiosError(e) && !e.response) {
                          setPoError('')
                        } else {
                          setPoError(e?.response?.data?.message || 'Could not validate PO number uniqueness')
                        }
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                  {poError && <div className="text-xs text-red-600">{poError}</div>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-2 text-right">
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

      {/* Customer and Driver */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Customer and Driver</h2>
        {quickSelectCustomers.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Quick Select</label>
            <div className="flex flex-wrap gap-2">
              {quickSelectCustomers.map((qc) => (
                <button
                  key={qc._id}
                  type="button"
                  onClick={() => handleQuickCustomerTap(qc)}
                  className={toggleClass(selectedQuickCustomerId === qc._id, 'rounded-md border border-input')}
                >
                  {quickSelectLabel(qc)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={customerNameRef} className="relative space-y-1">
          <label className="text-sm font-medium text-slate-700">Customer Name</label>
          <Input
            type="text"
            name="customerName"
            value={customerName}
            autoComplete="off"
            onChange={(e) => { setCustomerName(e.target.value); setShowSuggestions(true); if (selectedQuickCustomerId) resetNumberSection() }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && customerSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
              {customerSuggestions.map((c) => (
                <li
                  key={c._id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  onMouseDown={() => { setCustomerName(c.name); setShowSuggestions(false); if (selectedQuickCustomerId) resetNumberSection() }}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Driver Name</label>
          <Input
            type="text"
            name="driverName"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Make & Model <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input
              type="text"
              name="vehicleInfo"
              value={vehicleInfo}
              onChange={(e) => setVehicleInfo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              License Plate <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input
              type="text"
              name="licensePlate"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fuel / Non-Fuel fields */}
      {purchaseType === 'fuel' ? (
        <>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Fuel Grade</h2>
            <Select name="fuelType" value={fuelType} onValueChange={(value) => setFuelType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {data.products
                    .filter((p: Product) => !p.description.toLowerCase().includes('propane'))
                    .map((product: Product) => (
                      <SelectItem key={product._id} value={product.code}>
                        {product.description}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Quantity (L)</label>
              <Input
                type="number"
                name="quantity"
                value={quantity === 0 ? '' : quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Amount (CAD)</label>
              <Input
                type="number"
                name="amount"
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Items Sold</label>
            <Textarea
              name="itemsDescription"
              placeholder="Describe the items sold..."
              value={itemsDescription}
              onChange={(e) => setItemsDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Amount (CAD)</label>
            <Input
              type="number"
              name="amount"
              value={amount === 0 ? '' : amount}
              onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </div>
        </>
      )}

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
          <Link to="/po/receipt">
            <Button className="bg-slate-800 hover:bg-slate-900 text-white">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Captured Receipt
            </Button>
          </Link>
        ) : (
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              // Only pad when the user is actually on the PO Number path for a site that shows it.
              // NO_PO_NUMBER_SITES never show the Number section, and the Fleet Card path never
              // touches poNumber — padding an untouched empty value to "00000" would submit a
              // non-empty poNumber that collides with the backend's per-station unique index on
              // every subsequent submission.
              if (!isNoPoNumberSite && numberType === 'po') setPoNumber(padFive(poNumber));
              fileInputRef.current?.click();
            }}
            disabled={!!poError || !customerName || !driverName || (purchaseType === 'fuel' ? quantity === 0 : !itemsDescription) || (numberType === 'fleet' && cardStatus !== 'active' && cardStatus !== 'offline')}
          >
            <Camera className="mr-2 h-4 w-4" />
            Upload Receipt
          </Button>
        )}
      </div>
    </div>
  )
}