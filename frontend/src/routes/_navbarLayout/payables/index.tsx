// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { useEffect } from "react";
// import { DatePicker } from '@/components/custom/datePicker';
// import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { createFileRoute, Link } from '@tanstack/react-router'
// import { useFormStore } from '@/store'
// import { LocationPicker } from '@/components/custom/locationPicker'
// import { Textarea } from '@/components/ui/textarea'
// import { useAuth } from "@/context/AuthContext";

// export const Route = createFileRoute('/_navbarLayout/payables/')({
//   component: RouteComponent,
// })

// function RouteComponent() {
//   // Get individual payable variables from store
//   const { user } = useAuth()
//   // const access = user?.access || '{}'
//   const payableVendorName = useFormStore((state) => state.payableVendorName)
//   const setPayableVendorName = useFormStore((state) => state.setPayableVendorName)
//   const date = useFormStore((state) => state.date)
//   const setDate = useFormStore((state) => state.setDate)

//   const payableLocation = useFormStore((state) => state.payableLocation)
//   const setPayableLocation = useFormStore((state) => state.setPayableLocation)
//   useEffect(() => {
//     if (user?.location && !payableLocation) {
//       setPayableLocation(user.location);
//     }
//   }, [user?.location]);



//   const payableNotes = useFormStore((state) => state.payableNotes)
//   const setPayableNotes = useFormStore((state) => state.setPayableNotes)

//   const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
//   const setPayablePaymentMethod = useFormStore((state) => state.setPayablePaymentMethod)

//   const payableAmount = useFormStore((state) => state.payableAmount)
//   const setPayableAmount = useFormStore((state) => state.setPayableAmount)

//   const paymentMethods = [
//     { value: 'safe', label: 'Safe' },
//     { value: 'till', label: 'Till' },
//     { value: 'cheque', label: 'Cheque' },
//     { value: 'on_account', label: 'On Account' },
//     { value: 'other', label: 'Other' }
//   ]

//   const isFormValid = payableVendorName && payableLocation && payablePaymentMethod && payableAmount > 0

//   console.log('Date:', date)
//   console.log('location', payableLocation)

//   return (
//     <div className="min-w-[30%] mx-auto">
//       <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
//         {/* Vendor Information Section */}
//         <div className="space-y-2">
//           <h2 className="text-lg font-bold">Vendor Information</h2>
//           <Input
//             type="text"
//             placeholder="Vendor Name"
//             value={payableVendorName}
//             onChange={(e) => setPayableVendorName(e.target.value)}
//             required
//           />
//         </div>

//         {/* Location Section */}
//         <div className="space-y-2">
//           <h2 className="text-lg font-bold">Location</h2>
//           <LocationPicker
//             setStationName={setPayableLocation as React.Dispatch<React.SetStateAction<string>>}
//             value="stationName"
//             defaultValue={user?.location}
//           // disabled={!access.component_payables_create_location_filter}
//           />
//         </div>

//         <div className="space-y-2">
//           <h2 className="text-lg font-bold">Date</h2>
//           <DatePicker
//             date={date}
//             setDate={(value) => {
//               if (typeof value === 'function') {
//                 // Call the function with current date
//                 const newDate = value(date);
//                 if (newDate) setDate(newDate);
//               } else {
//                 setDate(value);
//               }
//             }}
//           />
//         </div>

//         {/* Payment Information Section */}
//         <div className="space-y-2">
//           <h2 className="text-lg font-bold">Payment Information</h2>
//           <Select value={payablePaymentMethod} onValueChange={setPayablePaymentMethod}>
//             <SelectTrigger className="w-full">
//               <SelectValue placeholder="Select Payment Method" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectGroup>
//                 <SelectLabel>Payment Methods</SelectLabel>
//                 {paymentMethods.map((method) => (
//                   <SelectItem key={method.value} value={method.value}>
//                     {method.label}
//                   </SelectItem>
//                 ))}
//               </SelectGroup>
//             </SelectContent>
//           </Select>
//           <Input
//             type="number"
//             placeholder="Amount"
//             value={payableAmount === 0 ? "" : payableAmount}
//             onChange={(e) => setPayableAmount(e.target.value === "" ? 0 : Number(e.target.value))}
//             min="0"
//             step="0.01"
//             required
//           />
//         </div>

//         {/* Notes Section */}
//         <div className="space-y-2">
//           <h2 className="text-lg font-bold">Notes (Optional)</h2>
//           <Textarea
//             placeholder="Additional notes..."
//             value={payableNotes}
//             onChange={(e) => setPayableNotes(e.target.value)}
//             rows={3}
//           />
//         </div>

//         {/* Navigation Section */}
//         <div className="flex justify-end">
//           <Link to="/payables/images">
//             <Button
//               variant="outline"
//               disabled={!isFormValid}
//             >
//               Next
//             </Button>
//           </Link>
//         </div>
//       </div>
//     </div>
//   )
// }
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect, useRef } from "react"; // Added useRef
import { DatePicker } from '@/components/custom/datePicker';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router' // Added useNavigate
import { useFormStore } from '@/store'
import { LocationPicker } from '@/components/custom/locationPicker'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from "@/context/AuthContext";
import { Camera, Eye } from 'lucide-react'; // Added icons
import { useSite } from "@/context/SiteContext";

export const Route = createFileRoute('/_navbarLayout/payables/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Store Selectors
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const setPayableVendorName = useFormStore((state) => state.setPayableVendorName)
  const date = useFormStore((state) => state.date)
  const setDate = useFormStore((state) => state.setDate)
  const payableLocation = useFormStore((state) => state.payableLocation)
  const setPayableLocation = useFormStore((state) => state.setPayableLocation)
  const payableNotes = useFormStore((state) => state.payableNotes)
  const setPayableNotes = useFormStore((state) => state.setPayableNotes)
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const setPayablePaymentMethod = useFormStore((state) => state.setPayablePaymentMethod)
  const payableAmount = useFormStore((state) => state.payableAmount)
  const setPayableAmount = useFormStore((state) => state.setPayableAmount)
  
  // Image Logic
  const payableImages = useFormStore((state) => state.payableImages)
  const setPayableImages = useFormStore((state) => state.setPayableImages)

  useEffect(() => {
    const site = selectedSite || user?.location
    if (site) setPayableLocation(site)
  }, [selectedSite, user?.location, setPayableLocation]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        // We add it as the first image and navigate to the images page
        setPayableImages([...payableImages, reader.result as string])
        navigate({ to: '/payables/images' })
      }
      reader.readAsDataURL(file)
    }
  }

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
        
        {/* Hidden Camera Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleCapture}
        />

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
          />
        </div>

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
          {payablePaymentMethod === 'safe' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Do NOT enter the full invoice amount. Only record the amount you have ACTUALLY withdrawn from the safe to make the payment.
            </p>
          )}
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
        <div className="flex justify-end pt-4">
          {payableImages.length > 0 ? (
            <Link to="/payables/images">
              <Button className="bg-slate-800 hover:bg-slate-900 text-white">
                <Eye className="mr-2 h-4 w-4" />
                View {payableImages.length} Images
              </Button>
            </Link>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!isFormValid}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Capture Invoice
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}