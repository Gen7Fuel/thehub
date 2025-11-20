import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/po/receipt')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const webcamRef = useRef<Webcam>(null)
  const setReceipt = useFormStore((state) => state.setReceipt)
  const receipt = useFormStore((state) => state.receipt)
  // const fleetCardNumber = useFormStore((state) => state.fleetCardNumber)
  // const poNumber = useFormStore((state) => state.poNumber)
  const customerName = useFormStore((state) => state.customerName)
  const driverName = useFormStore((state) => state.driverName)
  const vehicleInfo = useFormStore((state) => state.vehicleInfo)
  const quantity = useFormStore((state) => state.quantity)
  const amount = useFormStore((state) => state.amount)
  const fuelType = useFormStore((state) => state.fuelType)
  const date = useFormStore((state) => state.date)
  // const [imageSize, setImageSize] = useState<number | null>(null)

  useEffect(() => {
    if (!date || !customerName || !driverName || !vehicleInfo || !fuelType || quantity === 0 || amount === 0) {
      navigate({ to: "/po" })
    }
  }, [date, customerName, driverName, vehicleInfo, fuelType, quantity, amount, navigate])

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setReceipt(imageSrc)
        // const sizeInBytes = (imageSrc.length * (3 / 4)) - (imageSrc.endsWith('==') ? 2 : (imageSrc.endsWith('=') ? 1 : 0))
        // setImageSize(sizeInBytes)
      }
    }
  }

  const handleRetry = () => {
    setReceipt('') // Clear the receipt
    // setImageSize(null) // Reset the image size
  }

  const videoConstraints = {
    height: 640,
    facingMode: "environment"
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Receipt Capture Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Capture Receipt</h2>
        <div className="space-y-4">
          {/* Keep the Webcam component mounted */}
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className={`border border-dashed border-gray-300 rounded-md ${receipt ? 'hidden' : 'block'}`}
          />
          {receipt && (
            <img src={receipt} alt="Captured" className="border border-dashed border-gray-300 rounded-md" />
          )}
          {receipt ? (
            <Button onClick={handleRetry} variant="secondary">
              Retry
            </Button>
          ) : (
            <Button onClick={capture} variant="destructive">
              Capture
            </Button>
          )}
        </div>
      </div>

      <hr className="border-t border-dashed border-gray-300" />

      {/* Navigation Section */}
      <div className="flex justify-between">
        <Link to="/po">
          <Button variant="outline">Back</Button>
        </Link>
        <Link to="/po/signature">
          <Button variant="outline">Next</Button>
        </Link>
      </div>
    </div>
  )
}