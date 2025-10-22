import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import { LocationPicker } from '@/components/custom/locationPicker'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/payables/')({
  component: RouteComponent,
})

function RouteComponent() {
  // Get individual payable variables from store
  const { user } = useAuth()
  const access = user?.access || '{}'
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const setPayableVendorName = useFormStore((state) => state.setPayableVendorName)
  
  const payableLocation = useFormStore((state) => state.payableLocation)
  const setPayableLocation = useFormStore((state) => state.setPayableLocation)
  console.log('Before:',payableLocation)
  console.log('auth location:',user?.location)
  useEffect(() => {
    if (user?.location) {
      setPayableLocation(user.location);
    }
  }, [user?.location, payableLocation, setPayableLocation]);
  console.log('After:',payableLocation)
  
  const payableNotes = useFormStore((state) => state.payableNotes)
  const setPayableNotes = useFormStore((state) => state.setPayableNotes)
  
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const setPayablePaymentMethod = useFormStore((state) => state.setPayablePaymentMethod)
  
  const payableAmount = useFormStore((state) => state.payableAmount)
  const setPayableAmount = useFormStore((state) => state.setPayableAmount)

  const paymentMethods = [
    { value: 'safe', label: 'Safe' },
    { value: 'till', label: 'Till' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'on_account', label: 'On Account' },
    { value: 'other', label: 'Other' }
  ]

  const isFormValid = payableVendorName && payableLocation && payablePaymentMethod && payableAmount > 0

  return (
    <div className="min-w-[30%] mx-auto">
      <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
        {/* Vendor Information Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Vendor Information</h2>
          <Input
            type="text"
            placeholder="Vendor Name"
            value={payableVendorName}
            onChange={(e) => setPayableVendorName(e.target.value)}
            required
          />
        </div>

        {/* Location Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Location</h2>
          <LocationPicker
            setStationName={setPayableLocation as React.Dispatch<React.SetStateAction<string>>}
            value="stationName"
            disabled={!access.component_payables_create_location_filter}
          />
        </div>

        {/* Payment Information Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Payment Information</h2>
          <Select value={payablePaymentMethod} onValueChange={setPayablePaymentMethod}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Payment Methods</SelectLabel>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Amount"
            value={payableAmount === 0 ? "" : payableAmount}
            onChange={(e) => setPayableAmount(e.target.value === "" ? 0 : Number(e.target.value))}
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Notes (Optional)</h2>
          <Textarea
            placeholder="Additional notes..."
            value={payableNotes}
            onChange={(e) => setPayableNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Navigation Section */}
        <div className="flex justify-end">
          <Link to="/payables/images">
            <Button 
              variant="outline" 
              disabled={!isFormValid}
            >
              Next
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}