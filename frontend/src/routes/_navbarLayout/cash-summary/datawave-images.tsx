import { useEffect, useState, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
// import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button'
import { X, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormStore } from '@/store'
import { domain } from '@/lib/constants'
import { DialogContent, Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'


export const Route = createFileRoute(
  '/_navbarLayout/cash-summary/datawave-images',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  // const webcamRef = useRef<Webcam>(null)
  const [currentCapture, setCurrentCapture] = useState<string>('')
  const [_, setIsCapturing] = useState(false)

  const date = useFormStore((s) => s.date)
  const lotteryValues = useFormStore((s) => s.lotteryValues)
  const lotteryImages = useFormStore((s) => s.lotteryImages)
  // const setLotteryImages = useFormStore((s) => s.setLotteryImages)
  const datawaveImages = useFormStore((s) => s.datawaveImages)
  const setDatawaveImages = useFormStore((s) => s.setDatawaveImages)
  const resetLotteryForm = useFormStore((s) => s.resetLotteryForm)
  const lotterySite = useFormStore((s) => s.lotterySite)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setCurrentCapture(reader.result as string)
        setIsCapturing(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const nextImage = () => {
    if (galleryIndex !== null) setGalleryIndex((galleryIndex + 1) % datawaveImages.length)
  }

  const prevImage = () => {
    if (galleryIndex !== null) setGalleryIndex((galleryIndex - 1 + datawaveImages.length) % datawaveImages.length)
  }

  const getImgSrc = (img: string | unknown) => {
    if (typeof img === 'string' && img.startsWith('data:')) return img
    return `${domain || ''}/cdn/download/${encodeURIComponent(String(img))}`
  }

  // Load existing saved lottery images into form state when opening this page
  useEffect(() => {
    const loadSaved = async () => {
      try {
        if (!lotterySite || !date) return
        if (datawaveImages && datawaveImages.length > 0) return
        const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const token = localStorage.getItem('token')
        const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(lotterySite)}&date=${encodeURIComponent(ymd)}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "X-Required-Permission": "accounting.cashSummary.lottery",
          },
        })
        if (resp.status === 403) {
          console.warn("Lottery permission denied")
          navigate({ to: "/no-access" }) // optional but recommended
          return
        }
        if (!resp.ok) return
        const j = await resp.json()
        const existing = j?.lottery?.datawaveImages || []
        if (existing && existing.length > 0) {
          // store raw filenames in form state (so submit sends filenames), display will use CDN URL
          setDatawaveImages(existing)
        }
      } catch (e) {
        console.error('Failed to load saved lottery images', e)
      }
    }
    loadSaved()
    // only run on initial mount / when date or site changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, lotterySite])

  useEffect(() => {
    // basic guard: if user hasn't filled anything, go back
    if (!date) {
      navigate({ to: '/cash-summary/lottery' })
    }
  }, [date, navigate])

  // const capture = () => {
  //   if (webcamRef.current) {
  //     const img = webcamRef.current.getScreenshot()
  //     if (img) {
  //       setCurrentCapture(img)
  //       setIsCapturing(false)
  //     }
  //   }
  // }

  const saveImage = () => {
    if (currentCapture) {
      setDatawaveImages([...datawaveImages, currentCapture])
      setCurrentCapture('')
    }
  }

  const removeImage = (index: number) => {
    setDatawaveImages(datawaveImages.filter((_, i) => i !== index))
  }

  // const startCapture = () => {
  //   setIsCapturing(true)
  //   setCurrentCapture('')
  // }
  // const retryCapture = () => {
  //   setCurrentCapture('')
  //   setIsCapturing(true)
  // }

  const uploadImages = async (
    ymd: string,
    images: string[],
    prefix: 'lottery' | 'datawave'
  ): Promise<string[]> => {
    const uploaded: string[] = []

    for (let i = 0; i < images.length; i++) {
      const img = images[i]

      if (typeof img === 'string' && img.startsWith('data:')) {
        try {
          const fileHint = `${prefix}-${lotterySite || 'site'}-${ymd}-${i}.jpg`
          const file = dataURLtoFile(img, fileHint)
          const form = new FormData()
          form.append('file', file)

          const resp = await fetch(`${domain || ''}/cdn/upload`, {
            method: 'POST',
            body: form,
          })

          if (resp.ok) {
            const j = await resp.json()
            const fname = j?.filename || j?.fileInfo?.filename
            if (fname) uploaded.push(fname)
          } else {
            console.error('CDN upload failed', resp.status)
          }
        } catch (e) {
          console.error('Upload error', e)
        }
      } else if (typeof img === 'string' && img) {
        // already a filename
        uploaded.push(img)
      }
    }

    return uploaded
  }
  // helper to convert dataURL to File
  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',')
    const mimeMatch = arr[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  }


  // Submit assembles payload; replace fetch URL when backend ready.
  const handleSubmit = async () => {
    // const payload = {
    //   date,
    //   values: lotteryValues,
    //   images: lotteryImages,
    //   // bullock data will be fetched/stored on backend later;
    //   // for now frontend supplies values; backend will attach bullock when available.
    // }

    try {
      const ymd = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''

      const uploadedDatawaveImages = await uploadImages(ymd, datawaveImages, 'datawave')
      const uploadedLotteryImages = await uploadImages(ymd, lotteryImages, 'lottery')


      // POST to cash-summary lottery endpoint with filenames
      const token = localStorage.getItem('token')
      const resp2 = await fetch('/api/cash-summary/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, "X-Required-Permission": "accounting.cashSummary.lottery" } : {}),
        },
        body: JSON.stringify({ site: lotterySite, date: ymd, values: lotteryValues, images: uploadedLotteryImages, datawaveImages: uploadedDatawaveImages }),
      })
      if (resp2.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }
      if (!resp2.ok) {
        const txt = await resp2.text().catch(() => '')
        throw new Error(`Save failed: ${resp2.status} ${txt}`)
      }

      // reset local lottery form after successful save
      resetLotteryForm()
      // navigate({ to: '/cash-summary/report?site=' + lotterySite + '&date=' + ymd })
      navigate({
        to: '/cash-summary/report', search: (prev: any) => {
          const { id, ...rest } = prev || {}
          return { ...rest, site: rest?.site, date: rest?.date }
        }
      })
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  // const videoConstraints = { facingMode: 'environment', width: 1280, height: 720 }

  return (
    // <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
    //   <div className="space-y-2">
    //     <h2 className="text-lg font-bold">Upload DataWave Images</h2>

    //     <div className="space-y-4">
    //       {isCapturing && (
    //         <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
    //           <Webcam
    //             ref={webcamRef}
    //             audio={false}
    //             screenshotFormat="image/jpeg"
    //             screenshotQuality={1}
    //             videoConstraints={videoConstraints as any}
    //             className="absolute inset-0 w-full h-full object-contain bg-black"
    //           />
    //           <div className="absolute bottom-3 left-3 right-3">
    //             <Button onClick={capture} variant="destructive" className="w-full">
    //               <Camera className="mr-2 h-4 w-4" />
    //               Capture Image
    //             </Button>
    //           </div>
    //         </div>
    //       )}

    //       {currentCapture && (
    //         <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
    //           <img src={currentCapture} alt="Captured" className="absolute inset-0 w-full h-full object-contain bg-black" />
    //           <div className="absolute bottom-3 left-3 right-3 flex gap-2">
    //             <Button onClick={saveImage} className="flex-1">Save Image</Button>
    //             <Button onClick={retryCapture} variant="secondary" className="flex-1">Retry</Button>
    //           </div>
    //         </div>
    //       )}

    //       {!isCapturing && !currentCapture && (
    //         <Button onClick={startCapture} variant="outline" className="w-full">
    //           <Camera className="mr-2 h-4 w-4" />
    //           Add Image
    //         </Button>
    //       )}
    //     </div>
    //   </div>

    //   {datawaveImages.length > 0 && (
    //     <div className="space-y-2">
    //       <h3 className="text-md font-semibold">Saved DataWave Images ({datawaveImages.length})</h3>
    //       <div className="grid grid-cols-2 gap-4">
    //         {datawaveImages.map((img, idx) => {
    //           const src = typeof img === 'string' && img.startsWith('data:') ? img : `${domain || ''}/cdn/download/${encodeURIComponent(String(img))}`
    //           return (
    //             <div key={idx} className="relative">
    //               <img src={src} alt={`img-${idx}`} className="border border-dashed border-gray-300 rounded-md w-full h-32 object-cover" />
    //               <Button variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => removeImage(idx)}>
    //                 <X className="h-3 w-3" />
    //               </Button>
    //             </div>
    //           )
    //         })}
    //       </div>
    //     </div>
    //   )}
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Upload DataWave Images</h2>
        <div className="space-y-4">
          {currentCapture ? (
            <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden bg-black">
              <img src={currentCapture} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
              <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                <Button onClick={saveImage} className="flex-1 bg-green-600 hover:bg-green-700">Save Image</Button>
                <Button onClick={openNativeCamera} variant="secondary" className="flex-1">Retake</Button>
              </div>
            </div>
          ) : (
            <Button onClick={openNativeCamera} variant="outline" className="w-full h-24 flex flex-col gap-2">
              <Camera className="h-6 w-6" />
              <span>Add DataWave Image</span>
            </Button>
          )}
        </div>
      </div>

      {datawaveImages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Saved DataWave Images ({datawaveImages.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {datawaveImages.map((img, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img
                  src={getImgSrc(img)}
                  alt={`DataWave report ${idx + 1}`}
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

      <div className="flex justify-between">
        <Link
          to="/cash-summary/lottery-images"
          search={(prev: any) => ({ ...prev })}
        >
          <Button variant="outline">Back</Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </div>

      {/* Gallery Viewer Dialog */}
      <Dialog open={galleryIndex !== null} onOpenChange={() => setGalleryIndex(null)}>
        <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>DataWave Image {galleryIndex !== null ? galleryIndex + 1 : 0} of {datawaveImages.length}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col items-center space-y-4 overflow-hidden">
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden">
              {galleryIndex !== null && (
                <img src={getImgSrc(datawaveImages[galleryIndex])} className="max-w-full max-h-full object-contain" />
              )}
            </div>
            {datawaveImages.length > 1 && (
              <div className="flex items-center gap-6">
                <Button onClick={prevImage} variant="outline" size="sm"><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
                <span className="text-xs font-medium">{galleryIndex !== null ? galleryIndex + 1 : 0} / {datawaveImages.length}</span>
                <Button onClick={nextImage} variant="outline" size="sm">Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            )}
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setGalleryIndex(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}