import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Button } from '@/components/ui/button'

interface OrderRecScannerProps {
  /** Called with each barcode read. The parent decides what it means. */
  onScan: (code: string) => void
  /** Reads are ignored while true (an item editor or count prompt is open). */
  paused: boolean
  /** One line under the video: what happened with the last scan. */
  status: string
  onClose: () => void
}

// The same code is ignored for this long after it was last read, so a barcode
// held in front of the camera doesn't fire twice.
const REPEAT_IGNORE_MS = 3000

const RETAIL_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.ITF,
]

/** Sticky camera panel that reads barcodes continuously until closed. */
export function OrderRecScanner({ onScan, paused, status, onClose }: OrderRecScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // The reader callback outlives renders, so it reads the latest props via refs.
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  onScanRef.current = onScan
  pausedRef.current = paused

  useEffect(() => {
    let stopped = false
    let stop: (() => void) | undefined
    const lastRead = new Map<string, number>()

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMATS)
    const reader = new BrowserMultiFormatReader(hints)

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current ?? undefined,
        (result) => {
          if (!result || pausedRef.current) return
          const code = result.getText()
          const now = Date.now()
          if (now - (lastRead.get(code) ?? 0) < REPEAT_IGNORE_MS) return
          lastRead.set(code, now)
          onScanRef.current(code)
        },
      )
      .then((controls) => {
        if (stopped) controls.stop()
        else stop = () => controls.stop()
      })
      .catch((err) => {
        if (stopped) return
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site and try again.'
            : 'Could not start the camera.',
        )
      })

    return () => {
      stopped = true
      stop?.()
    }
  }, [])

  return (
    <div className="rounded-lg border bg-white shadow-md">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-medium">Scanning</span>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
      <div className="relative mx-3 aspect-video overflow-hidden rounded bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-[10%] inset-y-[30%] rounded border-2 border-white/80" />
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
            Paused
          </div>
        )}
      </div>
      <p className="px-3 py-2 text-sm text-gray-700" role="status">
        {cameraError ?? (status || 'Point the camera at a barcode.')}
      </p>
    </div>
  )
}
