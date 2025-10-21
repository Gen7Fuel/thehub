import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import axios from 'axios'
import { domain } from '@/lib/constants'
import { formatFleetCardNumber, sendEmail } from '@/lib/utils'

interface FleetCustomer {
  _id: string
  name: string
  email: string
}

async function loader() {
  try {
    const response = await axios.get(`${domain}/api/fleet-customers`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    const customers: FleetCustomer[] = response.data

    return { customers }
  } catch (error) {
    return { customers: [] }
  }
}

export const Route = createFileRoute('/_navbarLayout/fleet/')({
  loader,
  component: RouteComponent,
})

function RouteComponent() {
  const signatureRef = useRef<SignatureCanvas>(null)
  const data = Route.useLoaderData()

  // Form state
  const [fleetCardNumber, setFleetCardNumber] = useState('777689000000')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleMakeModel, setVehicleMakeModel] = useState('')
  const [signature, setSignature] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get selected customer details
  const selectedCustomerData = data.customers.find((c: { _id: string }) => c._id === selectedCustomer)

  const handleSignatureEnd = () => {
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL('image/png')
      setSignature(signatureData)
      console.log('Signature saved:', signatureData)
    }
  }

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear()
      setSignature('')
    }
  }

  const isFormValid = fleetCardNumber && selectedCustomer && driverName && vehicleMakeModel && signature

  const handleSubmit = async () => {
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      // Step 1: Check if fleet card already exists
      let fleetData = null
      try {
        const existingFleetResponse = await axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
        fleetData = existingFleetResponse.data
      } catch (err: any) {
        // If not found, fleetData stays null
        if (err.response && err.response.status !== 404) throw err
      }

      // Step 2: Create or update fleet entry with signature
      if (fleetData && !fleetData.message) {
        // Update existing fleet entry
        await axios.put(`${domain}/api/fleet/updateByCardNumber/${fleetCardNumber}`, {
          customerName: selectedCustomerData?.name,
          customerEmail: selectedCustomerData?.email,
          driverName,
          vehicleMakeModel,
          customerId: selectedCustomer,
          signature: signature, // Save base64 signature directly
        }, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
      } else {
        // Create new fleet entry

        await axios.post(`${domain}/api/fleet/create`, {
          fleetCardNumber,
          customerName: selectedCustomerData?.name,
          customerEmail: selectedCustomerData?.email,
          driverName,
          vehicleMakeModel,
          customerId: selectedCustomer,
          signature: signature, // Save base64 signature directly
        }, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
      }

      // Step 3: Send confirmation email to customer
      if (selectedCustomerData?.email) {
        try {
          await sendEmail({
            // to: selectedCustomerData.email,
            to: 'mohammad@gen7fuel.com',
            cc: [],
            subject: 'Fleet Card Assignment Confirmation',
            content: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px;">
                  Fleet Card Assignment Confirmation
                </h1>
                
                <p>Dear ${selectedCustomerData.name},</p>
                
                <p>We are pleased to confirm that your fleet card has been successfully assigned. Here are the details:</p>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h2 style="color: #007acc; margin-top: 0;">Fleet Card Details</h2>
                  <p><strong>Fleet Card Number:</strong> ${formatFleetCardNumber(fleetCardNumber)}</p>
                  <p><strong>Driver Name:</strong> ${driverName}</p>
                  <p><strong>Vehicle Make/Model:</strong> ${vehicleMakeModel}</p>
                  <p><strong>Assignment Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <p>Please keep this information for your records. If you have any questions or concerns about your fleet card assignment, please don't hesitate to contact us.</p>
                
                <p style="margin-top: 30px;">
                  Best regards,<br>
                  <strong>Gen7 Team</strong><br>
                </p>
                
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #666;">
                  This is an automated message. Please do not reply to this email.
                </p>
              </div>
            `,
            isHtml: true
          });
          console.log('Confirmation email sent successfully');
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the entire process if email fails
        }
      }

      console.log('Fleet card assigned successfully')
      
      // Reset form
      setFleetCardNumber('777689000000')
      setSelectedCustomer('')
      setDriverName('')
      setVehicleMakeModel('')
      setSignature('')
      if (signatureRef.current) {
        signatureRef.current.clear()
      }
      
      alert('Fleet card assigned successfully! Confirmation email has been sent to the customer.')
    } catch (error) {
      console.error('Error submitting fleet card:', error)
      alert('Error submitting fleet card. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Fleet Card Number Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Fleet Card Number</h2>
        <InputOTP
          maxLength={16}
          name="fleetCardNumber"
          value={fleetCardNumber}
          onChange={(value) => setFleetCardNumber(value)}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
            <InputOTPSlot index={6} />
            <InputOTPSlot index={7} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={8} />
            <InputOTPSlot index={9} />
            <InputOTPSlot index={10} />
            <InputOTPSlot index={11} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={12} />
            <InputOTPSlot index={13} />
            <InputOTPSlot index={14} />
            <InputOTPSlot index={15} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {/* Fleet Customer Selection */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Fleet Customer</h2>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Fleet Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Fleet Customers</SelectLabel>
              {data.customers.map((customer: FleetCustomer) => (
                <SelectItem key={customer._id} value={customer._id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Driver and Vehicle Information */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Driver and Vehicle Information</h2>
        <Input
          type="text"
          name="driverName"
          placeholder="Driver Name"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          required
        />
        <Input
          type="text"
          name="vehicleMakeModel"
          placeholder="Vehicle Make/Model (e.g., Toyota Camry 2023)"
          value={vehicleMakeModel}
          onChange={(e) => setVehicleMakeModel(e.target.value)}
          required
        />
      </div>

      {/* Signature Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Signature</h2>
        <SignatureCanvas
          ref={signatureRef}
          penColor="black"
          canvasProps={{
            width: 500,
            height: 200,
            className: 'border border-dashed border-gray-300 rounded-md',
          }}
          onEnd={handleSignatureEnd}
        />
        <div className="flex justify-between">
          <Button onClick={handleClearSignature} variant="secondary">
            Clear Signature
          </Button>
        </div>
      </div>

      <hr className="border-t border-dashed border-gray-300" />

      {/* Submit Section */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Fleet Card'}
        </Button>
      </div>
    </div>
  )
}