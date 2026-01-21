import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import Webcam from 'react-webcam'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { uploadBase64Image } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

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
  const [bolNumber, setBolNumber] = React.useState<string>('')

  // Disable Save after click and show spinner
  const [saving, setSaving] = React.useState(false)

  // Keep a reference to the active video track for zoom operations
  const trackRef = React.useRef<MediaStreamTrack | null>(null)

  // Ensure preview starts at "no zoom"
  const onUserMedia = React.useCallback((stream: MediaStream) => {
    const t = stream.getVideoTracks()[0] as any
    trackRef.current = t
    const caps = t?.getCapabilities?.()
    const z = caps?.zoom
    // Default preview zoom to min (usually 1x)
    const min = typeof z?.min === 'number' ? z.min : 1
    if (t?.applyConstraints && z) {
      t.applyConstraints({ advanced: [{ zoom: min }] }).catch(() => {})
    }
  }, [])

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // Capture: temporarily zoom to 2.30x (within device range), take photo, then restore
  const capture = async () => {
    // Try to apply temporary zoom if supported
    const t = trackRef.current as any
    let restored = false
    let prevZoom: number | undefined
    let didAdjustZoom = false

    try {
      const caps = t?.getCapabilities?.()
      const z = caps?.zoom
      if (t?.applyConstraints && z) {
        const settings = t.getSettings?.() || {}
        prevZoom = typeof settings.zoom === 'number' ? settings.zoom : (typeof z.min === 'number' ? z.min : 1)
        const target = Math.min(z.max ?? 2.3, Math.max(z.min ?? 1, 2.3))
        if (typeof target === 'number' && target !== prevZoom) {
          await t.applyConstraints({ advanced: [{ zoom: target }] })
          didAdjustZoom = true
          // Give the camera a moment to settle focus/exposure at the new FOV
          await sleep(120)
        }
      }
    } catch {
      // ignore zoom errors
    }

    // Prefer high-res stills
    const stream: MediaStream | undefined =
      (webcamRef.current as any)?.stream ||
      ((webcamRef.current as any)?.video?.srcObject as MediaStream | undefined)
    const track = stream?.getVideoTracks?.()[0]

    try {
      if (track && (window as any).ImageCapture) {
        const ic = new (window as any).ImageCapture(track)
        const blob: Blob = await ic.takePhoto()
        const dataUrl = await blobToDataUrl(blob)
        setPhoto(dataUrl)
      } else {
        const img = (webcamRef.current as any)?.getScreenshot?.()
        if (img) setPhoto(img)
      }
    } finally {
      // Restore previous zoom
      if (didAdjustZoom && t?.applyConstraints) {
        try {
          await t.applyConstraints({ advanced: [{ zoom: prevZoom }] })
          restored = true
        } catch {
          // ignore restore errors
        }
      }
    }

    // Safety: if we changed zoom but failed to restore, try once more soon after
    if (didAdjustZoom && !restored) {
      setTimeout(() => {
        try {
          if (t?.applyConstraints && typeof prevZoom === 'number') {
            t.applyConstraints({ advanced: [{ zoom: prevZoom }] }).catch(() => {})
          }
        } catch {}
      }, 250)
    }
  }

  const retry = () => setPhoto('')

  const save = async () => {
    if (!photo || !site || !date || saving || !bolNumber.trim()) return
    setSaving(true)
    try {
      const { filename } = await uploadBase64Image(photo, `fuel-rec-${site}-${date}.jpg`)
      const res = await fetch('/api/fuel-rec/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ site, date, photo: filename, bolNumber: bolNumber.trim() }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
      navigate({ to: '/fuel-rec/list', search: { site } })
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`)
      setSaving(false)
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
        width: { ideal: portrait ? 1440 : 2560 },
        height: { ideal: portrait ? 2560 : 1440 },
        frameRate: { ideal: 30 },
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
        {/* BOL Number input required before capture/save */}
        <div className="flex items-center gap-3">
          <label htmlFor="bolNumber" className="text-sm font-medium">BOL Number</label>
          <input
            id="bolNumber"
            type="text"
            value={bolNumber}
            onChange={(e) => setBolNumber(e.target.value)}
            placeholder="Enter BOL Number"
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {!photo ? (
          <div
            className="border border-dashed border-gray-300 rounded-md"
            style={{
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
              style={{
                width: '100%',
                height: '100%',
                objectFit: window.matchMedia('(orientation: portrait)').matches ? 'cover' : 'contain',
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
            <Button onClick={capture} disabled={!site || !date || !bolNumber.trim()}>
              Capture
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={retry}>
                Retry
              </Button>
              <Button onClick={save} disabled={saving || !site || !date || !bolNumber.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Route