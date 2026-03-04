import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
// import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Camera, X } from 'lucide-react' // Added Chevrons
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { domain } from '@/lib/constants'

export const Route = createFileRoute('/_navbarLayout/payables/images')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  // const webcamRef = useRef<Webcam>(null)
  const [currentCapture, setCurrentCapture] = useState<string>('')
  // const [isCapturing, setIsCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  // Get individual payable variables from store
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const payableLocation = useFormStore((state) => state.payableLocation)
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const date = useFormStore((state) => state.date)
  const payableAmount = useFormStore((state) => state.payableAmount)
  const payableImages = useFormStore((state) => state.payableImages)
  const setPayableImages = useFormStore((state) => state.setPayableImages)

  useEffect(() => {
    if (!date || !payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
      navigate({ to: "/payables" })
    }
  }, [date, payableVendorName, payableLocation, payablePaymentMethod, payableAmount, navigate])

  // const capture = () => {
  //   if (webcamRef.current) {
  //     const imageSrc = webcamRef.current.getScreenshot()
  //     if (imageSrc) {
  //       setCurrentCapture(imageSrc)
  //       setIsCapturing(false)
  //     }
  //   }
  // }

  // const saveImage = () => {
  //   if (currentCapture) {
  //     setPayableImages([...payableImages, currentCapture])
  //     setCurrentCapture('')
  //   }
  // }

  const removeImage = (index: number) => {
    setPayableImages(payableImages.filter((_, i) => i !== index))
  }

  // const startCapture = () => {
  //   setIsCapturing(true)
  //   setCurrentCapture('')
  // }

  // const retryCapture = () => {
  //   setCurrentCapture('')
  //   setIsCapturing(true)
  // }

  // const videoConstraints = {
  //   height: 640,
  //   facingMode: "environment"
  // }
  // const videoConstraints = {
  //   // Request rear camera and higher resolution; browser will pick closest supported
  //   facingMode: 'environment',
  //   width: 1920, // try 2560/3264 if devices support it
  //   height: 1080,
  //   aspectRatio: 16 / 9,
  // }

  // 3. New: Handler for Native Camera
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCurrentCapture(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const openCamera = () => {
    fileInputRef.current?.click()
  }

  const saveImage = () => {
    if (currentCapture) {
      setPayableImages([...payableImages, currentCapture])
      setCurrentCapture('')
    }
  }

  const nextImage = () => {
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex + 1) % payableImages.length)
    }
  }

  const prevImage = () => {
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex - 1 + payableImages.length) % payableImages.length)
    }
  }

  // Helper to handle both Base64 and CDN URLs if applicable
  const getImgSrc = (img: string) => {
    if (img.startsWith('data:')) return img
    return `${domain || ''}/cdn/download/${encodeURIComponent(String(img))}`
  }


  // return (
  //   <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
  //     {/* Image Capture Section */}
  //     <div className="space-y-2">
  //       <h2 className="text-lg font-bold">Invoice/Receipt Images</h2>

  //       {/* Camera Section */}
  //       <div className="space-y-4">
  //         {isCapturing && (
  //           <>
  //             <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
  //               <Webcam
  //                 ref={webcamRef}
  //                 audio={false}
  //                 screenshotFormat="image/jpeg"
  //                 screenshotQuality={1}            // max JPEG quality
  //                 videoConstraints={videoConstraints} // still requests 1920x1080 stream
  //                 className="absolute inset-0 w-full h-full object-contain bg-black"
  //               />
  //               <div className="absolute bottom-3 left-3 right-3">
  //                 <Button onClick={capture} variant="destructive" className="w-full shadow">
  //                   <Camera className="mr-2 h-4 w-4" />
  //                   Capture Image
  //                 </Button>
  //               </div>
  //             </div>
  //           </>
  //         )}

  //         {currentCapture && (
  //           <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
  //             <img
  //               src={currentCapture}
  //               alt="Captured"
  //               className="absolute inset-0 w-full h-full object-contain bg-black"
  //             />
  //             <div className="absolute bottom-3 left-3 right-3 flex gap-2">
  //               <Button onClick={saveImage} className="flex-1 shadow">
  //                 Save Image
  //               </Button>
  //               <Button onClick={retryCapture} variant="secondary" className="flex-1 shadow">
  //                 Retry
  //               </Button>
  //             </div>
  //           </div>
  //         )}

  //         {!isCapturing && !currentCapture && (
  //           <Button onClick={startCapture} variant="outline" className="w-full">
  //             <Camera className="mr-2 h-4 w-4" />
  //             Add Image
  //           </Button>
  //         )}
  //       </div>
  //     </div>

  //     {/* Saved Images Section */}
  //     {payableImages.length > 0 && (
  //       <div className="space-y-2">
  //         <h3 className="text-md font-semibold">Saved Images ({payableImages.length})</h3>
  //         <div className="grid grid-cols-2 gap-4">
  //           {payableImages.map((image, index) => (
  //             <div key={index} className="relative">
  //               <img
  //                 src={image}
  //                 alt={`Invoice ${index + 1}`}
  //                 className="border border-dashed border-gray-300 rounded-md w-full h-32 object-cover"
  //               />
  //               <Button
  //                 variant="destructive"
  //                 size="sm"
  //                 className="absolute top-1 right-1 h-6 w-6 p-0"
  //                 onClick={() => removeImage(index)}
  //               >
  //                 <X className="h-3 w-3" />
  //               </Button>
  //             </div>
  //           ))}
  //         </div>
  //       </div>
  //     )}

  //     <hr className="border-t border-dashed border-gray-300" />

  //     {/* Navigation Section */}
  //     <div className="flex justify-between">
  //       <Link to="/payables">
  //         <Button variant="outline">Back</Button>
  //       </Link>
  //       <Link to="/payables/review">
  //         <Button variant="outline">
  //           Review
  //         </Button>
  //       </Link>
  //     </div>
  //   </div>
  // )
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
      {/* Hidden Native Input */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleCapture}
        className="hidden"
      />

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Invoice/Receipt Images</h2>

        <div className="space-y-4">
          {/* Preview of the image just taken but not yet saved */}
          {currentCapture && (
            <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden bg-black">
              <img
                src={currentCapture}
                alt="Captured"
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                <Button onClick={saveImage} className="flex-1 bg-green-600 hover:bg-green-700">
                  Save Image
                </Button>
                <Button onClick={openCamera} variant="secondary" className="flex-1">
                  Retake
                </Button>
              </div>
            </div>
          )}

          {/* Trigger button when no preview is active */}
          {!currentCapture && (
            <Button onClick={openCamera} variant="outline" className="w-full h-32 flex flex-col gap-2">
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span>Tap to Add more Invoice Images</span>
            </Button>
          )}
        </div>
      </div>

      {/* Existing Saved Images Grid */}
      {payableImages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Captured Invoices ({payableImages.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {payableImages.map((img, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img
                  src={getImgSrc(img)}
                  alt={`Invoice ${idx + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => setGalleryIndex(idx)}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
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

      {/* Image Viewer Dialog (Gallery) */}
      <Dialog open={galleryIndex !== null} onOpenChange={() => setGalleryIndex(null)}>
        <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              Invoice Image {galleryIndex !== null ? galleryIndex + 1 : 0} of {payableImages.length}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col items-center space-y-4 overflow-hidden">
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden">
              {galleryIndex !== null && (
                <img
                  src={getImgSrc(payableImages[galleryIndex])}
                  alt="Invoice Preview"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {payableImages.length > 1 && (
              <div className="flex items-center gap-6">
                <Button onClick={prevImage} variant="outline" size="sm" className="h-9 px-4">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-xs font-semibold tabular-nums">
                  {galleryIndex !== null ? galleryIndex + 1 : 0} / {payableImages.length}
                </span>
                <Button onClick={nextImage} variant="outline" size="sm" className="h-9 px-4">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setGalleryIndex(null)}
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}