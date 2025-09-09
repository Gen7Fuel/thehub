import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { uploadBase64Image } from '@/lib/utils'
import { domain } from '@/lib/constants'
import axios from "axios"

export const Route = createFileRoute('/_navbarLayout/payables/review')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Get individual payable variables from store
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const payableLocation = useFormStore((state) => state.payableLocation)
  const payableNotes = useFormStore((state) => state.payableNotes)
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const payableAmount = useFormStore((state) => state.payableAmount)
  const payableImages = useFormStore((state) => state.payableImages)
  const resetPayableForm = useFormStore((state) => state.resetPayableForm)

  useEffect(() => {
    if (!payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
      navigate({ to: "/payables" })
    }
  }, [payableVendorName, payableLocation, payablePaymentMethod, payableAmount, navigate])

  const handleSubmit = async () => {
    if (!payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) return

    setIsSubmitting(true)
    try {
      // Upload images if any
      const imageFilenames: string[] = []
      for (let i = 0; i < payableImages.length; i++) {
        const image = payableImages[i]
        const { filename } = await uploadBase64Image(image, `document_${Date.now()}_${i + 1}.jpg`)
        imageFilenames.push(filename)
      }

      // Get location ID from location name

      // add authorization header with bearer token
      const token = localStorage.getItem('token')
      const locationsResponse = await axios.get(`${domain}/api/locations`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const locations = locationsResponse.data
      const selectedLocation = locations.find((loc: any) => loc.stationName === payableLocation)
      
      if (!selectedLocation) {
        alert('Invalid location selected')
        return
      }

      // Create payable entry

      // add authorization header with bearer token
      const response = await axios.post(`${domain}/api/payables`, {
        vendorName: payableVendorName,
        location: selectedLocation._id, // Use ObjectId instead of name
        notes: payableNotes,
        paymentMethod: payablePaymentMethod,
        amount: payableAmount,
        images: imageFilenames
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.status === 200 || response.status === 201) {
        console.log('Payable created successfully')
        resetPayableForm()
        navigate({ to: '/payables/list' })
      } else {
        const error = response.data
        console.error('Error creating payable:', error)
        alert('Error creating payable: ' + error.error)
      }
    } catch (error: any) {
      console.error('Error submitting payable:', error)
      alert('Error submitting payable')
    } finally {
      setIsSubmitting(false)
    }
  }

  const paymentMethodLabels = {
    safe: 'Safe',
    till: 'Till',
    cheque: 'Cheque',
    on_account: 'On Account',
    other: 'Other'
  }

  if (!payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
    return null
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Review Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Review Payable Entry</h2>
        
        <div className="bg-gray-50 p-4 rounded-md space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Vendor Name:</strong>
              <p>{payableVendorName}</p>
            </div>
            <div>
              <strong>Location:</strong>
              <p>{payableLocation}</p>
            </div>
            <div>
              <strong>Payment Method:</strong>
              <p>{paymentMethodLabels[payablePaymentMethod as keyof typeof paymentMethodLabels]}</p>
            </div>
            <div>
              <strong>Amount:</strong>
              <p>${payableAmount.toFixed(2)}</p>
            </div>
          </div>
          
          {payableNotes && (
            <div>
              <strong>Notes:</strong>
              <p>{payableNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Images Review */}
      {payableImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Attached Images ({payableImages.length})</h3>
          <div className="grid grid-cols-3 gap-4">
            {payableImages.map((image, index) => (
              <img 
                key={index}
                src={image} 
                alt={`Invoice ${index + 1}`} 
                className="border border-dashed border-gray-300 rounded-md w-full h-24 object-cover" 
              />
            ))}
          </div>
        </div>
      )}

      <hr className="border-t border-dashed border-gray-300" />

      {/* Navigation Section */}
      <div className="flex justify-between">
        <Link to="/payables/images">
          <Button variant="outline">Back</Button>
        </Link>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="min-w-[100px]"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </div>
  )
}