import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'
import { DatePicker } from '@/components/custom/datePicker'
import { uploadBase64Image } from '@/lib/utils'
import { Loader2, Camera, CheckCircle2, RotateCcw } from 'lucide-react'

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

  const [bolNumber, setBolNumber] = React.useState<string>('')
  const [photo, setPhoto] = React.useState<string>('') // Base64 string
  const [saving, setSaving] = React.useState(false)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const dateObj = React.useMemo(() => {
    const [y, m, d] = String(date).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }, [date])

  // Convert Native File to Base64 to keep your existing upload utility compatible
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setPhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const triggerCamera = () => {
    cameraInputRef.current?.click()
  }

  const save = async () => {
    if (!photo || !site || !date || saving || !bolNumber.trim()) return
    setSaving(true)
    try {
      // Maintaining your exact naming convention
      const { filename } = await uploadBase64Image(photo, `fuel-rec-${site}-${date}.jpg`)

      const res = await fetch('/api/fuel-rec/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'accounting.fuelRec.bol',
        },
        body: JSON.stringify({
          site,
          date,
          photo: filename,
          bolNumber: bolNumber.trim()
        }),
      })
      if (res.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
        return;
      }
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))

      navigate({ to: '/fuel-rec/list', search: { site } })
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`)
      setSaving(false)
    }
  }

  const isFormValid = site && date && bolNumber.trim()

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg border border-slate-200 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Fuel Receipt Capture</h2>
          <p className="text-sm text-slate-500">Enter details and capture BOL photo</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col space-y-1.5">
            <label className="text-sm font-semibold">Site</label>
            <SitePicker
              value={site}
              onValueChange={(v) => setSearch({ site: v })}
              placeholder="Pick a site"
              className="w-full"
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-sm font-semibold">Date</label>
            <DatePicker
              date={dateObj}
              setDate={(val) => {
                const next = typeof val === 'function' ? val(dateObj) : val
                if (next) setSearch({ date: format(next, 'yyyy-MM-dd') })
              }}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label htmlFor="bolNumber" className="text-sm font-semibold">BOL Number</label>
            <input
              id="bolNumber"
              type="text"
              value={bolNumber}
              onChange={(e) => setBolNumber(e.target.value)}
              placeholder="Enter BOL Number"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCapture}
        />

        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
          {!photo ? (
            <Button
              className="w-full h-12 text-lg gap-2"
              onClick={triggerCamera}
              disabled={!isFormValid}
            >
              <Camera className="w-5 h-5" />
              Capture BOL Image
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-green-200 bg-green-50 p-2 flex items-center gap-3">
                <CheckCircle2 className="text-green-600 w-5 h-5" />
                <span className="text-sm font-medium text-green-700 flex-1">Image Captured Successfully</span>
                <button
                  onClick={() => setPhoto('')}
                  className="p-1 hover:bg-green-100 rounded text-slate-500"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <Button
                className="w-full h-12 text-lg"
                onClick={save}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  'Upload & Save BOL'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Route