import { useEffect, useState, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button'
import { X, Camera } from 'lucide-react'
import { useFormStore } from '@/store'
import { domain } from '@/lib/constants'

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery-images')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const webcamRef = useRef<Webcam>(null)
  const [currentCapture, setCurrentCapture] = useState<string>('')
  const [isCapturing, setIsCapturing] = useState(false)

  const date = useFormStore((s) => s.date)
  const lotteryValues = useFormStore((s) => s.lotteryValues)
  const lotteryImages = useFormStore((s) => s.lotteryImages)
  const setLotteryImages = useFormStore((s) => s.setLotteryImages)
  const resetLotteryForm = useFormStore((s) => s.resetLotteryForm)
  const lotterySite = useFormStore((s) => s.lotterySite)

  // Load existing saved lottery images into form state when opening this page
  useEffect(() => {
    const loadSaved = async () => {
      try {
        if (!lotterySite || !date) return
        if (lotteryImages && lotteryImages.length > 0) return
        const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const token = localStorage.getItem('token')
        const resp = await fetch(`/api/cash-summary/lottery?site=${encodeURIComponent(lotterySite)}&date=${encodeURIComponent(ymd)}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!resp.ok) return
        const j = await resp.json()
        const existing = j?.lottery?.images || []
        if (existing && existing.length > 0) {
          // store raw filenames in form state (so submit sends filenames), display will use CDN URL
          setLotteryImages(existing)
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

  const capture = () => {
    if (webcamRef.current) {
      const img = webcamRef.current.getScreenshot()
      if (img) {
        setCurrentCapture(img)
        setIsCapturing(false)
      }
    }
  }

  const saveImage = () => {
    if (currentCapture) {
      setLotteryImages([...lotteryImages, currentCapture])
      setCurrentCapture('')
    }
  }

  const removeImage = (index: number) => {
    setLotteryImages(lotteryImages.filter((_, i) => i !== index))
  }

  const startCapture = () => {
    setIsCapturing(true)
    setCurrentCapture('')
  }
  const retryCapture = () => {
    setCurrentCapture('')
    setIsCapturing(true)
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
      const uploadedFilenames: string[] = []

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

      for (let i = 0; i < lotteryImages.length; i++) {
        const img = lotteryImages[i]
        // If data URI, upload via multipart to /cdn/upload
        if (typeof img === 'string' && img.startsWith('data:')) {
          try {
            const fileHint = `lottery-${(lotterySite || 'site')}-${ymd}-${i}.jpg`
            const file = dataURLtoFile(img, fileHint)
            const form = new FormData()
            form.append('file', file)

            const resp = await fetch(`${domain || ''}/cdn/upload`, {
              method: 'POST',
              body: form,
            })

            if (!resp.ok) {
              const txt = await resp.text().catch(() => '')
              console.error('CDN upload failed', resp.status, txt)
            } else {
              const j = await resp.json()
              const fname = j?.filename || j?.fileInfo?.filename
              if (fname) uploadedFilenames.push(fname)
            }
          } catch (e) {
            console.error('Upload error', e)
          }
        } else if (typeof img === 'string' && img) {
          // Already a filename or URL — if looks like a filename, keep it
          uploadedFilenames.push(img)
        }
      }

      // POST to cash-summary lottery endpoint with filenames
      const token = localStorage.getItem('token')
      const resp2 = await fetch('/api/cash-summary/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, "X-Required-Permission": "accounting.lottery" } : {}),
        },
        body: JSON.stringify({ site: lotterySite, date: ymd, values: lotteryValues, images: uploadedFilenames }),
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
      navigate({ to: '/cash-summary/report' , search: (prev: any) => {
        const { id, ...rest } = prev || {}
        return { ...rest, site: rest?.site, date: rest?.date}
      }})
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const videoConstraints = { facingMode: 'environment', width: 1280, height: 720 }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Upload Images</h2>

        <div className="space-y-4">
          {isCapturing && (
            <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={1}
                videoConstraints={videoConstraints as any}
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
              <div className="absolute bottom-3 left-3 right-3">
                <Button onClick={capture} variant="destructive" className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Image
                </Button>
              </div>
            </div>
          )}

          {currentCapture && (
            <div className="relative w-full h-[60vh] max-h-[70vh] border border-dashed border-gray-300 rounded-md overflow-hidden">
              <img src={currentCapture} alt="Captured" className="absolute inset-0 w-full h-full object-contain bg-black" />
              <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                <Button onClick={saveImage} className="flex-1">Save Image</Button>
                <Button onClick={retryCapture} variant="secondary" className="flex-1">Retry</Button>
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

      {lotteryImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Saved Images ({lotteryImages.length})</h3>
          <div className="grid grid-cols-2 gap-4">
            {lotteryImages.map((img, idx) => {
              const src = typeof img === 'string' && img.startsWith('data:') ? img : `${domain || ''}/cdn/download/${encodeURIComponent(String(img))}`
              return (
                <div key={idx} className="relative">
                  <img src={src} alt={`img-${idx}`} className="border border-dashed border-gray-300 rounded-md w-full h-32 object-cover" />
                  <Button variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => removeImage(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <hr className="border-t border-dashed border-gray-300" />

      <div className="flex justify-between">
        <Link
          to="/cash-summary/lottery"
          // search={(prev: any) => {
          //     const { id, ...rest } = prev || {}
          //     return { ...rest, site: rest?.site, date: rest?.date }
          //   }}
          search={(prev: any) => ({ ...prev})}
        >
          <Button variant="outline">Back</Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </div>
    </div>
  )
}