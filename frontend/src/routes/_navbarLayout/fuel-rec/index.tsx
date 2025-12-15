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

  // Track + zoom capability
  const trackRef = React.useRef<MediaStreamTrack | null>(null)
  const [zoomCaps, setZoomCaps] = React.useState<{ min: number; max: number; step: number } | null>(null)
  const [zoom, setZoom] = React.useState<number>(1)

  const applyZoom = React.useCallback(async (value: number) => {
    const t = trackRef.current as any
    if (!t?.applyConstraints || !t?.getCapabilities) return
    const caps = t.getCapabilities()
    if (!caps?.zoom) return
    try {
      await t.applyConstraints({ advanced: [{ zoom: value }] })
    } catch {
      // ignore if not supported by device/browser
    }
  }, [])

  const onUserMedia = React.useCallback((stream: MediaStream) => {
    const t = stream.getVideoTracks()[0] as any
    trackRef.current = t
    const caps = t?.getCapabilities?.()
    const z = caps?.zoom
    if (z && typeof z.min === 'number' && typeof z.max === 'number') {
      const step = z.step || 0.1
      setZoomCaps({ min: z.min, max: z.max, step })
      // Pick a default zoom based on orientation
      const portrait = window.matchMedia('(orientation: portrait)').matches
      const defaultZoom = Math.min(z.max, Math.max(z.min, portrait ? z.min + (z.max - z.min) * 0.7 : z.min + (z.max - z.min) * 0.4))
      setZoom(defaultZoom)
      applyZoom(defaultZoom)
    }
  }, [applyZoom])

  React.useEffect(() => {
    const handleRecalc = () => {
      const t = trackRef.current as any
      const caps = t?.getCapabilities?.()
      const z = caps?.zoom
      if (!z) return
      const portrait = window.matchMedia('(orientation: portrait)').matches
      const next = Math.min(z.max, Math.max(z.min, portrait ? z.min + (z.max - z.min) * 0.7 : z.min + (z.max - z.min) * 0.4))
      setZoom(next)
      applyZoom(next)
    }
    window.addEventListener('orientationchange', handleRecalc as any)
    window.addEventListener('resize', handleRecalc)
    return () => {
      window.removeEventListener('orientationchange', handleRecalc as any)
      window.removeEventListener('resize', handleRecalc)
    }
  }, [applyZoom])

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })

  const capture = async () => {
    // Try high-res still via ImageCapture first
    const stream: MediaStream | undefined =
      (webcamRef.current as any)?.stream ||
      ((webcamRef.current as any)?.video?.srcObject as MediaStream | undefined)

    const track = stream?.getVideoTracks?.()[0]
    try {
      if (track && (window as any).ImageCapture) {
        const ic = new (window as any).ImageCapture(track)
        // Many cameras ignore requested size; still yields highest native resolution
        const blob: Blob = await ic.takePhoto()
        const dataUrl = await blobToDataUrl(blob)
        setPhoto(dataUrl)
        return
      }
    } catch {
      // fall through to screenshot fallback
    }

    // Fallback: react-webcam screenshot at source size
    const img = (webcamRef.current as any)?.getScreenshot?.()
    if (img) setPhoto(img)
  }

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
              onUserMedia={onUserMedia}
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

        {zoomCaps && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              value={zoom}
              onChange={(e) => {
                const v = Number(e.target.value)
                setZoom(v)
                applyZoom(v)
              }}
              className="w-48"
            />
            <span className="text-xs">{zoom.toFixed(2)}x</span>
          </div>
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