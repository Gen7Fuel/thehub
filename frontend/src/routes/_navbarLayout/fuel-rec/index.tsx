import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { uploadBase64Image } from '@/lib/utils'

type Search = { site: string; date: string }

export const Route = createFileRoute('/_navbarLayout/fuel-rec/')({
  validateSearch: (search: Record<string, any>) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
      site: typeof search.site === 'string' ? search.site : '',
      date: typeof search.date === 'string' ? search.date : today,
    } as Search
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { site, date } = Route.useSearch() as Search
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<Search>) => navigate({ search: (prev: any) => ({ ...prev, ...next }) })

  const dateObj = React.useMemo(() => {
    const [y, m, d] = String(date).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }, [date])

  const webcamRef = React.useRef<Webcam>(null)
  const [photo, setPhoto] = React.useState<string>('')

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })

    // Helpers: crop high-res to viewport aspect with optional zoom
function cropToAspect(dataUrl: string, targetAspect: number, zoom = 1) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const srcAspect = srcW / srcH

      // Determine crop box to match target aspect
      let cropW, cropH
      if (srcAspect > targetAspect) {
        // source wider than target -> crop width
        cropH = Math.round(srcH / zoom)
        cropW = Math.round(cropH * targetAspect)
      } else {
        // source taller than target -> crop height
        cropW = Math.round(srcW / zoom)
        cropH = Math.round(cropW / targetAspect)
      }

      // Center crop
      const sx = Math.max(0, Math.round((srcW - cropW) / 2))
      const sy = Math.max(0, Math.round((srcH - cropH) / 2))

      // Draw to canvas at full cropped resolution
      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context missing'))
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH)
      resolve(canvas.toDataURL('image/jpeg', 0.95))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

