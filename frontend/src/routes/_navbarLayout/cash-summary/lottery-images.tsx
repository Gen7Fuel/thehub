import { useEffect, useState, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
// import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button'
import { X, Camera, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useFormStore } from '@/store'
import { domain } from '@/lib/constants'
import { DialogContent, Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const Route = createFileRoute('/_navbarLayout/cash-summary/lottery-images')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  // 2. Read the search parameters directly from the URL route context
  const searchParams = Route.useSearch() as any
  const isManitoba = !!searchParams?.isManitoba // Coerce into boolean cleanly

  const [currentCapture, setCurrentCapture] = useState<string>('')
  const [_, setIsCapturing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State Hook References
  const date = useFormStore((s) => s.date)
  const lotterySite = useFormStore((s) => s.lotterySite)
  const lotteryValues = useFormStore((s) => s.lotteryValues)
  const lotteryImages = useFormStore((s) => s.lotteryImages)
  const setLotteryImages = useFormStore((s) => s.setLotteryImages)
  const datawaveImages = useFormStore((s) => s.datawaveImages)
  const resetLotteryForm = useFormStore((s) => s.resetLotteryForm)

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

  // New: Gallery State
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const nextImage = () => {
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex + 1) % lotteryImages.length);
    }
  };

  const prevImage = () => {
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex - 1 + lotteryImages.length) % lotteryImages.length);
    }
  };

  // Helper to get correct URL for both new (base64) and saved (filenames) images
  const getImgSrc = (img: string | unknown) => {
    if (typeof img === 'string' && img.startsWith('data:')) return img;
    return `${domain || ''}/cdn/download/${encodeURIComponent(String(img))}`;
  };

  const removeImage = (index: number) => {
    setLotteryImages(lotteryImages.filter((_, i) => i !== index))
  }
  const handleRemoveImage = (idx: number) => {
    // If this is the last image being deleted, close the gallery
    if (lotteryImages.length <= 1) {
      setGalleryIndex(null);
    }
    // If we are deleting the current image and it's the last one in the list, move back
    else if (galleryIndex === lotteryImages.length - 1) {
      setGalleryIndex((prev) => (prev !== null ? prev - 1 : null));
    }
    removeImage(idx);
  };

  // New: Ref for the hidden native input
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setCurrentCapture(base64String) // Set for preview
        setIsCapturing(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '' // Reset to allow same file re-selection
      fileInputRef.current.click()
    }
  }

  const saveImage = () => {
    if (currentCapture) {
      setLotteryImages([...lotteryImages, currentCapture])
      setCurrentCapture('')
    }
  }

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

  // Direct Submission Handler for Manitoba
  const handleManitobaSubmit = async () => {
    try {
      setIsSubmitting(true)
      const ymd = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''

      const uploadedDatawaveImages = await uploadImages(ymd, datawaveImages, 'datawave') // Returns [] as expected
      const uploadedLotteryImages = await uploadImages(ymd, lotteryImages, 'lottery')

      const token = localStorage.getItem('token')
      const resp2 = await fetch('/api/cash-summary/lottery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, "X-Required-Permission": "accounting.cashSummary.lottery" } : {}),
        },
        body: JSON.stringify({
          site: lotterySite,
          date: ymd,
          values: lotteryValues,
          images: uploadedLotteryImages,
          datawaveImages: uploadedDatawaveImages
        }),
      })

      if (resp2.status === 403) {
        navigate({ to: "/no-access" })
        return
      }
      if (!resp2.ok) {
        const txt = await resp2.text().catch(() => '')
        throw new Error(`Save failed: ${resp2.status} ${txt}`)
      }

      resetLotteryForm()
      navigate({
        to: '/cash-summary/report',
        search: (prev: any) => {
          const { id, isManitoba, ...rest } = prev || {} // Strip temporary isManitoba parameter cleanly out of report view if needed
          return { ...rest, site: rest?.site, date: rest?.date }
        }
      })
    } catch (err) {
      console.error('Direct submission failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6 w-full">
      {/* Hidden Native Input */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="space-y-2">
        <h2 className="text-lg font-bold">Upload Lotto Report Images</h2>

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
                <Button onClick={openNativeCamera} variant="secondary" className="flex-1">
                  Retake
                </Button>
              </div>
            </div>
          )}

          {/* Trigger button when no preview is active */}
          {!currentCapture && (
            <Button onClick={openNativeCamera} variant="outline" className="w-full h-32 flex flex-col gap-2">
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span>Tap to Open Camera</span>
            </Button>
          )}
        </div>
      </div>
      {lotteryImages.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Captured Reports ({lotteryImages.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {lotteryImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square">
                <img
                  src={getImgSrc(img)}
                  alt={`Lotto report ${idx + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-slate-200 cursor-pointer shadow-sm active:scale-95 transition-transform"
                  onClick={() => setGalleryIndex(idx)}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  // Button is always visible now for better mobile UX
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg border-2 border-white z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(idx);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-t border-dashed border-gray-300" />

      <div className="flex justify-between">
        <Link to="/cash-summary/lottery" search={(prev: any) => ({ ...prev })}>
          <Button variant="outline" disabled={isSubmitting}>Back</Button>
        </Link>

        {/* 3. Conditional Button rendering driven entirely by Search Query parameter */}
        {isManitoba ? (
          <Button
            onClick={() => {
              if (lotteryImages.length === 0) {
                alert("Please capture at least one Lottery Report image before submitting.");
                return;
              }
              handleManitobaSubmit();
            }}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (lotteryImages.length === 0) {
                alert("Please capture at least one Lottery Report image before proceeding.");
                return;
              }
              navigate({
                to: "/cash-summary/datawave-images",
                search: (prev: any) => ({ ...prev })
              });
            }}
          >
            Next
          </Button>
        )}
      </div>
      {/* Gallery Viewer Dialog */}
      <Dialog open={galleryIndex !== null} onOpenChange={() => setGalleryIndex(null)}>
        <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              Report Image {galleryIndex !== null ? galleryIndex + 1 : 0} of {lotteryImages.length}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col items-center space-y-4 overflow-hidden">
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-slate-900 rounded-lg overflow-hidden">
              {galleryIndex !== null && (
                <img
                  src={getImgSrc(lotteryImages[galleryIndex])}
                  alt="Gallery Preview"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {/* Navigation Controls */}
            {lotteryImages.length > 1 && (
              <div className="flex items-center gap-6">
                <Button onClick={prevImage} variant="outline" size="sm" className="h-9 px-4">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-xs font-semibold tabular-nums">
                  {galleryIndex !== null ? galleryIndex + 1 : 0} / {lotteryImages.length}
                </span>
                <Button onClick={nextImage} variant="outline" size="sm" className="h-9 px-4">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
              <Button
                variant="destructive"
                className="flex-1 sm:flex-none sm:min-w-[120px]"
                onClick={() => galleryIndex !== null && handleRemoveImage(galleryIndex)}
              >
                <X className="mr-2 h-4 w-4" />
                Remove Image
              </Button>

              <Button
                variant="secondary"
                className="flex-1 sm:flex-none sm:min-w-[120px]"
                onClick={() => setGalleryIndex(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}