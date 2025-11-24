// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
// import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { createFileRoute, Link } from '@tanstack/react-router'
// import { useFormStore } from '@/store'
// import axios from 'axios'
// import { domain } from '@/lib/constants'

// interface Product {
//   _id: string
//   code: string
//   description: string
// }

// async function loader() {
//   try {
//     // add authorization header with bearer token
//     const token = localStorage.getItem('token')
//     const response = await axios.get(`${domain}/api/products`, {
//       headers: {
//         Authorization: `Bearer ${token}`
//       }
//     })
//     const products: Product[] = response.data

//     return { products }
//   } catch (error) {
//     return { products: [] }
//   }
// }

// export const Route = createFileRoute('/_navbarLayout/po/')({
//   loader,
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const fleetCardNumber = useFormStore((state) => state.fleetCardNumber)
//   const setFleetCardNumber = useFormStore((state) => state.setFleetCardNumber)

//   const customerName = useFormStore((state) => state.customerName)
//   const setCustomerName = useFormStore((state) => state.setCustomerName)

//   const driverName = useFormStore((state) => state.driverName)
//   const setDriverName = useFormStore((state) => state.setDriverName)

//   const vehicleInfo = useFormStore((state) => state.vehicleInfo)
//   const setVehicleInfo = useFormStore((state) => state.setVehicleInfo)

//   const quantity = useFormStore((state) => state.quantity)
//   const setQuantity = useFormStore((state) => state.setQuantity)

//   const amount = useFormStore((state) => state.amount)
//   const setAmount = useFormStore((state) => state.setAmount)

//   const fuelType = useFormStore((state) => state.fuelType)
//   const setFuelType = useFormStore((state) => state.setFuelType)

//   const data = Route.useLoaderData()

//   const handleBlur = async () => {
//     // add authorization header with bearer token
//     const token = localStorage.getItem('token')
//     const response = await axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, {
//       headers: {
//         Authorization: `Bearer ${token}`
//       }
//     })
//     const data = response.data

//     if (data.message) {
//       setCustomerName('')
//       setDriverName('')
//       setVehicleInfo('')
//     } else {
//       setCustomerName(data.customerName)
//       setDriverName(data.driverName)
//       setVehicleInfo(data.vehicleMakeModel)
//     }
//   }

//   return (
//     <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
//       {/* Fleet Card Number Section */}
//       <div className="space-y-2">
//         <h2 className="text-lg font-bold">Fleet Card Number</h2>
//         <InputOTP
//           maxLength={16}
//           name="fleetCardNumber"
//           value={fleetCardNumber}
//           onChange={(value) => setFleetCardNumber(value)}
//           onBlur={handleBlur}
//         >
//           <InputOTPGroup>
//             <InputOTPSlot index={0} />
//             <InputOTPSlot index={1} />
//             <InputOTPSlot index={2} />
//             <InputOTPSlot index={3} />
//           </InputOTPGroup>
//           <InputOTPSeparator />
//           <InputOTPGroup>
//             <InputOTPSlot index={4} />
//             <InputOTPSlot index={5} />
//             <InputOTPSlot index={6} />
//             <InputOTPSlot index={7} />
//           </InputOTPGroup>
//           <InputOTPSeparator />
//           <InputOTPGroup>
//             <InputOTPSlot index={8} />
//             <InputOTPSlot index={9} />
//             <InputOTPSlot index={10} />
//             <InputOTPSlot index={11} />
//           </InputOTPGroup>
//           <InputOTPSeparator />
//           <InputOTPGroup>
//             <InputOTPSlot index={12} />
//             <InputOTPSlot index={13} />
//             <InputOTPSlot index={14} />
//             <InputOTPSlot index={15} />
//           </InputOTPGroup>
//         </InputOTP>
//       </div>

//       {/* Customer and Driver Information Section */}
//       <div className="space-y-2">
//         <h2 className="text-lg font-bold">Customer and Driver Information</h2>
//         <Input
//           type="text"
//           name="customerName"
//           placeholder="Customer Name"
//           value={customerName}
//           onChange={(e) => setCustomerName(e.target.value)}
//         />
//         <Input
//           type="text"
//           name="driverName"
//           placeholder="Driver Name"
//           value={driverName}
//           onChange={(e) => setDriverName(e.target.value)}
//         />
//         <Input
//           type="text"
//           name="vehicleInfo"
//           placeholder="Vehicle Info"
//           value={vehicleInfo}
//           onChange={(e) => setVehicleInfo(e.target.value)}
//         />
//       </div>

//       {/* Fuel Type Section */}
//       <div className="space-y-2">
//         <h2 className="text-lg font-bold">Fuel Type</h2>
//         <Select name="fuelType" value={fuelType} onValueChange={(value) => setFuelType(value)}>
//           <SelectTrigger className="w-[180px]">
//             <SelectValue placeholder="Select Grade" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectGroup>
//               <SelectLabel>Fuel Grades</SelectLabel>
//               {data.products.map((product: Product) => (
//                 <SelectItem key={product._id} value={product.code}>
//                   {product.description}
//                 </SelectItem>
//               ))}
//             </SelectGroup>
//           </SelectContent>
//         </Select>
//       </div>

//       {/* Quantity and Amount Section */}
//       <div className="space-y-2">
//         <h2 className="text-lg font-bold">Quantity and Amount</h2>
//         <Input
//           type="number"
//           name="quantity"
//           placeholder="Quantity"
//           value={quantity === 0 ? "" : quantity}
//           onChange={(e) => setQuantity(e.target.value === "" ? 0 : Number(e.target.value))}
//         />
//         <Input
//           type="number"
//           name="amount"
//           placeholder="Amount"
//           value={amount === 0 ? "" : amount}
//           onChange={(e) => setAmount(e.target.value === "" ? 0 : Number(e.target.value))}
//         />
//       </div>

//       {/* Navigation Section */}
//       <div className="flex justify-end">
//         <Link to="/po/receipt">
//           <Button variant="outline">Next</Button>
//         </Link>
//       </div>
//     </div>
//   )
// }
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import axios from 'axios'
import { DatePicker } from '@/components/custom/datePicker';
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
  const [numberType, setNumberType] = useState<'fleet' | 'po'>('fleet') // dropdown selection

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber)
  const setFleetCardNumber = useFormStore((state) => state.setFleetCardNumber)

  const date = useFormStore((state) => state.date)
  const setDate = useFormStore((state) => state.setDate)

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

  const handleBlur = async () => {
    if (numberType !== 'fleet') return // only for fleet cards

    const token = localStorage.getItem('token')
    const response = await axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
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
    console.log("PO index mounted");
  }, []);


  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
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
          <Input
            type="text"
            name="poNumber"
            placeholder="Enter PO Number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Date</h2>
        <DatePicker
          date={date}
          setDate={(value) => {
            if (typeof value === 'function') {
              // Call the function with current date
              const newDate = value(date);
              if (newDate) setDate(newDate);
            } else {
              setDate(value);
            }
          }}
        />
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
          placeholder="Quantity"
          value={quantity === 0 ? '' : quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        <Input
          type="number"
          name="amount"
          placeholder="Amount"
          value={amount === 0 ? '' : amount}
          onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <Link to="/po/receipt">
          <Button variant="outline">Next</Button>
        </Link>
      </div>
    </div>
  )
}