const capture = async () => {
  // Try ImageCapture (full-res)
  const stream: MediaStream | undefined =
    (webcamRef.current as any)?.stream ||
    ((webcamRef.current as any)?.video?.srcObject as MediaStream | undefined)
  const track = stream?.getVideoTracks?.()?.[0]

  let fullResDataUrl: string | undefined
  try {
    if (track && (window as any).ImageCapture) {
      const ic = new (window as any).ImageCapture(track)
      const blob: Blob = await ic.takePhoto()
      fullResDataUrl = await blobToDataUrl(blob)
    }
  } catch {
    // ignore, fallback below
  }

  if (!fullResDataUrl) {
    // Fallback: getScreenshot at source size
    fullResDataUrl = (webcamRef.current as any)?.getScreenshot?.()
  }
  if (!fullResDataUrl) return

  // Compute target aspect from current viewport container
  const portrait = window.matchMedia('(orientation: portrait)').matches
  const targetAspect = portrait ? 9 / 16 : 16 / 9

  // Optional: increase zoom (>1) to crop tighter
  const zoom = 1.25 // tweak 1.0–2.0; higher zoom crops more
  const cropped = await cropToAspect(fullResDataUrl, targetAspect, zoom)
  setPhoto(cropped)
}

  // const capture = async () => {
  //   // Try high-res still via ImageCapture first
  //   const stream: MediaStream | undefined =
  //     (webcamRef.current as any)?.stream ||
  //     ((webcamRef.current as any)?.video?.srcObject as MediaStream | undefined)

  //   const track = stream?.getVideoTracks?.()[0]
  //   try {
  //     if (track && (window as any).ImageCapture) {
  //       const ic = new (window as any).ImageCapture(track)
  //       // Many cameras ignore requested size; still yields highest native resolution
  //       const blob: Blob = await ic.takePhoto()
  //       const dataUrl = await blobToDataUrl(blob)
  //       setPhoto(dataUrl)
  //       return
  //     }
  //   } catch {
  //     // fall through to screenshot fallback
  //   }

  //   // Fallback: react-webcam screenshot at source size
  //   const img = (webcamRef.current as any)?.getScreenshot?.()
  //   if (img) setPhoto(img)
  // }

  const retry = () => setPhoto('')

  const save = async () => {
    if (!photo || !site || !date) return
    try {
      // Save image (uploads to storage, returns filename)
      const { filename } = await uploadBase64Image(photo, `fuel-rec-${site}-${date}.jpg`)
      // Persist record
      const res = await fetch('/api/fuel-rec/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site, date, photo: filename }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
      navigate({ to: '/fuel-rec/list', search: { site } })
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`)
    }
  }

  const [videoConstraints, setVideoConstraints] = React.useState<MediaTrackConstraints>({
    facingMode: { ideal: 'environment' },
    width: { ideal: 2560 },
    height: { ideal: 1440 },
    frameRate: { ideal: 30 },
  })

  React.useEffect(() => {
    const updateConstraints = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches
      setVideoConstraints({
        facingMode: { ideal: 'environment' },
        // Swap width/height in portrait to better fill the screen
        width: { ideal: portrait ? 1440 : 2560 },
        height: { ideal: portrait ? 2560 : 1440 },
        frameRate: { ideal: 30 },
        // Some browsers honor aspectRatio; helps keep full-screen fit
        aspectRatio: portrait ? 9 / 16 : 16 / 9,
      })
    }
    updateConstraints()
    window.addEventListener('resize', updateConstraints)
    window.addEventListener('orientationchange', updateConstraints as any)
    return () => {
      window.removeEventListener('resize', updateConstraints)
      window.removeEventListener('orientationchange', updateConstraints as any)
    }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SitePicker
          value={site}
          onValueChange={(v) => setSearch({ site: v })}
          placeholder="Pick a site"
          label="Site"
          className="w-[240px]"
        />
        <DatePicker
          date={dateObj}
          setDate={(val) => {
            const next = typeof val === 'function' ? val(dateObj) : val
            if (next) setSearch({ date: format(next, 'yyyy-MM-dd') })
          }}
        />
      </div>

      <div className="space-y-3">
        {!photo ? (
          <div
            className="border border-dashed border-gray-300 rounded-md"
            style={{
              // Reserve space for header + buttons; adjust 220px as needed
              // maxHeight: 'calc(100vh - 220px)',
              height: 'calc(100vh - 220px)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Webcam
              ref={webcamRef}
              videoConstraints={videoConstraints}
              forceScreenshotSourceSize
              screenshotFormat="image/jpeg"
              screenshotQuality={1}
              // Make the video fit without cropping
              style={{
                width: '100%',
                height: '100%',
                objectFit: window.matchMedia('(orientation: portrait)').matches ? 'cover' : 'contain',
                // Helps on some devices to respect aspect ratio neatly
                // aspectRatio: '16 / 9',
              }}
            />
          </div>
        ) : (
          <img
            src={photo}
            alt="Captured"
            className="border border-dashed border-gray-300 rounded-md max-w-full"
            style={{ maxHeight: 'calc(100vh - 220px)', objectFit: 'contain' }}
          />
        )}

        <div className="flex gap-2">
          {!photo ? (
            <Button onClick={capture} disabled={!site || !date}>
              Capture
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={retry}>
                Retry
              </Button>
              <Button onClick={save}>Save</Button>
            </>
          )}
        </div>
      </div>

      {/* <div className="space-y-3">
        {!photo ? (
          <Webcam
            ref={webcamRef}
            // Request higher native resolution; browser will choose closest supported
            videoConstraints={{
              facingMode: { ideal: 'environment' },
              width: { ideal: 2560 },
              height: { ideal: 1440 },
              frameRate: { ideal: 30 },
            }}
            // Capture at source size and max quality
            forceScreenshotSourceSize
            screenshotFormat="image/jpeg"
            screenshotQuality={1}
            className="border border-dashed border-gray-300 rounded-md max-w-full"
          />
        ) : (
          <img
            src={photo}
            alt="Captured"
            className="border border-dashed border-gray-300 rounded-md max-w-full"
          />
        )}

        <div className="flex gap-2">
          {!photo ? (
            <Button onClick={capture} disabled={!site || !date}>
              Capture
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={retry}>
                Retry
              </Button>
              <Button onClick={save}>Save</Button>
            </>
          )}
        </div>
      </div> */}
    </div>
  )
}