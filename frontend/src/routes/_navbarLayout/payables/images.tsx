import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { X, Camera } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/payables/images')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const webcamRef = useRef<Webcam>(null)
  const [currentCapture, setCurrentCapture] = useState<string>('')
  const [isCapturing, setIsCapturing] = useState(false)
  
  // Get individual payable variables from store
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const payableLocation = useFormStore((state) => state.payableLocation)
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const payableAmount = useFormStore((state) => state.payableAmount)
  const payableImages = useFormStore((state) => state.payableImages)
  const setPayableImages = useFormStore((state) => state.setPayableImages)

  useEffect(() => {
    if (!payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
      navigate({ to: "/payables" })
    }
  }, [payableVendorName, payableLocation, payablePaymentMethod, payableAmount, navigate])

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCurrentCapture(imageSrc)
        setIsCapturing(false)
      }
    }
  }

  const saveImage = () => {
    if (currentCapture) {
      setPayableImages([...payableImages, currentCapture])
      setCurrentCapture('')
    }
  }

  const removeImage = (index: number) => {
    setPayableImages(payableImages.filter((_, i) => i !== index))
  }

  const startCapture = () => {
    setIsCapturing(true)
    setCurrentCapture('')
  }

  const retryCapture = () => {
    setCurrentCapture('')
    setIsCapturing(true)
  }

  const videoConstraints = {
    height: 640,
    facingMode: "environment"
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Image Capture Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Invoice/Receipt Images</h2>
        
        {/* Camera Section */}
        <div className="space-y-4">
          {isCapturing && (
            <>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="border border-dashed border-gray-300 rounded-md w-full"
              />
              <Button onClick={capture} variant="destructive" className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Capture Image
              </Button>
            </>
          )}

          {currentCapture && (
            <div className="space-y-2">
              <img 
                src={currentCapture} 
                alt="Captured" 
                className="border border-dashed border-gray-300 rounded-md w-full" 
              />
              <div className="flex gap-2">
                <Button onClick={saveImage} className="flex-1">
                  Save Image
                </Button>
                <Button onClick={retryCapture} variant="secondary" className="flex-1">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!isCapturing && !currentCapture && (
            <Button onClick={startCapture} variant="outline" className="w-full">
              <Camera className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          )}
        </div>
      </div>

      {/* Saved Images Section */}
      {payableImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Saved Images ({payableImages.length})</h3>
          <div className="grid grid-cols-2 gap-4">
            {payableImages.map((image, index) => (
              <div key={index} className="relative">
                <img 
                  src={image} 
                  alt={`Invoice ${index + 1}`} 
                  className="border border-dashed border-gray-300 rounded-md w-full h-32 object-cover" 
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-t border-dashed border-gray-300" />

      {/* Navigation Section */}
      <div className="flex justify-between">
        <Link to="/payables">
          <Button variant="outline">Back</Button>
        </Link>
        <Link to="/payables/review">
          <Button variant="outline">
            Review
          </Button>
        </Link>
      </div>
    </div>
  )
}